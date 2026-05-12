-- setup_phase9.sql
-- Phase 9: Command Center & Operational Visibility System Tables

CREATE DATABASE IF NOT EXISTS inventory_db;
USE inventory_db;

-- 1. Operational Event Feed
CREATE TABLE IF NOT EXISTS operational_event_feed (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- e.g., 'TRANSFER_DELAYED', 'PREDICTION_ALERT', 'VIP_OVERRIDE'
    severity VARCHAR(20) DEFAULT 'INFO', -- 'INFO', 'WARNING', 'CRITICAL'
    message TEXT NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. AI Accuracy Tracking
CREATE TABLE IF NOT EXISTS ai_accuracy_tracking (
    tracking_id INT AUTO_INCREMENT PRIMARY KEY,
    agent_name VARCHAR(50) NOT NULL, -- e.g., 'REDISTRIBUTION', 'PREDICTIVE'
    total_recommendations INT DEFAULT 0,
    successful_executions INT DEFAULT 0,
    failed_executions INT DEFAULT 0,
    false_positives INT DEFAULT 0,
    false_negatives INT DEFAULT 0,
    accuracy_score DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_recommendations = 0 THEN 0.00
            ELSE (successful_executions / total_recommendations) * 100 
        END
    ) STORED,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. Transfer Timeline Events
-- Note: 'inventory_transfer_tasks' already tracks state, but this table keeps a historical log of state changes for the timeline UI.
CREATE TABLE IF NOT EXISTS transfer_timeline_events (
    timeline_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(50) NOT NULL,
    previous_state VARCHAR(50),
    new_state VARCHAR(50) NOT NULL,
    changed_by VARCHAR(50) DEFAULT 'SYSTEM',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES inventory_transfer_tasks(task_id) ON DELETE CASCADE
);

-- 4. System Observability Logs
CREATE TABLE IF NOT EXISTS system_observability_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    status_code INT,
    error_message TEXT,
    latency_ms INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Warehouse Heatmap Metrics
CREATE TABLE IF NOT EXISTS warehouse_heatmap_metrics (
    metric_id INT AUTO_INCREMENT PRIMARY KEY,
    warehouse_id VARCHAR(50) NOT NULL,
    health_score DECIMAL(5,2) DEFAULT 100.00,
    congestion_level VARCHAR(20) DEFAULT 'LOW', -- 'LOW', 'MEDIUM', 'HIGH'
    active_tasks INT DEFAULT 0,
    delayed_tasks INT DEFAULT 0,
    last_calculated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 6. Predictive Risk Tracking
CREATE TABLE IF NOT EXISTS predictive_risk_tracking (
    risk_id INT AUTO_INCREMENT PRIMARY KEY,
    entity_id VARCHAR(50) NOT NULL, -- SKU or Warehouse
    risk_type VARCHAR(50) NOT NULL, -- e.g., 'STOCKOUT', 'OVERLOAD'
    confidence_score DECIMAL(5,2),
    days_to_impact INT,
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'MITIGATED', 'IGNORED'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert dummy data for initial AI tracking to populate the dashboard visually
INSERT IGNORE INTO ai_accuracy_tracking (agent_name, total_recommendations, successful_executions, failed_executions)
VALUES 
('Redistribution Agent', 145, 132, 13),
('Marketplace Agent', 89, 78, 11),
('Predictive Agent', 54, 48, 6),
('Warehouse Risk Agent', 30, 27, 3);
