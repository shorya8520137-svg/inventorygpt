CREATE TABLE IF NOT EXISTS ai_predictive_alerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('REGION', 'WAREHOUSE', 'SKU') NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    predicted_event TEXT NOT NULL,
    estimated_days_to_impact INT,
    confidence_score DECIMAL(5,2),
    status ENUM('active', 'mitigated', 'ignored') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
