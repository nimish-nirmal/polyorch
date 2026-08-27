package worker

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/klauspost/compress/zip"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"

	"github.com/nimish-nirmal/polyorch/internal/models"
)

type Engine struct {
	DB      Store
	JS      jetstream.JetStream
	NC      *nats.Conn
	TmpDir  string
	Timeout time.Duration
	Logger  *zerolog.Logger
}

type Store interface {
	GetVersion(versionID string) (*models.ProjectVersion, error)
	UpdateRunStatus(runID, status string, finishedAt *time.Time) error
	InsertLog(runID, streamType, message string) error
}

func NewEngine(db Store, js jetstream.JetStream, nc *nats.Conn, tmpDir string, timeout time.Duration, logger *zerolog.Logger) *Engine {
	return &Engine{DB: db, JS: js, NC: nc, TmpDir: tmpDir, Timeout: timeout, Logger: logger}
}

func (e *Engine) Consume(ctx context.Context) error {
	consumer, err := e.JS.CreateOrUpdateConsumer(ctx, "WORKFLOW_TASKS", jetstream.ConsumerConfig{
		Durable:        "worker-consumer",
		FilterSubjects: []string{"tasks.execute"},
		DeliverPolicy:  jetstream.DeliverAllPolicy,
		AckPolicy:      jetstream.AckExplicitPolicy,
	})
	if err != nil {
		return err
	}

	e.Logger.Info().Msg("worker started, waiting for tasks")

	iter, err := consumer.Messages()
	if err != nil {
		return err
	}

	go func() {
		<-ctx.Done()
		iter.Stop()
	}()

	for {
		select {
		case <-ctx.Done():
			return nil
		default:
			msg, err := iter.Next()
			if err != nil {
				e.Logger.Error().Err(err).Msg("failed to fetch message")
				continue
			}

			go e.HandleTask(msg)
		}
	}
}

func (e *Engine) HandleTask(msg jetstream.Msg) {
	defer func() {
		if r := recover(); r != nil {
			e.Logger.Error().Interface("panic", r).Msg("task handler panicked")
		}
	}()

	data := msg.Data()
	var payload models.TaskPayload
	if err := json.Unmarshal(data, &payload); err != nil {
		e.Logger.Error().Err(err).Msg("failed to parse payload")
		msg.Ack()
		return
	}

	runID := payload.RunID
	e.Logger.Info().Str("run_id", runID).Msg("processing task")

	if err := e.DB.UpdateRunStatus(runID, "running", nil); err != nil {
		e.Logger.Error().Err(err).Str("run_id", runID).Msg("failed to update run status")
		msg.Ack()
		return
	}

	version, err := e.DB.GetVersion(payload.VersionID)
	if err != nil {
		e.logError(runID, fmt.Sprintf("failed to fetch version: %v", err))
		now := time.Now()
		e.DB.UpdateRunStatus(runID, "failed", &now)
		msg.Ack()
		return
	}

	runDir := filepath.Join(e.TmpDir, runID)
	if err := unpackZip(version.FilesBundle, runDir); err != nil {
		e.logError(runID, fmt.Sprintf("failed to unpack zip: %v", err))
		now := time.Now()
		e.DB.UpdateRunStatus(runID, "failed", &now)
		msg.Ack()
		return
	}
	defer os.RemoveAll(runDir)

	manifestPath := filepath.Join(runDir, "manifest.json")
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		e.logError(runID, fmt.Sprintf("failed to read manifest: %v", err))
		now := time.Now()
		e.DB.UpdateRunStatus(runID, "failed", &now)
		msg.Ack()
		return
	}

	var manifest models.Manifest
	if err := json.Unmarshal(manifestBytes, &manifest); err != nil {
		e.logError(runID, fmt.Sprintf("failed to parse manifest: %v", err))
		now := time.Now()
		e.DB.UpdateRunStatus(runID, "failed", &now)
		msg.Ack()
		return
	}

	timeout := time.Duration(manifest.Timeout) * time.Second
	if timeout == 0 {
		timeout = e.Timeout
	}

	err = e.execute(runID, runDir, &manifest, timeout)
	if err != nil {
		now := time.Now()
		e.DB.UpdateRunStatus(runID, "failed", &now)
		msg.Ack()
		return
	}

	now := time.Now()
	e.DB.UpdateRunStatus(runID, "success", &now)
	msg.Ack()
}

func (e *Engine) execute(runID, runDir string, manifest *models.Manifest, timeout time.Duration) error {
	cmd, err := buildCommand(manifest.Runtime, manifest.Entrypoint, runDir)
	if err != nil {
		e.logError(runID, fmt.Sprintf("failed to build command: %v", err))
		return err
	}

	if len(manifest.Env) > 0 {
		env := os.Environ()
		for k, v := range manifest.Env {
			env = append(env, fmt.Sprintf("%s=%s", k, v))
		}
		cmd.Env = env
	}

	cmd.Dir = runDir
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		e.logError(runID, fmt.Sprintf("failed to start command: %v", err))
		return err
	}

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	go func() {
		<-ctx.Done()
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}()

	go streamOutput(stdout, runID, "stdout", e)
	go streamOutput(stderr, runID, "stderr", e)

	err = <-done
	if err != nil {
		e.logError(runID, fmt.Sprintf("command failed: %v", err))
		return err
	}

	e.logInfo(runID, "command completed successfully")
	return nil
}

func streamOutput(reader io.Reader, runID, streamType string, engine *Engine) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()
		engine.DB.InsertLog(runID, streamType, line)
		if engine.NC != nil {
			subject := fmt.Sprintf("logs.%s", runID)
			if err := engine.NC.Publish(subject, []byte(line)); err == nil {
				_ = engine.NC.FlushTimeout(100 * time.Millisecond)
			}
		}
	}
}

func unpackZip(data []byte, dest string) error {
	if err := os.MkdirAll(dest, 0755); err != nil {
		return err
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return err
	}

	for _, f := range r.File {
		fpath := filepath.Join(dest, f.Name)
		if !strings.HasPrefix(fpath, filepath.Clean(dest)+string(os.PathSeparator)) {
			continue
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(fpath, f.Mode())
			continue
		}
		if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
			return err
		}
		out, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}
		_, err = io.Copy(out, rc)
		out.Close()
		rc.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

func (e *Engine) logInfo(runID, msg string) {
	_ = e.DB.InsertLog(runID, "stdout", msg)
	e.Logger.Info().Str("run_id", runID).Msg(msg)
}

func (e *Engine) logError(runID, msg string) {
	_ = e.DB.InsertLog(runID, "stderr", msg)
	e.Logger.Error().Str("run_id", runID).Msg(msg)
}
