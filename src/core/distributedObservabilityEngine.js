const pool = require('../config/db');

async function recordEventMetric(metricName, value, metadata = {}) {
    try {
        await pool.query(`
            INSERT INTO operational_event_metrics (metric_name, metric_value, metadata, recorded_at)
            VALUES (?, ?, ?, NOW())
        `, [metricName, value, JSON.stringify(metadata)]);
    } catch (error) {
        console.warn('[OBSERVABILITY] Could not write metric:', error.message || error);
    }
}

async function getEventHealth() {
    try {
        const [rows] = await pool.query(`SELECT metric_name, metric_value, metadata, recorded_at FROM operational_event_metrics ORDER BY recorded_at DESC LIMIT 50`);
        return rows;
    } catch (error) {
        console.warn('[OBSERVABILITY] Could not read metrics:', error.message || error);
        return [];
    }
}

module.exports = {
    recordEventMetric,
    getEventHealth
};
