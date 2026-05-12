-- Table to track Agent Accuracy History
CREATE TABLE IF NOT EXISTS ai_recommendation_accuracy (
    agent_type VARCHAR(100) PRIMARY KEY,
    total_recommendations INT DEFAULT 0,
    successful_executions INT DEFAULT 0,
    running_accuracy_score DECIMAL(5,2) DEFAULT 100.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table to track Warehouse Reputation and Reliability
CREATE TABLE IF NOT EXISTS ai_warehouse_reputation (
    warehouse_id VARCHAR(100) PRIMARY KEY,
    health_score INT DEFAULT 100,
    delay_risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'LOW',
    rto_risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'LOW',
    operational_stability ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'HIGH',
    last_evaluated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table to store raw Operational Memory (Context Injection)
CREATE TABLE IF NOT EXISTS ai_operational_memory (
    memory_id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('REGION', 'WAREHOUSE', 'SKU', 'COURIER') NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    pattern_description TEXT NOT NULL,
    confidence_in_pattern DECIMAL(5,2) DEFAULT 90.00,
    first_detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed Initial Agent Accuracies
INSERT IGNORE INTO ai_recommendation_accuracy (agent_type) VALUES 
('REDISTRIBUTION'), 
('DEAD_STOCK'), 
('MARKETPLACE'), 
('WAREHOUSE_RISK');
