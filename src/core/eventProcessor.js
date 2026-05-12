const { createTask, updateTaskStatus } = require('./transferLifecycleEngine');
const { allocatePlannedStock, verifyPhysicalReceipt } = require('./inventoryStateEngine');
const { acquireLock, releaseLock } = require('./distributedLockEngine');
const { publishTransferTaskCreated } = require('./transferWorkflowOrchestrator');

const DEFAULT_LOCK_MS = 30000;

async function processOperationalEvent(event) {
    const payload = event.payload || {};
    const lockKey = `event-lock:${event.event_id}`;
    const lockToken = await acquireLock(lockKey, DEFAULT_LOCK_MS);

    if (!lockToken) {
        throw new Error('Unable to acquire distributed lock for event execution');
    }

    try {
        switch (event.event_type) {
            case 'TRANSFER_APPROVED':
                return await handleTransferApproved(event, payload);
            case 'TRANSFER_RECEIPT_CONFIRMED':
                return await handleTransferReceiptConfirmed(payload);
            case 'INVENTORY_MISMATCH_DETECTED':
                return await handleInventoryMismatchDetected(payload);
            default:
                console.warn(`[EVENT PROCESSOR] No handler defined for event type ${event.event_type}`);
                return null;
        }
    } finally {
        await releaseLock(lockKey, lockToken);
    }
}

async function handleTransferApproved(event, payload) {
    const { recommendation_id, source, target, sku, quantity, saga_id } = payload;

    if (!recommendation_id || !source || !target || !sku || !quantity) {
        throw new Error('TRANSFER_APPROVED event missing required payload fields');
    }

    const taskId = await createTask(recommendation_id, source, target, sku, quantity);
    await allocatePlannedStock(sku, target, quantity);

    await publishTransferTaskCreated(taskId, saga_id, event.correlation_id, payload);

    return { taskId, recommendation_id, sku, quantity, source, target };
}

async function handleTransferReceiptConfirmed(payload) {
    const { task_id, sku, location_id, quantity } = payload;

    if (!task_id || !sku || !location_id || !quantity) {
        throw new Error('TRANSFER_RECEIPT_CONFIRMED event missing required payload fields');
    }

    await verifyPhysicalReceipt(sku, location_id, quantity);
    await updateTaskStatus(task_id, 'VERIFIED');

    return { task_id, sku, location_id, quantity };
}

async function handleInventoryMismatchDetected(payload) {
    console.warn('[EVENT PROCESSOR] Inventory mismatch detected, reconciliation task scheduled.', payload);
    return { reconciliation: 'pending', details: payload };
}

module.exports = {
    processOperationalEvent
};
