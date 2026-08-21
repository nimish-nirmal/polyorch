package database

import (
	"database/sql"
	"time"

	"github.com/nimish-nirmal/polyorch/internal/models"
)

type SQLiteStore struct {
	Conn *sql.DB
}

func NewSQLiteStore(conn *sql.DB) *SQLiteStore {
	return &SQLiteStore{Conn: conn}
}

func (s *SQLiteStore) CreateProject(projectID, name, description string) (*models.Project, error) {
	_, err := s.Conn.Exec(
		"INSERT INTO projects (project_id, name, description) VALUES (?, ?, ?)",
		projectID, name, description,
	)
	if err != nil {
		return nil, err
	}
	return &models.Project{ProjectID: projectID, Name: name, Description: &description}, nil
}

func (s *SQLiteStore) ListProjects() ([]models.Project, error) {
	rows, err := s.Conn.Query("SELECT project_id, name, description, created_at FROM projects ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ProjectID, &p.Name, &p.Description, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, nil
}

func (s *SQLiteStore) GetProject(projectID string) (*models.Project, error) {
	var p models.Project
	err := s.Conn.QueryRow("SELECT project_id, name, description, created_at FROM projects WHERE project_id = ?", projectID).
		Scan(&p.ProjectID, &p.Name, &p.Description, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *SQLiteStore) CreateVersion(projectID, versionTag, manifestJSON string, filesBundle []byte) (*models.ProjectVersion, error) {
	versionID := models.UUID()
	_, err := s.Conn.Exec(
		"INSERT INTO project_versions (version_id, project_id, version_tag, manifest_json, files_bundle) VALUES (?, ?, ?, ?, ?)",
		versionID, projectID, versionTag, manifestJSON, filesBundle,
	)
	if err != nil {
		return nil, err
	}
	return s.GetVersion(versionID)
}

func (s *SQLiteStore) ListVersions(projectID string) ([]models.ProjectVersion, error) {
	rows, err := s.Conn.Query(
		"SELECT version_id, project_id, version_tag, manifest_json, files_bundle, is_active, created_at FROM project_versions WHERE project_id = ? ORDER BY created_at DESC",
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []models.ProjectVersion
	for rows.Next() {
		var v models.ProjectVersion
		if err := rows.Scan(&v.VersionID, &v.ProjectID, &v.VersionTag, &v.ManifestJSON, &v.FilesBundle, &v.IsActive, &v.CreatedAt); err != nil {
			return nil, err
		}
		versions = append(versions, v)
	}
	return versions, nil
}

func (s *SQLiteStore) GetVersion(versionID string) (*models.ProjectVersion, error) {
	var v models.ProjectVersion
	err := s.Conn.QueryRow(
		"SELECT version_id, project_id, version_tag, manifest_json, files_bundle, is_active, created_at FROM project_versions WHERE version_id = ?",
		versionID,
	).Scan(&v.VersionID, &v.ProjectID, &v.VersionTag, &v.ManifestJSON, &v.FilesBundle, &v.IsActive, &v.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (s *SQLiteStore) SetActiveVersion(versionID string) error {
	tx, err := s.Conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("UPDATE project_versions SET is_active = 0 WHERE is_active = 1"); err != nil {
		return err
	}
	if _, err := tx.Exec("UPDATE project_versions SET is_active = 1 WHERE version_id = ?", versionID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) CreateRun(versionID string) (*models.WorkflowRun, error) {
	runID := models.UUID()
	_, err := s.Conn.Exec(
		"INSERT INTO workflow_runs (run_id, version_id, status) VALUES (?, ?, 'pending')",
		runID, versionID,
	)
	if err != nil {
		return nil, err
	}
	return s.GetRun(runID)
}

func (s *SQLiteStore) GetRun(runID string) (*models.WorkflowRun, error) {
	var r models.WorkflowRun
	err := s.Conn.QueryRow(
		"SELECT run_id, version_id, status, started_at, finished_at FROM workflow_runs WHERE run_id = ?",
		runID,
	).Scan(&r.RunID, &r.VersionID, &r.Status, &r.StartedAt, &r.FinishedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *SQLiteStore) UpdateRunStatus(runID, status string, finishedAt *time.Time) error {
	if finishedAt != nil {
		_, err := s.Conn.Exec(
			"UPDATE workflow_runs SET status = ?, finished_at = ? WHERE run_id = ?",
			status, finishedAt, runID,
		)
		return err
	}
	_, err := s.Conn.Exec("UPDATE workflow_runs SET status = ? WHERE run_id = ?", status, runID)
	return err
}

func (s *SQLiteStore) ListRuns(limit, offset int) ([]models.WorkflowRun, error) {
	rows, err := s.Conn.Query(
		"SELECT run_id, version_id, status, started_at, finished_at FROM workflow_runs ORDER BY started_at DESC LIMIT ? OFFSET ?",
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []models.WorkflowRun
	for rows.Next() {
		var r models.WorkflowRun
		if err := rows.Scan(&r.RunID, &r.VersionID, &r.Status, &r.StartedAt, &r.FinishedAt); err != nil {
			return nil, err
		}
		runs = append(runs, r)
	}
	return runs, nil
}

func (s *SQLiteStore) GetRunLogs(runID string, limit, offset int) ([]models.ExecutionLog, error) {
	rows, err := s.Conn.Query(
		"SELECT log_id, run_id, stream_type, message, timestamp FROM execution_logs WHERE run_id = ? ORDER BY timestamp ASC LIMIT ? OFFSET ?",
		runID, limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.ExecutionLog
	for rows.Next() {
		var l models.ExecutionLog
		if err := rows.Scan(&l.LogID, &l.RunID, &l.StreamType, &l.Message, &l.Timestamp); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func (s *SQLiteStore) InsertLog(runID, streamType, message string) error {
	_, err := s.Conn.Exec(
		"INSERT INTO execution_logs (run_id, stream_type, message) VALUES (?, ?, ?)",
		runID, streamType, message,
	)
	return err
}

func (s *SQLiteStore) GetUser(username string) (*models.User, error) {
	var u models.User
	err := s.Conn.QueryRow(
		"SELECT user_id, username, password_hash, must_reset, created_at, updated_at FROM users WHERE username = ?",
		username,
	).Scan(&u.UserID, &u.Username, &u.PasswordHash, &u.MustReset, &u.CreatedAt, &u.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *SQLiteStore) CreateUser(username, passwordHash string, mustReset bool) error {
	_, err := s.Conn.Exec(
		"INSERT INTO users (username, password_hash, must_reset) VALUES (?, ?, ?)",
		username, passwordHash, mustReset,
	)
	return err
}

func (s *SQLiteStore) UpdatePassword(username, newHash string) error {
	_, err := s.Conn.Exec(
		"UPDATE users SET password_hash = ?, must_reset = 0, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
		newHash, username,
	)
	return err
}

func (s *SQLiteStore) ClearMustReset(username string) error {
	_, err := s.Conn.Exec(
		"UPDATE users SET must_reset = 0, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
		username,
	)
	return err
}
