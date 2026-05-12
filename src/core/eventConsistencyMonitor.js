const pool = require('../config/db');

async function auditConsistency(payload) {
    try {
        await pool.query(`
            INSERT INTO event_consistency_audits
            (event_id, payload, drift_detected, audit_time)
            VALUES (?, ?, ?, NOW())
        `, [payload.event_id || null, JSON.stringify(payload), payload.drift_detected ? 1 : 0]);
    } catch (error) {
        console.warn('[CONSISTENCY] Could not create audit record:', error.message || error);
    }
}

async function detectDrift() {
    return { status: 'idle', drift_detected: false };
}

module.exports = {
    auditConsistency,
    detectDrift
};
