package handlers

import "time"

type WorkflowResponse struct {
	RunID     string     `json:"run_id"`
	VersionID string     `json:"version_id"`
	Status    string     `json:"status"`
	StartedAt *time.Time `json:"started_at,omitempty"`
}

type LogStreamMessage struct {
	RunID    string `json:"run_id"`
	Stream   string `json:"stream"`
	Message  string `json:"message"`
}
