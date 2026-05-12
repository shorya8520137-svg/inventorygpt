-- Modify the ENUM for the status column to add new lifecycle stages
ALTER TABLE ai_inventory_recommendations
MODIFY COLUMN status ENUM('pending', 'accepted', 'rejected', 'executed', 'measured', 'closed') DEFAULT 'pending';

-- Create the Outcome Engine tracking table
CREATE TABLE IF NOT EXISTS ai_recommendation_results (
    result_id INT AUTO_INCREMENT PRIMARY KEY,
    recommendation_id BIGINT(20) NOT NULL,
    confidence_score DECIMAL(5,2),
    estimated_savings DECIMAL(10,2),
    actual_savings DECIMAL(10,2),
    execution_success BOOLEAN DEFAULT FALSE,
    outcome_measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recommendation_id) REFERENCES ai_inventory_recommendations(id)
);
