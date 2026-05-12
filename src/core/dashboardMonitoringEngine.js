const pool = require('../config/db');

async function getRetryQueueStatus() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                er.event_id,
                oe.event_type,
                er.retry_count,
                er.next_attempt_at,
                er.last_error,
                er.status,
                oe.correlation_id
            FROM event_retry_queue er
            JOIN operational_event_store oe ON oe.event_id = er.event_id
            ORDER BY er.next_attempt_at ASC
            LIMIT 50
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch retry queue status:', error.message || error);
        return [];
    }
}

async function getDeadLetterQueueStatus() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                event_id,
                event_type,
                source_service,
                last_error,
                moved_at,
                correlation_id
            FROM dead_letter_events
            ORDER BY moved_at DESC
            LIMIT 50
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch dead-letter queue status:', error.message || error);
        return [];
    }
}

async function getEventLatencyMetrics() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                event_type,
                COUNT(*) as total_events,
                AVG(TIMESTAMPDIFF(SECOND, timestamp, updated_at)) as avg_latency_seconds,
                MAX(TIMESTAMPDIFF(SECOND, timestamp, updated_at)) as max_latency_seconds,
                MIN(TIMESTAMPDIFF(SECOND, timestamp, updated_at)) as min_latency_seconds,
                status
            FROM operational_event_store
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
            GROUP BY event_type, status
            ORDER BY event_type, status
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch event latency metrics:', error.message || error);
        return [];
    }
}

async function getSynchronizationDriftAlerts() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                id,
                event_id,
                payload,
                drift_detected,
                audit_time
            FROM event_consistency_audits
            WHERE drift_detected = 1
            ORDER BY audit_time DESC
            LIMIT 50
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch sync drift alerts:', error.message || error);
        return [];
    }
}

async function getWorkflowSagaStatus() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                saga_id,
                workflow_type,
                status,
                started_at,
                completed_at,
                rollback_reason
            FROM workflow_saga_tracking
            ORDER BY started_at DESC
            LIMIT 50
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch saga status:', error.message || error);
        return [];
    }
}

async function getEventStoreHealthSummary() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                status,
                COUNT(*) as count,
                MAX(updated_at) as last_update
            FROM operational_event_store
            GROUP BY status
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch event store health:', error.message || error);
        return [];
    }
}

async function getReconciliationStatus() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                issue_type,
                COUNT(*) as occurrence_count,
                MAX(detected_at) as last_detected
            FROM inventory_reconciliation_logs
            WHERE detected_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY issue_type
            ORDER BY occurrence_count DESC
        `);
        return rows;
    } catch (error) {
        console.warn('[DASHBOARD] Could not fetch reconciliation status:', error.message || error);
        return [];
    }
}

module.exports = {
    getRetryQueueStatus,
    getDeadLetterQueueStatus,
    getEventLatencyMetrics,
    getSynchronizationDriftAlerts,
    getWorkflowSagaStatus,
    getEventStoreHealthSummary,
    getReconciliationStatus
};
