// src/core/transferTimelineService.js
const pool = require('../config/db');

async function getTransferTimeline() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                task_id,
                recommendation_id,
                source_location,
                target_location,
                sku,
                quantity,
                lifecycle_state,
                created_at,
                updated_at
            FROM inventory_transfer_tasks
            ORDER BY created_at DESC
            LIMIT 50
        `);
        return rows;
    } catch (e) {
        console.warn("Offline mode: Simulated Transfer Timeline");
        return [
            { task_id: 'TASK-1001', recommendation_id: 121, source_location: 'Warehouse A', target_location: 'Warehouse B', sku: 'FESTIVAL-LIGHTS', quantity: 50, lifecycle_state: 'COMPLETED', created_at: new Date(Date.now() - 86400000), updated_at: new Date() },
            { task_id: 'TASK-1002', recommendation_id: 122, source_location: 'Warehouse South', target_location: 'Warehouse North', sku: 'SUMMER-FAN', quantity: 100, lifecycle_state: 'IN_TRANSIT', created_at: new Date(Date.now() - 3600000), updated_at: new Date() },
            { task_id: 'TASK-1003', recommendation_id: 123, source_location: 'Warehouse East', target_location: 'Warehouse West', sku: 'WINTER-HEATER', quantity: 30, lifecycle_state: 'FAILED', created_at: new Date(Date.now() - 7200000), updated_at: new Date() },
            { task_id: 'TASK-1004', recommendation_id: 124, source_location: 'Warehouse A', target_location: 'Warehouse C', sku: 'DESK-CHAIR', quantity: 20, lifecycle_state: 'RECOMMENDED', created_at: new Date(), updated_at: new Date() }
        ];
    }
}

module.exports = { getTransferTimeline };
