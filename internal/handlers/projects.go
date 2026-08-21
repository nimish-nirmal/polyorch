package handlers

import (
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/nimish-nirmal/polyorch/internal/models"
)

type Server struct {
	DB Store
}

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
}

func NewServer(db Store) *Server {
	return &Server{DB: db}
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
	c.JSON(http.StatusOK, gin.H{"data": run})
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
