const pool = require('../config/db');

async function createSaga(sagaId, workflowType, payload) {
    try {
        await pool.query(`
            INSERT INTO workflow_saga_tracking 
            (saga_id, workflow_type, payload, status, started_at)
            VALUES (?, ?, ?, 'STARTED', NOW())
        `, [sagaId, workflowType, JSON.stringify(payload)]);
    } catch (error) {
        console.warn('[SAGA] Could not create saga record:', error.message || error);
    }
}

async function completeSaga(sagaId) {
    try {
        await pool.query(`
            UPDATE workflow_saga_tracking SET status = 'COMPLETED', completed_at = NOW() WHERE saga_id = ?
        `, [sagaId]);
    } catch (error) {
        console.warn('[SAGA] Could not mark saga complete:', error.message || error);
    }
}

async function rollbackSaga(sagaId, reason) {
    try {
        await pool.query(`
            UPDATE workflow_saga_tracking SET status = 'ROLLED_BACK', rollback_reason = ?, completed_at = NOW() WHERE saga_id = ?
        `, [reason, sagaId]);
    } catch (error) {
        console.warn('[SAGA] Could not rollback saga:', error.message || error);
    }
}

module.exports = {
    createSaga,
    completeSaga,
    rollbackSaga
};
