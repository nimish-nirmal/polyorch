package nats

import (
	"context"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"
)

type Client struct {
	Conn *nats.Conn
	JS   jetstream.JetStream
}

func Connect(url string) (*Client, error) {
	opts := []nats.Option{
		nats.Name("polyorch-api"),
		nats.ReconnectWait(2 * time.Second),
		nats.MaxReconnects(10),
		nats.DrainTimeout(5 * time.Second),
	}

	conn, err := nats.Connect(url, opts...)
	if err != nil {
		return nil, fmt.Errorf("connect to NATS: %w", err)
	}

	js, err := jetstream.New(conn)
	if err != nil {
		conn.Close()
		return nil, fmt.Errorf("create JetStream context: %w", err)
	}

	return &Client{Conn: conn, JS: js}, nil
}

func EnsureStream(ctx context.Context, js jetstream.JetStream, logger *zerolog.Logger) error {
	streams := []jetstream.StreamConfig{
		{Name: "WORKFLOW_TASKS", Subjects: []string{"tasks.execute"}, Storage: jetstream.FileStorage},
		{Name: "WORKFLOW_LOGS", Subjects: []string{"logs.*"}, Storage: jetstream.FileStorage},
	}
	for _, config := range streams {
		if _, err := js.Stream(ctx, config.Name); err == nil {
			continue
		}
		if _, err := js.CreateStream(ctx, config); err != nil {
			return fmt.Errorf("create %s stream: %w", config.Name, err)
		}
		logger.Info().Str("stream", config.Name).Msg("created NATS stream")
	}
	return nil
}
