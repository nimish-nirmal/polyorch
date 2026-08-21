package nats

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go/jetstream"
	"github.com/nimish-nirmal/polyorch/internal/worker"
)

type Manager struct {
	Client *Client
}

func NewManager(client *Client) *Manager {
	return &Manager{Client: client}
}

func (m *Manager) PublishTask(ctx context.Context, payload worker.TaskPayload) error {
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	var pubErr error
	for attempt := 0; attempt < 3; attempt++ {
		pubErr = m.Client.Conn.Publish("tasks.execute", data)
		if pubErr == nil {
			return nil
		}
		time.Sleep(time.Duration(attempt+1) * 100 * time.Millisecond)
	}

	return fmt.Errorf("failed to publish task after retries: %w", pubErr)
}

func GetConsumer(ctx context.Context, js jetstream.JetStream) (jetstream.Consumer, error) {
	return js.CreateOrUpdateConsumer(ctx, "WORKFLOW_TASKS", jetstream.ConsumerConfig{
		Durable:        "worker-consumer",
		FilterSubjects: []string{"tasks.execute"},
		DeliverPolicy:  jetstream.DeliverAllPolicy,
		AckPolicy:      jetstream.AckExplicitPolicy,
	})
}
