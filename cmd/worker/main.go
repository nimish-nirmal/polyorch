package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/nimish-nirmal/polyorch/internal/config"
	"github.com/nimish-nirmal/polyorch/internal/database"
	natspkg "github.com/nimish-nirmal/polyorch/internal/nats"
	"github.com/nimish-nirmal/polyorch/internal/worker"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	conn, err := database.Open(cfg.DBPath)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to open database")
	}
	defer conn.Conn.Close()
	logger.Info().Str("db_path", cfg.DBPath).Msg("connected to database")

	nc, err := nats.Connect(cfg.NATSURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to NATS")
	}
	defer nc.Close()
	logger.Info().Str("nats_url", cfg.NATSURL).Msg("connected to NATS")

	js, err := jetstream.New(nc)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create JetStream context")
	}
	logger.Info().Msg("JetStream context created")

	if err := natspkg.EnsureStream(context.Background(), js, &logger); err != nil {
		logger.Fatal().Err(err).Msg("failed to ensure stream")
	}
	logger.Info().Msg("NATS stream ensured")

	if err := os.MkdirAll(cfg.RunsTmpDir, 0755); err != nil {
		logger.Fatal().Err(err).Msg("failed to create runs tmp dir")
	}
	logger.Info().Str("runs_tmp_dir", cfg.RunsTmpDir).Msg("runs tmp dir ready")

	store := database.NewSQLiteStore(conn.Conn)
	timeout := 300 * time.Second

	engine := worker.NewEngine(store, js, nc, cfg.RunsTmpDir, timeout, &logger)
	logger.Info().Msg("worker engine initialized")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		logger.Info().Msg("shutting down worker")
		cancel()
	}()

	logger.Info().Msg("starting worker consumer")
	if err := engine.Consume(ctx); err != nil {
		logger.Fatal().Err(err).Msg("worker consume error")
	}

	logger.Info().Msg("worker stopped")
}
