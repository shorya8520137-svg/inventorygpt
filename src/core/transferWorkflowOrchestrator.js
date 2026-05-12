const { publishEvent } = require('./eventOrchestrator');
const crypto = require('crypto');

async function initiateTransferWorkflow(payload) {
    const sagaId = `TRANSFER-SAGA-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const correlationId = payload.recommendation_id || sagaId;

    try {
        const event = await publishEvent({
            eventType: 'TRANSFER_APPROVED',
            sourceService: 'transfer-workflow',
            payload: {
                ...payload,
                saga_id: sagaId,
                workflow_stage: 'APPROVAL'
            },
            correlationId,
            idempotencyKey: `TRANSFER_SAGA:${sagaId}:APPROVED`,
            version: 'v1'
        });

        console.log(`[TRANSFER WORKFLOW] Transfer saga ${sagaId} initiated with event ${event.eventId}`);
        return { sagaId, eventId: event.eventId, correlationId };
    } catch (error) {
        console.error(`[TRANSFER WORKFLOW] Failed to initiate saga:`, error.message || error);
        throw error;
    }
}

async function publishTransferTaskCreated(taskId, sagaId, correlationId, payload) {
    try {
        const event = await publishEvent({
            eventType: 'TRANSFER_TASK_CREATED',
            sourceService: 'event-processor',
            payload: {
                task_id: taskId,
                saga_id: sagaId,
                ...payload,
                workflow_stage: 'TASK_CREATED'
            },
            correlationId,
            idempotencyKey: `TRANSFER_SAGA:${sagaId}:TASK_CREATED:${taskId}`,
            version: 'v1'
        });

        console.log(`[TRANSFER WORKFLOW] Task creation event published for ${taskId}`);
        return event;
    } catch (error) {
        console.error(`[TRANSFER WORKFLOW] Failed to publish task creation event:`, error.message || error);
        throw error;
    }
}

async function publishTransferReceiptConfirmed(taskId, sagaId, correlationId, payload) {
    try {
        const event = await publishEvent({
            eventType: 'TRANSFER_RECEIPT_CONFIRMED',
            sourceService: 'transfer-workflow',
            payload: {
                task_id: taskId,
                saga_id: sagaId,
                ...payload,
                workflow_stage: 'RECEIPT_CONFIRMED'
            },
            correlationId,
            idempotencyKey: `TRANSFER_SAGA:${sagaId}:RECEIPT_CONFIRMED:${taskId}`,
            version: 'v1'
        });

        console.log(`[TRANSFER WORKFLOW] Receipt confirmation event published for ${taskId}`);
        return event;
    } catch (error) {
        console.error(`[TRANSFER WORKFLOW] Failed to publish receipt confirmation event:`, error.message || error);
        throw error;
    }
}

async function completeTransferSaga(sagaId, correlationId) {
    try {
        const event = await publishEvent({
            eventType: 'TRANSFER_SAGA_COMPLETED',
            sourceService: 'transfer-workflow',
            payload: {
                saga_id: sagaId,
                workflow_stage: 'COMPLETED'
            },
            correlationId,
            idempotencyKey: `TRANSFER_SAGA:${sagaId}:COMPLETED`,
            version: 'v1'
        });

        console.log(`[TRANSFER WORKFLOW] Saga ${sagaId} marked as completed`);
        return event;
    } catch (error) {
        console.error(`[TRANSFER WORKFLOW] Failed to mark saga complete:`, error.message || error);
        throw error;
    }
}

module.exports = {
    initiateTransferWorkflow,
    publishTransferTaskCreated,
    publishTransferReceiptConfirmed,
    completeTransferSaga
};
