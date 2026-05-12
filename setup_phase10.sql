-- Phase 10: Distributed Event Infrastructure and Operational Resilience Schema

CREATE TABLE IF NOT EXISTS operational_event_store (
    event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(128) NOT NULL,
    source_service VARCHAR(128) NOT NULL,
    payload JSON,
    timestamp DATETIME NOT NULL,
    retry_count INT DEFAULT 0,
    status VARCHAR(64) DEFAULT 'PENDING',
    correlation_id VARCHAR(128),
    idempotency_key VARCHAR(255),
    version VARCHAR(32) DEFAULT 'v1',
    last_error TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_retry_queue (
    event_id VARCHAR(64) PRIMARY KEY,
    retry_count INT NOT NULL,
    next_attempt_at DATETIME NOT NULL,
    last_error TEXT,
    status VARCHAR(32) DEFAULT 'PENDING'
);

CREATE TABLE IF NOT EXISTS dead_letter_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(128) NOT NULL,
    source_service VARCHAR(128) NOT NULL,
    payload JSON,
    timestamp DATETIME NOT NULL,
    correlation_id VARCHAR(128),
    last_error TEXT,
    version VARCHAR(32),
    moved_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS distributed_lock_tracking (
    lock_key VARCHAR(255) PRIMARY KEY,
    lock_token VARCHAR(255),
    acquired_at DATETIME NOT NULL,
    expires_at DATETIME NOT NULL,
    owner VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS inventory_reconciliation_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    issue_type VARCHAR(128),
    source_reference VARCHAR(255),
    payload JSON,
    detected_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS event_consistency_audits (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(64),
    payload JSON,
    drift_detected TINYINT(1) DEFAULT 0,
    audit_time DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_saga_tracking (
    saga_id VARCHAR(128) PRIMARY KEY,
    workflow_type VARCHAR(128),
    payload JSON,
    status VARCHAR(64) DEFAULT 'STARTED',
    started_at DATETIME NOT NULL,
    completed_at DATETIME,
    rollback_reason TEXT
);

CREATE TABLE IF NOT EXISTS marketplace_sync_failures (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    marketplace VARCHAR(128),
    payload JSON,
    failure_reason TEXT,
    occurred_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS operational_event_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(128),
    metric_value VARCHAR(255),
    metadata JSON,
    recorded_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS system_recovery_checkpoints (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    checkpoint_id VARCHAR(128),
    payload JSON,
    created_at DATETIME NOT NULL
);
