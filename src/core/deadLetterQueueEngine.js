const pool = require('../config/db');

async function moveToDeadLetter(eventId, failureReason) {
    try {
        const [rows] = await pool.query(`SELECT * FROM operational_event_store WHERE event_id = ?`, [eventId]);
        if (!rows.length) {
            return;
        }

        const event = rows[0];
        await pool.query(`
            INSERT INTO dead_letter_events
            (event_id, event_type, source_service, payload, timestamp, correlation_id, last_error, version)
            VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
        `, [
            event.event_id,
            event.event_type,
            event.source_service,
            event.payload,
            event.correlation_id,
            failureReason,
            event.version
        ]);
        await pool.query(`UPDATE operational_event_store SET status = 'FAILED_DLQ', last_error = ? WHERE event_id = ?`, [failureReason, eventId]);
    } catch (error) {
        console.warn('[DLQ] Could not move event to dead letter queue:', error.message || error);
    }
}

module.exports = {
    moveToDeadLetter
};
