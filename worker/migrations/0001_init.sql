-- JD Concierge D1 Schema
-- Stores submissions for continuous improvement

-- Submissions table: stores each analysis request and response
CREATE TABLE IF NOT EXISTS submissions (
  request_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  jd_text TEXT NOT NULL,
  jd_text_len INTEGER NOT NULL,
  jd_sha256 TEXT NOT NULL,
  origin TEXT,
  user_agent_hash TEXT,
  scorer_version TEXT NOT NULL,
  score INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  evidence_count INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  rate_limited INTEGER NOT NULL DEFAULT 0,
  validation_error TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_submissions_jd_sha256 ON submissions(jd_sha256);
CREATE INDEX IF NOT EXISTS idx_submissions_score ON submissions(score);
CREATE INDEX IF NOT EXISTS idx_submissions_confidence ON submissions(confidence);

-- Labels table: for manual annotation and continuous improvement
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  label_type TEXT NOT NULL,
  label_value TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY(request_id) REFERENCES submissions(request_id)
);

-- Index for label lookups
CREATE INDEX IF NOT EXISTS idx_labels_request_id ON labels(request_id);
CREATE INDEX IF NOT EXISTS idx_labels_created_at ON labels(created_at);
