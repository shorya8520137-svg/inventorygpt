-- Phase 8 Database Schema

CREATE TABLE IF NOT EXISTS inventory_transfer_tasks (
    task_id VARCHAR(50) PRIMARY KEY,
    recommendation_id BIGINT,
    source_warehouse VARCHAR(100),
    target_destination VARCHAR(100),
    sku VARCHAR(100),
    quantity INT,
    status ENUM('RECOMMENDED', 'APPROVED', 'TASK_CREATED', 'DISPATCH_PENDING', 'DISPATCHED', 'IN_TRANSIT', 'RECEIVED', 'VERIFIED', 'COMPLETED', 'FAILED', 'CANCELLED', 'DELAYED') DEFAULT 'RECOMMENDED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_state_tracking (
    sku VARCHAR(100),
    location_id VARCHAR(100),
    physical_stock INT DEFAULT 0,
    planned_stock INT DEFAULT 0,
    in_transit_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    sellable_stock INT DEFAULT 0,
    last_verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(sku, location_id)
);

CREATE TABLE IF NOT EXISTS customer_loyalty_scores (
    customer_id VARCHAR(50) PRIMARY KEY,
    lifetime_value DECIMAL(10,2),
    loyalty_duration_days INT,
    retention_probability DECIMAL(5,2),
    loyalty_tier ENUM('STANDARD', 'VIP', 'PLATINUM') DEFAULT 'STANDARD'
);

CREATE TABLE IF NOT EXISTS fulfillment_economic_analysis (
    analysis_id INT AUTO_INCREMENT PRIMARY KEY,
    task_id VARCHAR(50),
    product_margin DECIMAL(10,2),
    transfer_cost DECIMAL(10,2),
    net_profit DECIMAL(10,2),
    economically_viable BOOLEAN,
    loyalty_override_applied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mock Data for Testing Overrides
INSERT IGNORE INTO customer_loyalty_scores (customer_id, lifetime_value, loyalty_duration_days, retention_probability, loyalty_tier) VALUES
('CUST-STD-001', 50.00, 30, 45.00, 'STANDARD'),
('CUST-VIP-999', 15000.00, 1095, 99.00, 'VIP');

INSERT IGNORE INTO inventory_state_tracking (sku, location_id, physical_stock, planned_stock, in_transit_stock, reserved_stock, sellable_stock) VALUES
('FESTIVAL-LIGHTS', 'Warehouse A', 500, 0, 0, 0, 500),
('FESTIVAL-LIGHTS', 'Warehouse B', 10, 0, 0, 0, 10);
