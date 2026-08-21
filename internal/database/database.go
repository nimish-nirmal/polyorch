package database

import (
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
	"golang.org/x/crypto/bcrypt"
)

type DB struct {
	Conn *sql.DB
}

func Open(dbPath string) (*DB, error) {
	conn, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(5)

	if _, err := conn.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, err
	}
	if _, err := conn.Exec("PRAGMA busy_timeout=5000"); err != nil {
		return nil, err
	}

	if err := conn.Ping(); err != nil {
		return nil, err
	}

	if err := runMigrations(conn); err != nil {
		return nil, err
	}

	if err := seedDefaultUser(conn); err != nil {
		return nil, err
	}

	return &DB{Conn: conn}, nil
}

func seedDefaultUser(conn *sql.DB) error {
	var count int
	if err := conn.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	_, err = conn.Exec(
		"INSERT INTO users (username, password_hash, must_reset) VALUES (?, ?, ?)",
		"admin", string(hash), true,
	)
	return err
}

func runMigrations(conn *sql.DB) error {
	schema := `
CREATE TABLE IF NOT EXISTS projects (
	project_id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_versions (
	version_id TEXT PRIMARY KEY,
	project_id TEXT NOT NULL,
	version_tag TEXT NOT NULL,
	manifest_json TEXT NOT NULL,
	files_bundle BLOB NOT NULL,
	is_active BOOLEAN DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE TABLE IF NOT EXISTS workflow_runs (
	run_id TEXT PRIMARY KEY,
	version_id TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending',
	started_at DATETIME,
	finished_at DATETIME,
	FOREIGN KEY (version_id) REFERENCES project_versions(version_id)
);

CREATE TABLE IF NOT EXISTS execution_logs (
	log_id INTEGER PRIMARY KEY AUTOINCREMENT,
	run_id TEXT NOT NULL,
	stream_type TEXT NOT NULL,
	message TEXT NOT NULL,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (run_id) REFERENCES workflow_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_runs_status ON workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_logs_run_id ON execution_logs(run_id);

CREATE TABLE IF NOT EXISTS users (
	user_id INTEGER PRIMARY KEY AUTOINCREMENT,
	username TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	must_reset BOOLEAN DEFAULT 0,
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
	updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`
	_, err := conn.Exec(schema)
	return err
}
