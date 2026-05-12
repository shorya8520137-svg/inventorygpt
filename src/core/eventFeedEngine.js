// src/core/eventFeedEngine.js
const pool = require('../config/db');

async function getEventFeed() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                event_id,
                event_type,
                severity,
                message,
                metadata,
                created_at
            FROM operational_event_feed
            ORDER BY created_at DESC
            LIMIT 50
        `);
        return rows;
    } catch (e) {
        console.warn("Offline mode: Simulated Event Feed");
        return [
            { event_id: 1, event_type: 'VIP_OVERRIDE', severity: 'WARNING', message: 'Emergency warehouse fulfillment approved despite negative shipment margin due to VIP customer retention policy.', created_at: new Date() },
            { event_id: 2, event_type: 'PREDICTION_ALERT', severity: 'CRITICAL', message: 'Predicted stockout risk increased to CRITICAL for FESTIVAL-LIGHTS in Warehouse A.', created_at: new Date(Date.now() - 300000) },
            { event_id: 3, event_type: 'TRANSFER_DELAYED', severity: 'WARNING', message: 'Warehouse South transfer delayed 6 hours.', created_at: new Date(Date.now() - 600000) },
            { event_id: 4, event_type: 'VERIFICATION_PENDING', severity: 'INFO', message: 'Transfer verification pending for TASK-12345.', created_at: new Date(Date.now() - 900000) },
            { event_id: 5, event_type: 'MARKETPLACE_SPIKE', severity: 'INFO', message: 'Marketplace demand spike detected in Northern Region.', created_at: new Date(Date.now() - 1200000) }
        ];
    }
}

module.exports = { getEventFeed };
