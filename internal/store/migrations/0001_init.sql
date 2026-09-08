CREATE TABLE jobs (
    id            TEXT PRIMARY KEY,
    tool_id       TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('queued','running','done','failed','canceled')),
    input_json    TEXT NOT NULL,
    output_json   TEXT,
    error         TEXT,
    progress      REAL NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created ON jobs(created_at);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE backups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id     TEXT NOT NULL,
    path       TEXT NOT NULL,
    content    BLOB,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX idx_backups_job ON backups(job_id);
