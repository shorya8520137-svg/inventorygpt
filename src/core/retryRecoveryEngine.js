const pool = require('../config/db');

const DEFAULT_BACKOFF_MS = 5000;

function getBackoffDelay(retries) {
    return DEFAULT_BACKOFF_MS * Math.pow(2, retries);
}

async function scheduleRetryIfNeeded(eventId, errorMessage, maxRetries = 3) {
    try {
        const [rows] = await pool.query(`SELECT retry_count FROM operational_event_store WHERE event_id = ?`, [eventId]);
        if (!rows.length) {
            return false;
        }

        const retryCount = rows[0].retry_count || 0;
        if (retryCount + 1 > maxRetries) {
            await pool.query(`UPDATE operational_event_store SET retry_count = ?, status = ? WHERE event_id = ?`, [retryCount + 1, 'FAILED', eventId]);
            return false;
        }

        const nextAttempt = new Date(Date.now() + getBackoffDelay(retryCount));
        await pool.query(`
            INSERT INTO event_retry_queue (event_id, retry_count, next_attempt_at, last_error, status)
            VALUES (?, ?, ?, ?, 'PENDING')
            ON DUPLICATE KEY UPDATE
                retry_count = VALUES(retry_count),
                next_attempt_at = VALUES(next_attempt_at),
                last_error = VALUES(last_error),
                status = VALUES(status)
        `, [eventId, retryCount + 1, nextAttempt, errorMessage]);

        await pool.query(`UPDATE operational_event_store SET retry_count = ?, status = ? WHERE event_id = ?`, [retryCount + 1, 'RETRYING', eventId]);
        return true;
    } catch (error) {
        console.warn('[RETRY] Could not schedule retry:', error.message || error);
        return false;
    }
}

async function retryDueEvents() {
    try {
        const [rows] = await pool.query(`
            SELECT er.*,
                   oe.event_type,
                   oe.source_service,
                   oe.payload,
                   oe.correlation_id,
                   oe.idempotency_key,
                   oe.version
            FROM event_retry_queue er
            JOIN operational_event_store oe ON oe.event_id = er.event_id
            WHERE er.status = 'PENDING' AND er.next_attempt_at <= NOW()
            ORDER BY er.next_attempt_at ASC
            LIMIT 10
        `);

        return rows;
    } catch (error) {
        console.warn('[RETRY] Could not fetch retry due events:', error.message || error);
        return [];
    }
}

module.exports = {
    scheduleRetryIfNeeded,
    retryDueEvents
};
