package database

import (
	"time"

	"github.com/nimish-nirmal/polyorch/internal/models"
)

type Store interface {
	CreateProject(projectID, name, description string) (*models.Project, error)
	ListProjects() ([]models.Project, error)
	GetProject(projectID string) (*models.Project, error)
	CreateVersion(projectID, versionTag, manifestJSON string, filesBundle []byte) (*models.ProjectVersion, error)
	ListVersions(projectID string) ([]models.ProjectVersion, error)
	GetVersion(versionID string) (*models.ProjectVersion, error)
	SetActiveVersion(versionID string) error
	CreateRun(versionID string) (*models.WorkflowRun, error)
	GetRun(runID string) (*models.WorkflowRun, error)
	UpdateRunStatus(runID, status string, finishedAt *time.Time) error
	ListRuns(limit, offset int) ([]models.WorkflowRun, error)
	GetRunLogs(runID string, limit, offset int) ([]models.ExecutionLog, error)
	InsertLog(runID, streamType, message string) error
	GetUser(username string) (*models.User, error)
	CreateUser(username, passwordHash string, mustReset bool) error
	UpdatePassword(username, newHash string) error
	ClearMustReset(username string) error
}
