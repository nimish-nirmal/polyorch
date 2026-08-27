package database

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
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
	// Re-read the row so created_at reflects the database-assigned value.
	return s.GetProject(projectID)
}

func (s *SQLiteStore) ListProjects() ([]models.Project, error) {
	rows, err := s.Conn.Query(`
		SELECT p.project_id, p.name, p.description, p.created_at, COUNT(pv.version_id) as versions_count
		FROM projects p
		LEFT JOIN project_versions pv ON p.project_id = pv.project_id
		GROUP BY p.project_id, p.name, p.description, p.created_at
		ORDER BY p.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []models.Project
	for rows.Next() {
		var p models.Project
		var versionsCount int
		if err := rows.Scan(&p.ProjectID, &p.Name, &p.Description, &p.CreatedAt, &versionsCount); err != nil {
			return nil, err
		}
		p.VersionsCount = versionsCount
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

func (s *SQLiteStore) GetVersionFiles(projectID, versionID string) ([]string, error) {
	var v models.ProjectVersion
	err := s.Conn.QueryRow(
		"SELECT files_bundle FROM project_versions WHERE project_id = ? AND version_id = ?",
		projectID, versionID,
	).Scan(&v.FilesBundle)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(v.FilesBundle), int64(len(v.FilesBundle)))
	if err != nil {
		return nil, err
	}

	var files []string
	for _, f := range zipReader.File {
		if !f.FileInfo().IsDir() {
			files = append(files, f.Name)
		}
	}
	return files, nil
}

func (s *SQLiteStore) GetVersionFile(projectID, versionID, filename string) (string, error) {
	var v models.ProjectVersion
	err := s.Conn.QueryRow(
		"SELECT files_bundle FROM project_versions WHERE project_id = ? AND version_id = ?",
		projectID, versionID,
	).Scan(&v.FilesBundle)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(v.FilesBundle), int64(len(v.FilesBundle)))
	if err != nil {
		return "", err
	}

	for _, f := range zipReader.File {
		if f.Name == filename && !f.FileInfo().IsDir() {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			defer rc.Close()

			var buf bytes.Buffer
			_, err = buf.ReadFrom(rc)
			if err != nil {
				return "", err
			}
			return buf.String(), nil
		}
	}
	return "", nil
}

func (s *SQLiteStore) UpdateVersionFile(versionID, filename, newContent string) (*models.ProjectVersion, error) {
	var base models.ProjectVersion
	err := s.Conn.QueryRow(
		"SELECT manifest_json, files_bundle FROM project_versions WHERE version_id = ?",
		versionID,
	).Scan(&base.ManifestJSON, &base.FilesBundle)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("version not found")
	}
	if err != nil {
		return nil, err
	}

	zipReader, err := zip.NewReader(bytes.NewReader(base.FilesBundle), int64(len(base.FilesBundle)))
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	updated := false
	for _, f := range zipReader.File {
		if !f.FileInfo().IsDir() && f.Name == filename {
			fw, err := zipWriter.Create(f.Name)
			if err != nil {
				return nil, err
			}
			_, err = fw.Write([]byte(newContent))
			if err != nil {
				return nil, err
			}
			updated = true
			continue
		}

		if f.FileInfo().IsDir() {
			_, err := zipWriter.CreateHeader(&zip.FileHeader{
				Name:     f.Name,
				Method:   f.Method,
				Modified: f.Modified,
			})
			if err != nil {
				return nil, err
			}
			continue
		}

		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}

		fw, err := zipWriter.Create(f.Name)
		if err != nil {
			return nil, err
		}
		_, err = fw.Write(content)
		if err != nil {
			return nil, err
		}
	}

	if !updated && filename != "" {
		fw, err := zipWriter.Create(filename)
		if err != nil {
			return nil, err
		}
		_, err = fw.Write([]byte(newContent))
		if err != nil {
			return nil, err
		}
	}

	if err := zipWriter.Close(); err != nil {
		return nil, err
	}

	if _, err := s.Conn.Exec("UPDATE project_versions SET files_bundle = ? WHERE version_id = ?", buf.Bytes(), versionID); err != nil {
		return nil, err
	}

	return s.GetVersion(versionID)
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
		"SELECT wr.run_id, wr.version_id, pv.version_tag, pv.project_id, wr.status, wr.started_at, wr.finished_at FROM workflow_runs wr LEFT JOIN project_versions pv ON wr.version_id = pv.version_id WHERE wr.run_id = ?",
		runID,
	).Scan(&r.RunID, &r.VersionID, &r.VersionTag, &r.ProjectID, &r.Status, &r.StartedAt, &r.FinishedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if err := s.hydrateStartedAt(&r); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *SQLiteStore) hydrateStartedAt(run *models.WorkflowRun) error {
	if run.StartedAt != nil {
		return nil
	}
	var firstLog time.Time
	err := s.Conn.QueryRow(
		"SELECT timestamp FROM execution_logs WHERE run_id = ? ORDER BY timestamp ASC LIMIT 1",
		run.RunID,
	).Scan(&firstLog)
	if err == nil {
		run.StartedAt = &firstLog
		return nil
	}
	if err == sql.ErrNoRows {
		return nil
	}
	return err
}

func (s *SQLiteStore) UpdateRunStatus(runID, status string, finishedAt *time.Time) error {
	if finishedAt != nil {
		result, err := s.Conn.Exec(
			"UPDATE workflow_runs SET status = ?, finished_at = ? WHERE run_id = ?",
			status, finishedAt, runID,
		)
		if err != nil {
			return err
		}
		return requireRunUpdate(result)
	}
	result, err := s.Conn.Exec("UPDATE workflow_runs SET status = ?, started_at = COALESCE(started_at, CASE WHEN ? = 'running' THEN CURRENT_TIMESTAMP ELSE started_at END) WHERE run_id = ?", status, status, runID)
	if err != nil {
		return err
	}
	return requireRunUpdate(result)
}

func requireRunUpdate(result sql.Result) error {
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *SQLiteStore) DeleteRun(runID string) error {
	tx, err := s.Conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM execution_logs WHERE run_id = ?", runID); err != nil {
		return err
	}
	if _, err := tx.Exec("DELETE FROM workflow_runs WHERE run_id = ?", runID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *SQLiteStore) ListRuns(limit, offset int) ([]models.WorkflowRun, error) {
	rows, err := s.Conn.Query(
		"SELECT wr.run_id, wr.version_id, pv.version_tag, pv.project_id, wr.status, wr.started_at, wr.finished_at FROM workflow_runs wr LEFT JOIN project_versions pv ON wr.version_id = pv.version_id ORDER BY wr.started_at DESC LIMIT ? OFFSET ?",
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []models.WorkflowRun
	for rows.Next() {
		var r models.WorkflowRun
		if err := rows.Scan(&r.RunID, &r.VersionID, &r.VersionTag, &r.ProjectID, &r.Status, &r.StartedAt, &r.FinishedAt); err != nil {
			return nil, err
		}
		if err := s.hydrateStartedAt(&r); err != nil {
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

func (s *SQLiteStore) ClearLogs(runID string) error {
	_, err := s.Conn.Exec("DELETE FROM execution_logs WHERE run_id = ?", runID)
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
