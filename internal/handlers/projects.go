package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/nimish-nirmal/polyorch/internal/models"
)

type Server struct {
	DB Store
	JS jetstream.JetStream
}

type Store interface {
	CreateProject(projectID, name, description string) (*models.Project, error)
	ListProjects() ([]models.Project, error)
	GetProject(projectID string) (*models.Project, error)
	CreateVersion(projectID, versionTag, manifestJSON string, filesBundle []byte) (*models.ProjectVersion, error)
	ListVersions(projectID string) ([]models.ProjectVersion, error)
	GetVersion(versionID string) (*models.ProjectVersion, error)
	GetVersionFiles(projectID, versionID string) ([]string, error)
	GetVersionFile(projectID, versionID, filename string) (string, error)
	UpdateVersionFile(versionID, filename, newContent string) (*models.ProjectVersion, error)
	SetActiveVersion(versionID string) error
	CreateRun(versionID string) (*models.WorkflowRun, error)
	GetRun(runID string) (*models.WorkflowRun, error)
	DeleteRun(runID string) error
	UpdateRunStatus(runID, status string, finishedAt *time.Time) error
	ListRuns(limit, offset int) ([]models.WorkflowRun, error)
	GetRunLogs(runID string, limit, offset int) ([]models.ExecutionLog, error)
	InsertLog(runID, streamType, message string) error
	ClearLogs(runID string) error
	GetUser(username string) (*models.User, error)
	CreateUser(username, passwordHash string, mustReset bool) error
	UpdatePassword(username, newHash string) error
	ClearMustReset(username string) error
}

func NewServer(db Store, js jetstream.JetStream) *Server {
	return &Server{DB: db, JS: js}
}

func (s *Server) CreateProject(c *gin.Context) {
	var req models.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	projectID := uuid.New().String()
	desc := ""
	if req.Description != nil {
		desc = *req.Description
	}
	project, err := s.DB.CreateProject(projectID, req.Name, desc)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": project})
}

func (s *Server) ListProjects(c *gin.Context) {
	projects, err := s.DB.ListProjects()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": projects})
}

func (s *Server) GetProject(c *gin.Context) {
	projectID := c.Param("id")
	project, err := s.DB.GetProject(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if project == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": project})
}

func (s *Server) CreateVersion(c *gin.Context) {
	projectID := c.Param("id")
	versionTag := c.PostForm("version_tag")
	if versionTag == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "version_tag is required"})
		return
	}

	manifestFile, err := c.FormFile("manifest")
	manifestJSON := "{}"
	if err == nil && manifestFile != nil {
		src, err := manifestFile.Open()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer src.Close()
		manifestBytes, err := io.ReadAll(src)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		manifestJSON = string(manifestBytes)
	} else if manifestValue := c.PostForm("manifest"); manifestValue != "" {
		manifestJSON = manifestValue
	}

	file, err := c.FormFile("files")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "files zip is required"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer src.Close()

	buf, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	version, err := s.DB.CreateVersion(projectID, versionTag, manifestJSON, buf)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"data": version})
}

func (s *Server) ListVersions(c *gin.Context) {
	projectID := c.Param("id")
	versions, err := s.DB.ListVersions(projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": versions})
}

func (s *Server) SetActiveVersion(c *gin.Context) {
	versionID := c.Param("versionId")
	if err := s.DB.SetActiveVersion(versionID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"version_id": versionID, "is_active": true}})
}

func (s *Server) CreateRun(c *gin.Context) {
	var req models.CreateRunRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	run, err := s.DB.CreateRun(req.VersionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if s.JS != nil {
		payload, _ := json.Marshal(models.TaskPayload{RunID: run.RunID, VersionID: req.VersionID})
		_, _ = s.JS.Publish(c.Request.Context(), "tasks.execute", payload)
	}

	c.JSON(http.StatusAccepted, gin.H{"data": run})
}

func (s *Server) ListRuns(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	runs, err := s.DB.ListRuns(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	for index := range runs {
		s.addRunDetails(&runs[index])
	}
	c.JSON(http.StatusOK, gin.H{"data": runs})
}

func (s *Server) GetRun(c *gin.Context) {
	runID := c.Param("id")
	run, err := s.DB.GetRun(runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if run == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}
	s.addRunDetails(run)
	c.JSON(http.StatusOK, gin.H{"data": run})
}

func (s *Server) addRunDetails(run *models.WorkflowRun) {
	run.TriggeredBy = "manual"
	version, err := s.DB.GetVersion(run.VersionID)
	if err != nil || version == nil {
		return
	}
	var manifest models.Manifest
	if json.Unmarshal([]byte(version.ManifestJSON), &manifest) != nil || strings.TrimSpace(manifest.Entrypoint) == "" {
		return
	}
	taskCount := 1
	if turns, err := strconv.Atoi(manifest.Env["TURNS"]); err == nil && turns > 0 && turns <= 100 {
		taskCount = turns
	}
	run.Tasks = make([]models.WorkflowTask, 0, taskCount)
	for index := 1; index <= taskCount; index++ {
		name := manifest.Entrypoint
		if taskCount > 1 {
			name = fmt.Sprintf("Turn %d/%d: %s", index, taskCount, manifest.Entrypoint)
		}
		run.Tasks = append(run.Tasks, models.WorkflowTask{
			ID:     fmt.Sprintf("task-%d", index),
			Name:   name,
			Status: run.Status,
		})
	}
}

func (s *Server) GetRunLogs(c *gin.Context) {
	runID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	logs, err := s.DB.GetRunLogs(runID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": logs})
}

func (s *Server) DeleteRun(c *gin.Context) {
	runID := c.Param("id")
	if err := s.DB.DeleteRun(runID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"run_id": runID, "deleted": true}})
}

func (s *Server) StartRun(c *gin.Context) {
	runID := c.Param("id")
	run, err := s.DB.GetRun(runID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if run == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "run not found"})
		return
	}

	// Prevent duplicate execution. A run that has already reached a terminal
	// state (success/failed) or is currently running must not be re-published
	// to NATS, otherwise the worker would execute it twice. Retrying a run is
	// done by creating a new run.
	switch run.Status {
	case "success":
		c.JSON(http.StatusConflict, gin.H{"error": "run already completed"})
		return
	case "running":
		c.JSON(http.StatusConflict, gin.H{"error": "run already running"})
		return
	case "failed":
		// Allow re-triggering a failed run by resetting it to pending.
		if err := s.DB.UpdateRunStatus(runID, "pending", nil); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if s.JS != nil {
		payload, _ := json.Marshal(models.TaskPayload{RunID: runID, VersionID: run.VersionID})
		_, err = s.JS.Publish(c.Request.Context(), "tasks.execute", payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"run_id": runID, "status": "pending"}})
}

func (s *Server) ClearRunLogs(c *gin.Context) {
	runID := c.Param("id")
	if err := s.DB.ClearLogs(runID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"run_id": runID, "cleared": true}})
}

func (s *Server) ListVersionFiles(c *gin.Context) {
	projectID := c.Param("id")
	versionID := c.Param("versionId")
	files, err := s.DB.GetVersionFiles(projectID, versionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": files})
}

func (s *Server) GetVersionFile(c *gin.Context) {
	projectID := c.Param("id")
	versionID := c.Param("versionId")
	filename := strings.TrimPrefix(c.Param("filename"), "/")
	content, err := s.DB.GetVersionFile(projectID, versionID, filename)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if content == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": gin.H{"filename": filename, "content": content}})
}

func (s *Server) UpdateVersionFile(c *gin.Context) {
	versionID := c.Param("versionId")
	filename := strings.TrimPrefix(c.Param("filename"), "/")

	var req models.UpdateVersionFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	version, err := s.DB.UpdateVersionFile(versionID, filename, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": version})
}
