const crypto = require('crypto');
const redis = require('../config/redis');
const pool = require('../config/db');
const { processOperationalEvent } = require('./eventProcessor');
const { scheduleRetryIfNeeded, retryDueEvents } = require('./retryRecoveryEngine');
const { moveToDeadLetter } = require('./deadLetterQueueEngine');

const STREAM_NAME = process.env.EVENT_STREAM_NAME || 'inventorygpt:event-stream';
const GROUP_NAME = process.env.EVENT_CONSUMER_GROUP || 'inventorygpt-consumer-group';
const CONSUMER_NAME = `${process.env.HOSTNAME || 'inventorygpt'}-${Math.floor(Math.random() * 100000)}`;
const MAX_RETRY_ATTEMPTS = parseInt(process.env.EVENT_MAX_RETRIES || '3', 10);
const RETRY_POLL_INTERVAL_MS = parseInt(process.env.EVENT_RETRY_POLL_INTERVAL || '10000', 10);

function buildEventEntry({ eventId, eventType, sourceService, payload, correlationId, idempotencyKey, version }) {
    return {
        event_id: eventId,
        event_type: eventType,
        source_service: sourceService,
        payload: JSON.stringify(payload || {}),
        correlation_id: correlationId || eventId,
        idempotency_key: idempotencyKey || eventId,
        version: version || 'v1'
    };
}

async function createConsumerGroup() {
    try {
        await redis.xgroup('CREATE', STREAM_NAME, GROUP_NAME, '$', 'MKSTREAM');
        console.log(`[EVENT BUS] Created consumer group ${GROUP_NAME} on stream ${STREAM_NAME}`);
    } catch (error) {
        if (!error.message.includes('BUSYGROUP')) {
            console.warn('[EVENT BUS] Could not create consumer group:', error.message || error);
        }
    }
}

async function persistEventRecord(event) {
    try {
        await pool.query(
            `INSERT INTO operational_event_store 
                (event_id, event_type, source_service, payload, timestamp, retry_count, status, correlation_id, idempotency_key, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                event.eventId,
                event.eventType,
                event.sourceService,
                JSON.stringify(event.payload || {}),
                new Date(),
                0,
                'PENDING',
                event.correlationId,
                event.idempotencyKey,
                event.version
            ]
        );
    } catch (error) {
        console.warn('[EVENT BUS] Unable to persist event record, falling back to memory:', error.message || error);
    }
}

async function updateEventStatus(eventId, status, lastError = null) {
    try {
        await pool.query(
            `UPDATE operational_event_store SET status = ?, last_error = ?, updated_at = NOW() WHERE event_id = ?`,
            [status, lastError, eventId]
        );
    } catch (error) {
        console.warn('[EVENT BUS] Unable to update event status in DB:', error.message || error);
    }
}

async function getEventById(eventId) {
    try {
        const [rows] = await pool.query(`SELECT * FROM operational_event_store WHERE event_id = ?`, [eventId]);
        return rows.length ? rows[0] : null;
    } catch (error) {
        console.warn('[EVENT BUS] Unable to read event record:', error.message || error);
        return null;
    }
}

function mapRedisFields(fields) {
    const result = {};
    for (let i = 0; i < fields.length; i += 2) {
        result[fields[i]] = fields[i + 1];
    }
    return result;
}

async function publishEvent({ eventType, sourceService, payload, correlationId, idempotencyKey, version }) {
    const eventId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const event = {
        eventId,
        eventType,
        sourceService,
        payload,
        correlationId: correlationId || eventId,
        idempotencyKey: idempotencyKey || `${eventType}:${eventId}`,
        version: version || 'v1'
    };

    await persistEventRecord(event);

    const entry = buildEventEntry(event);
    await redis.xadd(STREAM_NAME, '*',
        'event_id', entry.event_id,
        'event_type', entry.event_type,
        'source_service', entry.source_service,
        'payload', entry.payload,
        'correlation_id', entry.correlation_id,
        'idempotency_key', entry.idempotency_key,
        'version', entry.version
    );
    console.log(`[EVENT BUS] Published ${eventType} event ${eventId}`);
    return event;
}

async function republishEvent(eventRows) {
    const entry = buildEventEntry({
        eventId: eventRows.event_id,
        eventType: eventRows.event_type,
        sourceService: eventRows.source_service,
        payload: JSON.parse(eventRows.payload || '{}'),
        correlationId: eventRows.correlation_id,
        idempotencyKey: eventRows.idempotency_key,
        version: eventRows.version
    });

    await redis.xadd(STREAM_NAME, '*',
        'event_id', entry.event_id,
        'event_type', entry.event_type,
        'source_service', entry.source_service,
        'payload', entry.payload,
        'correlation_id', entry.correlation_id,
        'idempotency_key', entry.idempotency_key,
        'version', entry.version
    );
    console.log(`[EVENT BUS] Republished event ${eventRows.event_id} for retry`);
}

async function ackEvent(messageId) {
    try {
        await redis.xack(STREAM_NAME, GROUP_NAME, messageId);
    } catch (error) {
        console.warn('[EVENT BUS] Failed to ACK message:', error.message || error);
    }
}

async function processStreamBatch(streamId = '>') {
    const response = await redis.xreadgroup(
        'GROUP', GROUP_NAME, CONSUMER_NAME,
        'COUNT', 5,
        'BLOCK', 2000,
        'STREAMS', STREAM_NAME,
        streamId
    );

    if (!response) {
        return;
    }

    for (const [, events] of response) {
        for (const [messageId, rawFields] of events) {
            const fields = mapRedisFields(rawFields);
            const payload = JSON.parse(fields.payload || '{}');
            const eventId = fields.event_id;
            const eventType = fields.event_type;
            const sourceService = fields.source_service;
            const correlationId = fields.correlation_id;
            const idempotencyKey = fields.idempotency_key;
            const version = fields.version || 'v1';
            const eventRecord = await getEventById(eventId);

            try {
                if (eventRecord && eventRecord.status === 'COMPLETED') {
                    await ackEvent(messageId);
                    continue;
                }

                await updateEventStatus(eventId, 'IN_PROGRESS');
                await processOperationalEvent({ event_id: eventId, event_type: eventType, source_service: sourceService, payload, correlation_id: correlationId, idempotency_key: idempotencyKey, version });
                await updateEventStatus(eventId, 'COMPLETED');
                await ackEvent(messageId);
            } catch (error) {
                console.error(`[EVENT BUS] Event processing failed for ${eventType} ${eventId}:`, error.message || error);
                const nextRetry = await scheduleRetryIfNeeded(eventId, error.message, MAX_RETRY_ATTEMPTS);
                if (!nextRetry) {
                    await moveToDeadLetter(eventId, error.message);
                }
                await ackEvent(messageId);
            }
        }
    }
}

async function processPendingMessages() {
    const response = await redis.xreadgroup(
        'GROUP', GROUP_NAME, CONSUMER_NAME,
        'COUNT', 10,
        'STREAMS', STREAM_NAME,
        '0'
    );

    if (!response) {
        return;
    }

    for (const [, events] of response) {
        for (const [messageId, rawFields] of events) {
            await processStreamBatch('0');
            break;
        }
    }
}

async function startEventConsumer() {
    setImmediate(async () => {
        while (true) {
            try {
                await processStreamBatch('>');
            } catch (error) {
                console.error('[EVENT BUS] Consumer loop error:', error.message || error);
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        }
    });
}

async function startRetryRecoveryLoop() {
    setInterval(async () => {
        try {
            const due = await retryDueEvents();
            for (const eventRows of due) {
                if (eventRows.retry_count >= MAX_RETRY_ATTEMPTS) {
                    await moveToDeadLetter(eventRows.event_id, 'Retry limit exceeded');
                    continue;
                }
                await republishEvent(eventRows);
            }
        } catch (error) {
            console.error('[EVENT BUS] Retry recovery loop error:', error.message || error);
        }
    }, RETRY_POLL_INTERVAL_MS);
}

async function initEventOrchestrator() {
    await createConsumerGroup();
    await processPendingMessages();
    startEventConsumer();
    startRetryRecoveryLoop();
}

module.exports = {
    initEventOrchestrator,
    publishEvent,
    getEventById,
    updateEventStatus,
    republishEvent,
    ackEvent
};
