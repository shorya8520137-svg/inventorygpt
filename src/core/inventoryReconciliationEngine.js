const pool = require('../config/db');

async function logReconciliationIssue(payload) {
    try {
        await pool.query(`
            INSERT INTO inventory_reconciliation_logs
            (issue_type, source_reference, payload, detected_at)
            VALUES (?, ?, ?, NOW())
        `, [payload.issue_type || 'UNKNOWN', payload.reference || null, JSON.stringify(payload)]);
    } catch (error) {
        console.warn('[RECONCILIATION] Could not log reconciliation issue:', error.message || error);
    }
}

async function reconcileMismatch(payload) {
    try {
        await logReconciliationIssue(payload);
        return { status: 'scheduled', payload };
    } catch (error) {
        console.warn('[RECONCILIATION] Reconciliation failed to schedule:', error.message || error);
        return { status: 'error', error: error.message };
    }
}

module.exports = {
    logReconciliationIssue,
    reconcileMismatch
};
