package websocket

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"
)

type Handler struct {
	Hub     *Hub
	NatsURL string
}

func NewHandler(hub *Hub, natsURL string) *Handler {
	return &Handler{Hub: hub, NatsURL: natsURL}
}

func (h *Handler) ServeHTTP(c *gin.Context) {
	runIDStr := c.Param("run_id")
	runID, err := uuid.Parse(runIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid run_id"})
		return
	}

	conn, err := (&websocket.Upgrader{
		ReadBufferSize:    1024,
		WriteBufferSize:   1024,
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			allowedOrigins := []string{
				"http://localhost:5173",
				"http://localhost:8080",
				"https://nimish-nirmal.github.io",
			}
			for _, allowed := range allowedOrigins {
				if strings.EqualFold(origin, allowed) {
					return true
				}
			}
			return origin == ""
		},
	}).Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		zerolog.Ctx(c.Request.Context()).Error().Err(err).Msg("websocket upgrade failed")
		return
	}

	client := &Client{
		ID:   uuid.New(),
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	h.Hub.Register(runID, client)
	defer h.Hub.Unregister(client)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	go func() {
		nc, err := nats.Connect(h.NatsURL)
		if err != nil {
			return
		}
		defer nc.Drain()

		js, err := jetstream.New(nc)
		if err != nil {
			return
		}

		subject := "logs." + runID.String()
		consumerName := "ws-" + runID.String()
		consumer, err := js.CreateOrUpdateConsumer(ctx, "WORKFLOW_LOGS", jetstream.ConsumerConfig{
			Durable:        consumerName,
			FilterSubjects: []string{subject},
			DeliverPolicy:  jetstream.DeliverAllPolicy,
		})
		if err != nil {
			return
		}
		defer js.DeleteConsumer(ctx, "WORKFLOW_LOGS", consumerName)

		iter, err := consumer.Messages()
		if err != nil {
			return
		}
		defer iter.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			default:
				msg, err := iter.Next()
				if err != nil {
					return
				}
				select {
				case client.Send <- msg.Data():
					msg.Ack()
				case <-ctx.Done():
					return
				}
			}
		}
	}()

	go func() {
		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				break
			}
		}
	}()

	for msg := range client.Send {
		if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			break
		}
	}
}
