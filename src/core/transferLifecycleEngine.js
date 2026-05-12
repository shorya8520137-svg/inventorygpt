// src/core/transferLifecycleEngine.js
const pool = require('../config/db');

async function createTask(recommendationId, source, target, sku, quantity) {
    const taskId = 'TASK-' + Date.now();
    try {
        await pool.query(`
            INSERT INTO inventory_transfer_tasks 
            (task_id, recommendation_id, source_warehouse, target_destination, sku, quantity, status) 
            VALUES (?, ?, ?, ?, ?, ?, 'TASK_CREATED')
        `, [taskId, recommendationId, source, target, sku, quantity]);
        return taskId;
    } catch (e) {
        console.warn("Offline mode: Simulated Task Creation");
        return 'MOCK_TASK_' + Date.now();
    }
}

async function updateTaskStatus(taskId, status) {
    try {
        await pool.query(`UPDATE inventory_transfer_tasks SET status = ? WHERE task_id = ?`, [status, taskId]);
    } catch (e) {
        console.warn("Offline mode: Simulated Task Update");
    }
}

module.exports = { createTask, updateTaskStatus };
