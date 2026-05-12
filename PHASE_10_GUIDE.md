# Phase 10: Event-Driven Infrastructure Implementation Guide

## Overview
InventoryGPT has been transformed into a resilient, event-driven, distributed operational platform. All warehouse operations now flow through a Redis Streams-based event bus with automatic retry, dead-letter handling, and distributed lock protection.

## Architecture Components

### Core Event Infrastructure

#### 1. **Event Orchestrator** (`src/core/eventOrchestrator.js`)
- Redis Streams producer/consumer
- Event persistence to `operational_event_store` table
- Automatic consumer group management
- Retry scheduling with exponential backoff
- Dead-letter queue movement for failed events

**Key Functions:**
- `publishEvent()` - Emit operational events
- `getEventById()` - Retrieve event state
- `initEventOrchestrator()` - Initialize event bus on startup

#### 2. **Event Processor** (`src/core/eventProcessor.js`)
- Distributed lock acquisition before processing
- Event handler dispatch
- Idempotent event processing guarantees

**Supported Event Handlers:**
- `TRANSFER_APPROVED` → Creates transfer task with planned stock allocation
- `TRANSFER_RECEIPT_CONFIRMED` → Verifies physical receipt and marks task complete
- `INVENTORY_MISMATCH_DETECTED` → Logs reconciliation requirement

#### 3. **Distributed Lock Engine** (`src/core/distributedLockEngine.js`)
- Redis-based pessimistic locking
- Prevents concurrent inventory mutations
- Token-based lock safety

#### 4. **Retry Recovery Engine** (`src/core/retryRecoveryEngine.js`)
- Exponential backoff: 5s, 10s, 20s, 40s (default)
- Configurable max retry attempts (default: 3)
- Automatic event republishing

#### 5. **Dead-Letter Queue Engine** (`src/core/deadLetterQueueEngine.js`)
- Moves failed events after max retries exhausted
- Preserves complete event payload for manual inspection
- Stores failure reason and metadata

### Event Workflow Orchestration

#### 6. **Transfer Workflow Orchestrator** (`src/core/transferWorkflowOrchestrator.js`)
Manages the complete transfer lifecycle as a saga pattern:

```
initiateTransferWorkflow()
  ↓ (publishes TRANSFER_APPROVED)
Event Bus
  ↓
Event Processor (with distributed lock)
  ↓
handleTransferApproved()
  ├─ createTask()
  ├─ allocatePlannedStock()
  └─ publishTransferTaskCreated()
  ↓ (publishes TRANSFER_TASK_CREATED)
Event Bus
  ↓
... subsequent workflow stages ...
```

**End-to-End Transfer Event Flow:**

1. **API Request** → `/api/execution/create-transfer-task`
   ```
   POST /api/execution/create-transfer-task
   {
     "recommendation_id": "REC-001",
     "source": "WH-EAST",
     "target": "WH-SOUTH",
     "sku": "ITEM-123",
     "quantity": 100,
     "customer_id": "VIP-001"
   }
   ```

2. **Event Emission** → `TRANSFER_APPROVED`
   - Event ID: UUID
   - Correlation ID: recommendation_id
   - Idempotency Key: TRANSFER_APPROVED:recommendation_id:sku:quantity
   - Persisted to `operational_event_store`

3. **Event Processing** (with distributed lock)
   - Lock acquired: `event-lock:event_id`
   - Task created in `inventory_transfer_tasks`
   - Planned stock updated
   - Event marked `COMPLETED`

4. **Secondary Event** → `TRANSFER_TASK_CREATED`
   - Automatically emitted by event processor
   - Maintains saga correlation

5. **Physical Receipt** → `/api/execution/verify-physical-receipt`
   ```
   POST /api/execution/verify-physical-receipt
   {
     "task_id": "TASK-1715427600000",
     "sku": "ITEM-123",
     "location_id": "WH-SOUTH",
     "quantity": 100
   }
   ```

6. **Event Emission** → `TRANSFER_RECEIPT_CONFIRMED`
   - Triggers `handleTransferReceiptConfirmed()`
   - Verifies physical receipt
   - Marks task `VERIFIED`

### Resilience Engines

#### 7. **Saga Workflow Engine** (`src/core/sagaWorkflowEngine.js`)
- Saga state tracking
- Rollback capability
- Compensating action support

#### 8. **Inventory Reconciliation Engine** (`src/core/inventoryReconciliationEngine.js`)
- Detects inventory mismatches
- Logs reconciliation requirements
- Scheduled automated reconciliation

#### 9. **Event Consistency Monitor** (`src/core/eventConsistencyMonitor.js`)
- Detects synchronization drift
- Audit trail generation
- Consistency verification

#### 10. **System Recovery Engine** (`src/core/systemRecoveryEngine.js`)
- Checkpoint recording
- Workflow resumption after crashes
- Pending event cleanup

### Monitoring & Observability

#### 11. **Dashboard Monitoring Engine** (`src/core/dashboardMonitoringEngine.js`)
Provides real-time visibility into event bus health:

- Retry queue status
- Dead-letter queue contents
- Event latency metrics
- Synchronization drift alerts
- Workflow saga tracking
- Event store health summary
- Reconciliation status

## New Database Tables

Execute `setup_phase10.sql` to create:

```sql
operational_event_store           -- All events
event_retry_queue                 -- Pending retries
dead_letter_events                -- Failed events
distributed_lock_tracking         -- Lock state
inventory_reconciliation_logs     -- Mismatch tracking
event_consistency_audits          -- Drift detection
workflow_saga_tracking            -- Saga state
marketplace_sync_failures         -- Marketplace issues
operational_event_metrics         -- Performance metrics
system_recovery_checkpoints       -- Recovery state
```

## API Endpoints

### Event Publishing
```
POST /api/events/publish
{
  "eventType": "TRANSFER_APPROVED",
  "sourceService": "my-service",
  "payload": {...},
  "correlationId": "REQ-123",
  "idempotencyKey": "unique-key"
}
Response: { success: true, event_id: "UUID" }
```

### Execution Flow
```
POST /api/execution/create-transfer-task
POST /api/execution/verify-physical-receipt
```

### Dashboard Monitoring
```
GET /api/dashboard/retry-queue
GET /api/dashboard/dead-letter-queue
GET /api/dashboard/event-latency-metrics
GET /api/dashboard/sync-drift-alerts
GET /api/dashboard/workflow-sagas
GET /api/dashboard/event-store-health
GET /api/dashboard/reconciliation-status
```

## Configuration

Set these environment variables in `.env`:

```env
# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASS=              # Optional password

# Event Bus
EVENT_STREAM_NAME=inventorygpt:event-stream
EVENT_CONSUMER_GROUP=inventorygpt-consumer-group
EVENT_MAX_RETRIES=3
EVENT_RETRY_POLL_INTERVAL=10000    # milliseconds

# Server
PORT=3000
HOSTNAME=inventorygpt-server
```

## Startup & Initialization

### Start Server
```bash
npm start
```

or

```bash
node src/server.js
```

### Initialize Database
```bash
mysql -u user -p database < setup_phase10.sql
```

### Ensure Redis is Running
```bash
redis-server
```

## Safety Guarantees

### ✓ Idempotency
- Every event has a unique `idempotency_key`
- Duplicate event processing is prevented
- Inventory mutations cannot be duplicated

### ✓ Distributed Locking
- Critical operations protected by Redis locks
- Prevents concurrent conflicting mutations
- Token-based lock safety

### ✓ Automatic Retry
- Transient failures automatically retried
- Exponential backoff prevents thundering herd
- Failed events moved to DLQ after max retries

### ✓ Event Persistence
- Every operational event persisted to DB
- Complete audit trail
- Manual replay capability

### ✓ Saga Tracking
- Complex workflows tracked from start to finish
- Rollback capability on failure
- Compensating actions supported

## Monitoring Workflow

### Real-Time Health Check
```bash
curl http://localhost:3000/api/dashboard/event-store-health
```

### Retry Queue Monitoring
```bash
curl http://localhost:3000/api/dashboard/retry-queue
```

### Dead-Letter Inspection
```bash
curl http://localhost:3000/api/dashboard/dead-letter-queue
```

### Latency Analysis
```bash
curl http://localhost:3000/api/dashboard/event-latency-metrics
```

## Key Files Modified

- `src/server.js` - Integrated event orchestrator, refactored endpoints
- `package.json` - Added `ioredis` dependency, start script
- `src/core/eventProcessor.js` - Added workflow saga support
- `src/config/redis.js` - New Redis client config

## Key Files Created

- `src/core/eventOrchestrator.js`
- `src/core/eventProcessor.js`
- `src/core/distributedLockEngine.js`
- `src/core/retryRecoveryEngine.js`
- `src/core/deadLetterQueueEngine.js`
- `src/core/transferWorkflowOrchestrator.js`
- `src/core/sagaWorkflowEngine.js`
- `src/core/inventoryReconciliationEngine.js`
- `src/core/eventConsistencyMonitor.js`
- `src/core/systemRecoveryEngine.js`
- `src/core/marketplaceResilienceEngine.js`
- `src/core/distributedObservabilityEngine.js`
- `src/core/dashboardMonitoringEngine.js`
- `setup_phase10.sql`

## Testing the Event Flow

### 1. Start the system
```bash
npm start
```

### 2. Create a transfer (triggers TRANSFER_APPROVED event)
```bash
curl -X POST http://localhost:3000/api/execution/create-transfer-task \
  -H "Content-Type: application/json" \
  -d '{
    "recommendation_id": "REC-TEST-001",
    "source": "WH-EAST",
    "target": "WH-SOUTH",
    "sku": "TEST-SKU-123",
    "quantity": 50,
    "product_margin": 10.50,
    "transfer_cost": 5.00
  }'
```

Response:
```json
{
  "success": true,
  "message": "Transfer workflow initiated successfully.",
  "saga_id": "TRANSFER-SAGA-1715427600000-abc123",
  "event_id": "event-uuid",
  "correlation_id": "REC-TEST-001"
}
```

### 3. Monitor event processing
```bash
curl http://localhost:3000/api/dashboard/workflow-sagas
curl http://localhost:3000/api/dashboard/event-store-health
curl http://localhost:3000/api/dashboard/event-latency-metrics
```

### 4. Verify physical receipt (if event processing completes)
```bash
curl -X POST http://localhost:3000/api/execution/verify-physical-receipt \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "TASK-1715427600000",
    "sku": "TEST-SKU-123",
    "location_id": "WH-SOUTH",
    "quantity": 50
  }'
```

## Next Steps

- Deploy to production with Redis cluster for high availability
- Add webhook support for marketplace sync failures
- Implement dashboard UI for event monitoring
- Set up alerting on DLQ movement
- Add metrics export for Prometheus/Grafana
