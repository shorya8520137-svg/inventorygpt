# Phase 10 Architecture Diagram

## System Component Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         InventoryGPT Phase 10 Architecture                          │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              API Layer (Express.js)                                   │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  POST /api/execution/create-transfer-task                                      │  │
│  │  POST /api/execution/verify-physical-receipt                                   │  │
│  │  POST /api/events/publish                                                      │  │
│  │  GET  /api/dashboard/retry-queue                                               │  │
│  │  GET  /api/dashboard/dead-letter-queue                                         │  │
│  │  GET  /api/dashboard/event-latency-metrics                                     │  │
│  │  GET  /api/dashboard/sync-drift-alerts                                         │  │
│  │  GET  /api/dashboard/workflow-sagas                                            │  │
│  │  GET  /api/dashboard/event-store-health                                        │  │
│  │  GET  /api/dashboard/reconciliation-status                                     │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                          Workflow & Saga Orchestration                               │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  transferWorkflowOrchestrator.js                                               │  │
│  │  ├─ initiateTransferWorkflow()                                                 │  │
│  │  ├─ publishTransferTaskCreated()                                               │  │
│  │  ├─ publishTransferReceiptConfirmed()                                          │  │
│  │  └─ completeTransferSaga()                                                     │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                     Event Orchestration & Message Bus Layer                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Redis Streams (inventorygpt:event-stream)                                     │  │
│  │                                                                                │  │
│  │  EVENT PRODUCER                          EVENT CONSUMER                       │  │
│  │  ┌──────────────────────┐                ┌──────────────────────┐             │  │
│  │  │ publishEvent()       │ ────XADD────→ │ Redis Stream         │             │  │
│  │  │ - Generate ID        │                │ Consumer Group:      │             │  │
│  │  │ - Persist to DB      │                │ inventorygpt-consumer│             │  │
│  │  │ - Add to Stream      │                │                      │             │  │
│  │  └──────────────────────┘                │ processStreamBatch() │             │  │
│  │                                          │ - Read events        │             │  │
│  │                                          │ - Acquire lock       │             │  │
│  │                                          │ - Process event      │             │  │
│  │                                          │ - Update status      │             │  │
│  │                                          │ - ACK message        │             │  │
│  │                                          └──────────────────────┘             │  │
│  │                                                    │                          │  │
│  │                                                    ▼                          │  │
│  │  RETRY RECOVERY LOOP              DEAD LETTER QUEUE                          │  │
│  │  ┌──────────────────────┐         ┌──────────────────────┐                   │  │
│  │  │ retryDueEvents()     │         │ moveToDeadLetter()   │                   │  │
│  │  │ - Query retry queue  │         │ - Max retries hit    │                   │  │
│  │  │ - Exponential backoff│ ──────→ │ - Move to DLQ table  │                   │  │
│  │  │ - republishEvent()   │         │ - Generate alert     │                   │  │
│  │  │ (Every 10 seconds)   │         │ - Preserve payload   │                   │  │
│  │  └──────────────────────┘         └──────────────────────┘                   │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                      Event Processing & Lock Management                              │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  eventProcessor.js                                                             │  │
│  │                                                                                │  │
│  │  processOperationalEvent(event)                                               │  │
│  │  ├─ acquireLock(distributed lock)                                             │  │
│  │  ├─ switch(event.event_type):                                                 │  │
│  │  │  ├─ TRANSFER_APPROVED:                                                     │  │
│  │  │  │  ├─ createTask()                                                        │  │
│  │  │  │  ├─ allocatePlannedStock()                                              │  │
│  │  │  │  └─ publishTransferTaskCreated()                                        │  │
│  │  │  ├─ TRANSFER_RECEIPT_CONFIRMED:                                            │  │
│  │  │  │  ├─ verifyPhysicalReceipt()                                             │  │
│  │  │  │  └─ updateTaskStatus(VERIFIED)                                         │  │
│  │  │  └─ INVENTORY_MISMATCH_DETECTED:                                           │  │
│  │  │     └─ logReconciliationIssue()                                            │  │
│  │  └─ releaseLock()                                                             │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
│  Distributed Lock Engine (Redis)                                                    │
│  ├─ acquireLock(lockKey, TTL)  → NX SET + TTL                                      │
│  └─ releaseLock(lockKey, token) → Lua script for safety                            │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                      Core Business Logic (Existing Modules)                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  transferLifecycleEngine.js                                                    │  │
│  │  ├─ createTask() → inventory_transfer_tasks                                    │  │
│  │  └─ updateTaskStatus()                                                        │  │
│  │                                                                                │  │
│  │  inventoryStateEngine.js                                                       │  │
│  │  ├─ allocatePlannedStock() → inventory_state_tracking (planned_stock++)       │  │
│  │  └─ verifyPhysicalReceipt() → inventory_state_tracking (physical_stock++)     │  │
│  │                                                                                │  │
│  │  fulfillmentEconomicsEngine.js                                                 │  │
│  │  └─ evaluateEconomicViability()                                               │  │
│  │                                                                                │  │
│  │  customerLoyaltyEngine.js                                                      │  │
│  │  └─ evaluateLoyaltyOverride()                                                 │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                           Database Persistence Layer                                 │
│  ┌────────────────────────────────────────────────────────────────────────────────┐  │
│  │  MySQL Tables                                                                  │  │
│  │                                                                                │  │
│  │  EVENT STORE                  RETRY MANAGEMENT      TRACKING                 │  │
│  │  ├─ operational_               ├─ event_retry_      ├─ workflow_saga_        │  │
│  │  │  event_store               │  queue              │  tracking              │  │
│  │  │  (all events)              ├─ dead_letter_      ├─ distributed_lock_     │  │
│  │  └─ operational_               │  events            │  tracking              │  │
│  │     event_metrics             └─ (DLQ)             └─ (lock state)          │  │
│  │     (metrics)                                                                │  │
│  │                                RECONCILIATION       EXISTING                 │  │
│  │                                ├─ inventory_        ├─ inventory_transfer_  │  │
│  │                                │  reconciliation_   │  tasks                │  │
│  │                                │  logs              ├─ inventory_state_     │  │
│  │                                ├─ event_           │  tracking              │  │
│  │                                │  consistency_     └─ (existing tables)     │  │
│  │                                │  audits                                    │  │
│  │                                └─ marketplace_                              │  │
│  │                                   sync_failures                             │  │
│  └────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Event Processing Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE TRANSFER EVENT FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

USER ACTION
    │
    ▼ (POST /api/execution/create-transfer-task)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. API Handler (server.js)                                                  │
│    ├─ Validate request parameters                                           │
│    ├─ evaluateEconomicViability()                                          │
│    ├─ evaluateLoyaltyOverride() [if not viable]                           │
│    └─ return error if NOT approved                                        │
└─────────────────────────────────────────────────────────────────────────────┘
    │ (if approved)
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. Workflow Orchestrator                                                    │
│    initiateTransferWorkflow(payload)                                        │
│    ├─ Generate sagaId + correlationId                                      │
│    └─ publishEvent(TRANSFER_APPROVED)                                      │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. Event Orchestrator (publishEvent)                                        │
│    ├─ Generate eventId (UUID)                                              │
│    ├─ Persist to operational_event_store (status: PENDING)                │
│    └─ XADD to Redis Stream                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼ (Response to user with sagaId + eventId)
 200 OK
    │
    ▼ (Background: Event Consumer Loop running)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. Consumer (XREADGROUP from Redis Stream)                                 │
│    ├─ BLOCK 2000ms waiting for new events                                 │
│    ├─ Retrieve message from stream                                         │
│    └─ Call processStreamBatch()                                            │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. Event Processor (processOperationalEvent)                               │
│    ├─ acquireLock(event-lock:eventId, 30s TTL)                            │
│    │   └─ if FAILED: throw error, event will be retried                   │
│    ├─ switch(event.event_type)                                            │
│    │   └─ case TRANSFER_APPROVED:                                         │
│    │       └─ handleTransferApproved(payload)                             │
│    └─ releaseLock()                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 6. Handle Transfer Approved                                                │
│    handleTransferApproved(payload)                                         │
│    ├─ createTask(recomm_id, source, target, sku, qty)                    │
│    │   └─ INSERT INTO inventory_transfer_tasks                            │
│    │       (status: TASK_CREATED)                                         │
│    ├─ allocatePlannedStock(sku, target, qty)                             │
│    │   └─ UPDATE inventory_state_tracking                                 │
│    │       (planned_stock += qty)                                         │
│    └─ publishTransferTaskCreated()                                        │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 7. Publish Secondary Event                                                 │
│    publishEvent(TRANSFER_TASK_CREATED)                                    │
│    ├─ Persist to operational_event_store                                  │
│    └─ XADD to Redis Stream                                                │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 8. Update Original Event Status                                           │
│    updateEventStatus(eventId, COMPLETED)                                  │
│    └─ UPDATE operational_event_store SET status = COMPLETED              │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 9. Acknowledge Message                                                     │
│    ackEvent(messageId)                                                     │
│    └─ XACK stream group consumer messageId                               │
│       (removes from pending entries list)                                │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼ (Meanwhile: Physical transfer happening in warehouse)
    │
    ▼ (Later: Physical receipt verification)
┌─────────────────────────────────────────────────────────────────────────────┐
│ 10. Physical Receipt Verification (user action)                           │
│     POST /api/execution/verify-physical-receipt                           │
│     {task_id, sku, location_id, quantity}                                │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 11. Publish Receipt Confirmation Event                                     │
│     publishEvent(TRANSFER_RECEIPT_CONFIRMED)                              │
│     ├─ Persist to event store                                             │
│     └─ XADD to Redis Stream                                               │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 12. Consumer Processes Receipt Confirmation                               │
│     handleTransferReceiptConfirmed(payload)                              │
│     ├─ verifyPhysicalReceipt(sku, location_id, qty)                      │
│     │   └─ UPDATE inventory_state_tracking                                │
│     │       (physical_stock += qty, planned_stock -= qty)                 │
│     └─ updateTaskStatus(task_id, VERIFIED)                              │
└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
 ✓ TRANSFER COMPLETE
```

## Error & Retry Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      ERROR HANDLING & RETRY FLOW                          │
└──────────────────────────────────────────────────────────────────────────┘

EVENT PROCESSING ERROR
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Event Processor Exception Caught                                         │
│ ├─ updateEventStatus(eventId, IN_PROGRESS)                             │
│ └─ throw error                                                          │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Catch Block in processStreamBatch()                                     │
│ ├─ Log error                                                            │
│ └─ scheduleRetryIfNeeded(eventId, error)                              │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Check: retry_count < MAX_RETRIES (3)?                                  │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ├─── YES ─────────────────────────────────────┬─── NO ──────────────┐
    │                                             │                      │
    ▼                                             ▼                      ▼
┌──────────────────────────┐          ┌──────────────────────┐   ┌──────────────┐
│ Schedule Retry           │          │ moveToDeadLetter()   │   │ (impossible) │
│ ├─ Calculate backoff:    │          │ ├─ Move to DLQ table│   └──────────────┘
│ │  5s ^ (retry_count+1)  │          │ ├─ status=FAILED_DLQ
│ │  = 5s, 10s, 20s, 40s   │          │ ├─ Preserve payload
│ ├─ INSERT event_retry_   │          │ └─ Alert operator
│ │  queue (PENDING)       │          └──────────────────────┘
│ ├─ next_attempt_at set   │
│ │  to: NOW + backoff     │
│ └──────────────────────────┘
    │                                  
    ▼ (Wait for next_attempt_at)
┌──────────────────────────────────────────────────────────────────────────┐
│ Retry Recovery Loop (every 10 seconds)                                   │
│ retryDueEvents()                                                         │
│ ├─ Query: WHERE next_attempt_at <= NOW() AND status = PENDING          │
│ └─ republishEvent() for each due event                                 │
└──────────────────────────────────────────────────────────────────────────┘
    │
    ▼ (Event re-added to Redis Stream)
┌──────────────────────────────────────────────────────────────────────────┐
│ Consumer processes event again                                           │
│ ├─ retry_count increments                                              │
│ └─ Same handler called again                                           │
└──────────────────────────────────────────────────────────────────────────┘
    │
    ├─ Success: Event COMPLETED, moved forward ✓
    │
    └─ Still Fails: Go back to "Check: retry_count < MAX_RETRIES?"
       └─ If retry_count = 3 now, move to DLQ ✗
```

## Concurrency Protection Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│             DISTRIBUTED LOCK PREVENTS CONCURRENT MUTATIONS                │
└──────────────────────────────────────────────────────────────────────────┘

SCENARIO: Two events for SAME SKU at SAME warehouse

Event A: TRANSFER_APPROVED (SKU-001 to WH-SOUTH)
Event B: TRANSFER_APPROVED (SKU-001 to WH-SOUTH)

Timeline:
─────────────────────────────────────────────────────────────────────────

[T=0ms] Event A arrives in stream
[T=10ms] Event B arrives in stream

Consumer Process 1                   Consumer Process 2 (parallel)
    │                                       │
    ├─ Read Event A                         ├─ Read Event B
    │                                       │
    ├─ acquireLock(event-lock:A, 30s)       │
    │    ✓ SUCCESS (NX SET)                 │
    │                                       ├─ acquireLock(event-lock:B, 30s)
    ├─ Lock acquired!                       │    ✓ SUCCESS (NX SET)
    │                                       │
    ├─ handleTransferApproved(A):           ├─ handleTransferApproved(B):
    │  ├─ createTask(A)                     │  ├─ createTask(B) ✓
    │  ├─ allocatePlannedStock(A)           │  ├─ allocatePlannedStock(B) ✓
    │  └─ publishTransferTaskCreated(A)     │  └─ publishTransferTaskCreated(B)
    │                                       │
    ├─ releaseLock(event-lock:A)            ├─ releaseLock(event-lock:B)
    │    ✓ Released                         │    ✓ Released
    │                                       │
    └─ Event A COMPLETED                    └─ Event B COMPLETED

RESULT: Both tasks created successfully, no race condition!
Inventory updated twice (correctly), not once or corrupted.

---

WITHOUT LOCK (DANGER):

Both events' planned_stock += qty would race:
  - Read current: 100
  - Process A increments to 110
  - Process B (simultaneously) reads 100, increments to 110
  - Final result: 110 (should be 120!)

WITH LOCK (SAFE):

Event A acquires lock first:
  - Reads: 100 → Updates to 110 → Releases
Event B acquires lock second:
  - Reads: 110 → Updates to 120 → Releases

Final result: 120 ✓
```

---

This architecture ensures:
✓ **Reliability** - Events retry automatically
✓ **Safety** - Distributed locks prevent corruption
✓ **Auditability** - All events persisted
✓ **Observability** - Dashboard monitoring
✓ **Scalability** - Event consumers can be added
✓ **Resilience** - System survives failures
