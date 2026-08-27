package models

import (
	"time"

	"github.com/google/uuid"
)

func UUID() string {
	return uuid.New().String()
}

type Project struct {
	ProjectID     string    `json:"project_id" db:"project_id"`
	Name          string    `json:"name" db:"name"`
	Description   *string   `json:"description,omitempty" db:"description"`
	VersionsCount int       `json:"versions_count" db:"versions_count"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

type User struct {
	UserID       int64     `json:"user_id" db:"user_id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	MustReset    bool      `json:"must_reset" db:"must_reset"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type ProjectVersion struct {
	VersionID    string    `json:"version_id" db:"version_id"`
	ProjectID    string    `json:"project_id" db:"project_id"`
	VersionTag   string    `json:"version_tag" db:"version_tag"`
	ManifestJSON string    `json:"manifest_json" db:"manifest_json"`
	FilesBundle  []byte    `json:"-" db:"files_bundle"`
	IsActive     bool      `json:"is_active" db:"is_active"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

type WorkflowRun struct {
	RunID       string         `json:"run_id" db:"run_id"`
	VersionID   string         `json:"version_id" db:"version_id"`
	VersionTag  string         `json:"version_tag" db:"version_tag"`
	ProjectID   string         `json:"project_id" db:"project_id"`
	Status      string         `json:"status" db:"status"`
	TriggeredBy string         `json:"triggered_by" db:"triggered_by"`
	StartedAt   *time.Time     `json:"started_at,omitempty" db:"started_at"`
	FinishedAt  *time.Time     `json:"finished_at,omitempty" db:"finished_at"`
	Tasks       []WorkflowTask `json:"tasks,omitempty" db:"-"`
}

type WorkflowTask struct {
	ID         string     `json:"id"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

type ExecutionLog struct {
	LogID      int64     `json:"log_id" db:"log_id"`
	RunID      string    `json:"run_id" db:"run_id"`
	StreamType string    `json:"stream_type" db:"stream_type"`
	Message    string    `json:"message" db:"message"`
	Timestamp  time.Time `json:"timestamp" db:"timestamp"`
}

type CreateProjectRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

type CreateVersionRequest struct {
	VersionTag string `form:"version_tag" binding:"required"`
}

type CreateRunRequest struct {
	ProjectID string `json:"project_id" binding:"required"`
	VersionID string `json:"version_id" binding:"required"`
}

type RunStatusUpdate struct {
	Status     string     `json:"status" binding:"required"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
}

type Manifest struct {
	Runtime    string            `json:"runtime" binding:"required"`
	Entrypoint string            `json:"entrypoint" binding:"required"`
	Env        map[string]string `json:"env,omitempty"`
	Timeout    int               `json:"timeout,omitempty"`
}

type TaskPayload struct {
	RunID     string `json:"run_id"`
	VersionID string `json:"version_id"`
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required"`
}

type UpdateVersionFileRequest struct {
	Content string `json:"content"`
}

type ResetPasswordRequest struct {
	NewPassword string `json:"new_password" binding:"required"`
}
