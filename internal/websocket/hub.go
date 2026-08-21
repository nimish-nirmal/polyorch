package websocket

import (
	"sync"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

type Client struct {
	ID   uuid.UUID
	Conn *websocket.Conn
	Send chan []byte
}

type Hub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID][]*Client
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[uuid.UUID][]*Client),
	}
}

func (h *Hub) Register(runID uuid.UUID, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[runID] = append(h.clients[runID], client)
}

func (h *Hub) Unregister(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for runID, clients := range h.clients {
		for i, c := range clients {
			if c.ID == client.ID {
				h.clients[runID] = append(clients[:i], clients[i+1:]...)
				if len(h.clients[runID]) == 0 {
					delete(h.clients, runID)
				}
				return
			}
		}
	}
}

func (h *Hub) Broadcast(runID uuid.UUID, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, client := range h.clients[runID] {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
		}
	}
}

func (h *Hub) Run() {
}
