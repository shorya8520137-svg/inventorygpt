const express = require('express');
const cors = require('cors');
const { analyzeRedistribution } = require('./ai/agents/redistributionAgent');
const { analyzeDeadStock } = require('./ai/agents/deadStockAgent');
const { analyzeMarketplace } = require('./ai/agents/marketplaceAgent');
const { analyzeWarehouseRisk } = require('./ai/agents/warehouseAgent');
const { analyzePredictive } = require('./ai/agents/predictiveAgent');

const { evaluateEconomicViability } = require('./core/fulfillmentEconomicsEngine');
const { evaluateLoyaltyOverride } = require('./core/customerLoyaltyEngine');
const { createTask, updateTaskStatus } = require('./core/transferLifecycleEngine');
const { allocatePlannedStock, verifyPhysicalReceipt } = require('./core/inventoryStateEngine');
const { initEventOrchestrator, publishEvent } = require('./core/eventOrchestrator');
const { initiateTransferWorkflow } = require('./core/transferWorkflowOrchestrator');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Sanitize invisible newlines from Langflow copy-paste
app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
        const cleanedBody = {};
        for (const [key, value] of Object.entries(req.body)) {
            const cleanKey = key.trim();
            const cleanValue = typeof value === 'string' ? value.trim() : value;
            cleanedBody[cleanKey] = cleanValue;
        }
        req.body = cleanedBody;
    }
    next();
});

const PORT = process.env.PORT || 3000;

// Phase 6: Operational Memory & Context Injection Engine
async function fetchOperationalMemory(pool, type) {
    try {
        const [memory] = await pool.query(`
            SELECT pattern_description 
            FROM ai_operational_memory 
            WHERE entity_type = ? 
            ORDER BY first_detected_at DESC LIMIT 3
        `, [type]);
        return memory.map(m => m.pattern_description).join(' | ');
    } catch (e) {
        return "No historical memory available (Offline mode).";
    }
}

// Phase 6: Adaptive Threshold Engine
async function processAutonomousThresholds(pool, recommendation, type) {
    let confidenceScore = null;
    let expectedSavings = null;
    let status = 'pending';

    // Extract metrics
    if (type === 'REDISTRIBUTION') {
        const confMatch = recommendation.match(/Confidence Score:\s*(\d+)/i);
        if (confMatch) confidenceScore = parseFloat(confMatch[1]);
    } else if (type === 'DEAD_STOCK') {
        const lossMatch = recommendation.match(/Estimated Holding Loss:\s*\$?([\d,]+)/i);
        if (lossMatch) expectedSavings = parseFloat(lossMatch[1].replace(/,/g, ''));
        const sevMatch = recommendation.match(/Dead Stock Severity:\s*(HIGH|MEDIUM|LOW)/i);
        if (sevMatch && sevMatch[1].toUpperCase() === 'HIGH') confidenceScore = 95;
    } else if (type === 'WAREHOUSE_RISK') {
        const healthMatch = recommendation.match(/Warehouse Health Score:\s*(\d+)/i);
        if (healthMatch) confidenceScore = 100 - parseFloat(healthMatch[1]);
    } else if (type === 'MARKETPLACE') {
        confidenceScore = 85;
    }

    // Adaptive Learning Thresholds
    let autoApprovalThreshold = 90; // Default
    try {
        const [accuracyRow] = await pool.query(`
            SELECT running_accuracy_score FROM ai_recommendation_accuracy WHERE agent_type = ?
        `, [type]);
        
        if (accuracyRow.length > 0) {
            const acc = parseFloat(accuracyRow[0].running_accuracy_score);
            if (acc >= 95) autoApprovalThreshold = 80;      // Highly trusted AI
            else if (acc >= 85) autoApprovalThreshold = 90; // Moderately trusted AI
            else autoApprovalThreshold = 95;                // Needs strict manual review
        }
    } catch (e) {
        console.warn("DB offline, using default autonomous threshold (90%).");
    }

    if (confidenceScore >= autoApprovalThreshold) {
        status = 'accepted';
        console.log(`[AUTONOMOUS ENGINE] ${type} auto-approved! Confidence: ${confidenceScore} >= Threshold: ${autoApprovalThreshold}`);
    }

    return { confidenceScore, expectedSavings, status };
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'InventoryGPT Backend is running' });
});

// AI Redistribution Analysis Endpoint
app.post('/api/ai/analyze-redistribution', async (req, res) => {
    try {
        const pool = require('./config/db');
        
        let contextData;
        
        // If the request provides its own context, use it (for testing in Langflow)
        if (req.body && req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            try {
                // Fetch real operational context from the database
                const [inventoryData] = await pool.query(`
                    SELECT *
                    FROM store_inventory 
                    ORDER BY quantity DESC 
                    LIMIT 10
                `);
                
                const [warehousePerformance] = await pool.query(`
                    SELECT 
                        warehouse_id, 
                        fulfillment_speed, 
                        dead_stock_ratio 
                    FROM warehouse_performance_metrics
                    ORDER BY fulfillment_speed ASC
                `);

                contextData = {
                    event: "AI Redistribution Workflow Triggered",
                    timestamp: new Date().toISOString(),
                    inventory_anomalies: inventoryData,
                    warehouse_performance: warehousePerformance,
                    historical_memory: await fetchOperationalMemory(pool, 'REGION'),
                    instruction: "Identify imbalances and recommend stock transfers considering fulfillment speeds."
                };
            } catch (dbError) {
                console.warn("Database connection failed, falling back to mock data. Error:", dbError.message);
                // Fallback context if DB is blocked by firewall (ETIMEDOUT)
                contextData = {
                    event: "Daily analysis trigger (FALLBACK DATA)",
                    warehouse_east: { status: "overstocked", product_a_qty: 500, sales_velocity: "low" },
                    warehouse_south: { status: "understocked", product_a_qty: 20, sales_velocity: "high" },
                    historical_memory: "Warehouse South repeatedly underestimates demand."
                };
            }
        }

        const recommendation = await analyzeRedistribution(contextData);
        
        // 4. Save to ai_inventory_recommendations
        const metrics = await processAutonomousThresholds(pool, recommendation, 'REDISTRIBUTION');
        let recommendationId = "PENDING_SAVE";
        let finalStatus = metrics.status;
        try {
            const [insertResult] = await pool.query(`
                INSERT INTO ai_inventory_recommendations 
                (recommendation_type, recommendation, confidence_score, expected_savings, status) 
                VALUES (?, ?, ?, ?, ?)
            `, ['REDISTRIBUTION', recommendation, metrics.confidenceScore, metrics.expectedSavings, finalStatus]);
            recommendationId = insertResult.insertId;
        } catch (dbError) {
            console.error("Error saving recommendation to DB:", dbError.message);
            // Provide a mock ID so Langflow doesn't crash on null values
            recommendationId = "MOCK_ID_999";
        }

        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            recommendation_id: recommendationId,
            status: finalStatus,
            analysis: recommendation
        });
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI Dead Stock Analysis Endpoint
app.post('/api/ai/analyze-deadstock', async (req, res) => {
    try {
        const pool = require('./config/db');
        let contextData;
        
        if (req.body && req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            try {
                // Query inventory with quantity but no recent movement
                // This is a simplified query for demonstration; a real system would join with transactions
                const [deadStockData] = await pool.query(`
                    SELECT * 
                    FROM store_inventory
                    WHERE quantity > 0
                    ORDER BY quantity DESC
                    LIMIT 20
                `);
                
                contextData = {
                    event: "Dead Stock Analysis Triggered",
                    timestamp: new Date().toISOString(),
                    inventory_items: deadStockData,
                    historical_memory: await fetchOperationalMemory(pool, 'SKU'),
                    instruction: "Identify which of these items constitute dead stock and propose liquidation strategies."
                };
            } catch (dbError) {
                console.warn("Database connection failed, falling back to mock data. Error:", dbError.message);
                contextData = {
                    event: "Dead Stock Analysis (FALLBACK DATA)",
                    mock_items: [
                        { sku: "OLD-SKU-123", qty: 450, cost: 12.50, days_since_last_sale: 120 },
                        { sku: "SEASONAL-WINTER-99", qty: 80, cost: 45.00, days_since_last_sale: 200 }
                    ],
                    historical_memory: "OLD-SKU-123 is a discontinued product line."
                };
            }
        }

        const recommendation = await analyzeDeadStock(contextData);
        
        const metrics = await processAutonomousThresholds(pool, recommendation, 'DEAD_STOCK');
        let recommendationId = "PENDING_SAVE";
        let finalStatus = metrics.status;
        try {
            const [insertResult] = await pool.query(`
                INSERT INTO ai_inventory_recommendations 
                (recommendation_type, recommendation, confidence_score, expected_savings, status) 
                VALUES (?, ?, ?, ?, ?)
            `, ['DEAD_STOCK', recommendation, metrics.confidenceScore, metrics.expectedSavings, finalStatus]);
            recommendationId = insertResult.insertId;
        } catch (dbError) {
            console.error("Error saving recommendation to DB:", dbError.message);
            recommendationId = "MOCK_ID_888";
        }

        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            recommendation_id: recommendationId,
            status: finalStatus,
            analysis: recommendation
        });
    } catch (error) {
        console.error("Dead Stock Analysis Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI Regional Marketplace Analytics Endpoint
app.post('/api/ai/analyze-marketplace', async (req, res) => {
    try {
        const pool = require('./config/db');
        let contextData;
        
        if (req.body && req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            try {
                // Query regional sales and marketplace orders
                const [regionalData] = await pool.query(`
                    SELECT region, top_sku, total_sales, out_of_stock_incidents
                    FROM regional_sales_analytics
                    ORDER BY total_sales DESC
                    LIMIT 5
                `);
                
                contextData = {
                    event: "Marketplace Analytics Triggered",
                    timestamp: new Date().toISOString(),
                    regional_trends: regionalData,
                    historical_memory: await fetchOperationalMemory(pool, 'REGION'),
                    instruction: "Identify high demand SKUs by region and suggest preemptive inventory transfers to local fulfillment centers."
                };
            } catch (dbError) {
                console.warn("Database connection failed, falling back to mock data. Error:", dbError.message);
                contextData = {
                    event: "Marketplace Analytics (FALLBACK DATA)",
                    regional_trends: [
                        { region: "North", top_sku: "WINTER-JACKET-01", demand: "High", local_stock: 50 },
                        { region: "South", top_sku: "SUMMER-TEE-02", demand: "Very High", local_stock: 10 }
                    ],
                    historical_memory: "South region marketplace demand spikes aggressively in Q2."
                };
            }
        }

        const recommendation = await analyzeMarketplace(contextData);
        
        const metrics = await processAutonomousThresholds(pool, recommendation, 'MARKETPLACE');
        let recommendationId = "PENDING_SAVE";
        let finalStatus = metrics.status;
        try {
            const [insertResult] = await pool.query(`
                INSERT INTO ai_inventory_recommendations 
                (recommendation_type, recommendation, confidence_score, expected_savings, status) 
                VALUES (?, ?, ?, ?, ?)
            `, ['MARKETPLACE', recommendation, metrics.confidenceScore, metrics.expectedSavings, finalStatus]);
            recommendationId = insertResult.insertId;
        } catch (dbError) {
            console.error("Error saving recommendation to DB:", dbError.message);
            recommendationId = "MOCK_ID_777";
        }

        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            recommendation_id: recommendationId,
            status: finalStatus,
            analysis: recommendation
        });
    } catch (error) {
        console.error("Marketplace Analysis Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// AI Warehouse Intelligence & RTO Risk Endpoint
app.post('/api/ai/analyze-warehouse-risk', async (req, res) => {
    try {
        const pool = require('./config/db');
        let contextData;
        
        if (req.body && req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            try {
                // Query warehouse performance and RTO
                const [warehouseData] = await pool.query(`
                    SELECT warehouse_id, fulfillment_speed, rto_percentage
                    FROM warehouse_performance_metrics
                    ORDER BY rto_percentage DESC
                    LIMIT 5
                `);
                
                contextData = {
                    event: "Warehouse Risk Analysis Triggered",
                    timestamp: new Date().toISOString(),
                    warehouse_metrics: warehouseData,
                    historical_memory: await fetchOperationalMemory(pool, 'WAREHOUSE'),
                    instruction: "Identify warehouses with high RTO risks or delays and suggest process improvements."
                };
            } catch (dbError) {
                console.warn("Database connection failed, falling back to mock data. Error:", dbError.message);
                contextData = {
                    event: "Warehouse Risk Analysis (FALLBACK DATA)",
                    warehouse_metrics: [
                        { warehouse_id: "WH-EAST-1", fulfillment_speed: "48 hours", rto_percentage: "15%" },
                        { warehouse_id: "WH-SOUTH-2", fulfillment_speed: "12 hours", rto_percentage: "2%" }
                    ],
                    historical_memory: "WH-EAST-1 courier partners often face logistical delays due to seasonal monsoons."
                };
            }
        }

        const recommendation = await analyzeWarehouseRisk(contextData);
        
        const metrics = await processAutonomousThresholds(pool, recommendation, 'WAREHOUSE_RISK');
        let recommendationId = "PENDING_SAVE";
        let finalStatus = metrics.status;
        try {
            const [insertResult] = await pool.query(`
                INSERT INTO ai_inventory_recommendations 
                (recommendation_type, recommendation, confidence_score, expected_savings, status) 
                VALUES (?, ?, ?, ?, ?)
            `, ['WAREHOUSE_RISK', recommendation, metrics.confidenceScore, metrics.expectedSavings, finalStatus]);
            recommendationId = insertResult.insertId;
        } catch (dbError) {
            console.error("Error saving recommendation to DB:", dbError.message);
            recommendationId = "MOCK_ID_666";
        }

        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            recommendation_id: recommendationId,
            analysis: recommendation
        });
    } catch (error) {
        console.error("Warehouse Risk Analysis Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 4: Feedback Loop & Approval System
app.post('/api/ai/approve-recommendation', async (req, res) => {
    try {
        const { recommendation_id, action } = req.body;
        
        if (!recommendation_id || !action) {
            return res.status(400).json({ success: false, error: "Missing recommendation_id or action parameter." });
        }

        // Validate action
        if (!['approve', 'reject'].includes(action.toLowerCase())) {
            return res.status(400).json({ success: false, error: "Action must be 'approve' or 'reject'." });
        }

        const newStatus = action.toLowerCase() === 'approve' ? 'accepted' : 'rejected';
        const pool = require('./config/db');

        try {
            // Update the status in the database
            const [updateResult] = await pool.query(`
                UPDATE ai_inventory_recommendations
                SET status = ?
                WHERE id = ?
            `, [newStatus, recommendation_id]);

            if (updateResult.affectedRows === 0) {
                // If it's a mock ID or doesn't exist, we just simulate success for the demo
                console.warn(`Recommendation ID ${recommendation_id} not found in DB or using mock ID. Simulating ${newStatus}.`);
            }

            res.json({
                success: true,
                message: `Recommendation ${recommendation_id} successfully marked as ${newStatus}.`,
                status: newStatus
            });
        } catch (dbError) {
            console.warn("Database connection failed during approval. Simulating success for Langflow demo.", dbError.message);
            res.json({
                success: true,
                message: `Recommendation ${recommendation_id} simulated as ${newStatus} (Offline mode).`,
                status: newStatus
            });
        }
    } catch (error) {
        console.error("Approval System Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 5: Outcome Engine (AI Accuracy Dashboard)
app.post('/api/ai/measure-outcome', async (req, res) => {
    try {
        const { recommendation_id, actual_savings, execution_success } = req.body;
        
        if (!recommendation_id) {
            return res.status(400).json({ success: false, error: "Missing recommendation_id." });
        }

        const pool = require('./config/db');
        
        try {
            // First, update the recommendation status to 'measured'
            await pool.query(`
                UPDATE ai_inventory_recommendations
                SET status = 'measured'
                WHERE id = ?
            `, [recommendation_id]);

            // Then insert into the results engine
            await pool.query(`
                INSERT INTO ai_recommendation_results 
                (recommendation_id, actual_savings, execution_success) 
                VALUES (?, ?, ?)
            `, [recommendation_id, actual_savings || 0, execution_success ? 1 : 0]);

            res.json({
                success: true,
                message: `Outcome for recommendation ${recommendation_id} measured successfully.`,
                actual_savings,
                execution_success
            });
        } catch (dbError) {
            console.warn("Database connection failed during outcome measurement. Simulating success.", dbError.message);
            res.json({
                success: true,
                message: `Outcome for recommendation ${recommendation_id} simulated as measured (Offline mode).`,
                actual_savings,
                execution_success
            });
        }
    } catch (error) {
        console.error("Outcome Engine Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 6: Operational Memory Write Endpoint
app.post('/api/ai/memory', async (req, res) => {
    try {
        console.log("MEMORY REQUEST BODY:", req.body);
        const { entity_type, entity_id, pattern_description, confidence_in_pattern } = req.body;
        
        if (!entity_type || !entity_id || !pattern_description) {
            return res.status(400).json({ success: false, error: "Missing required memory fields." });
        }

        const pool = require('./config/db');
        
        try {
            await pool.query(`
                INSERT INTO ai_operational_memory 
                (entity_type, entity_id, pattern_description, confidence_in_pattern) 
                VALUES (?, ?, ?, ?)
            `, [entity_type, entity_id, pattern_description, confidence_in_pattern || 90.00]);

            res.json({
                success: true,
                message: "Operational memory saved successfully."
            });
        } catch (dbError) {
            console.warn("Database connection failed during memory save. Simulating success.", dbError.message);
            res.json({
                success: true,
                message: "Operational memory simulated as saved (Offline mode)."
            });
        }
    } catch (error) {
        console.error("Memory Engine Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 7: Predictive Operational Intelligence (Proactive Scan)
app.post('/api/ai/predictive-scan', async (req, res) => {
    try {
        const pool = require('./config/db');
        let contextData;
        
        if (req.body && req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            try {
                const [velocityData] = await pool.query(`
                    SELECT * FROM store_inventory WHERE quantity < 50 ORDER BY quantity ASC LIMIT 5
                `);
                
                contextData = {
                    event: "Nightly Predictive Scan",
                    timestamp: new Date().toISOString(),
                    critical_inventory: velocityData,
                    historical_memory: await fetchOperationalMemory(pool, 'REGION') + " | " + await fetchOperationalMemory(pool, 'SKU'),
                    instruction: "Identify future failures before they happen."
                };
            } catch (dbError) {
                console.warn("Database connection failed, falling back to mock data.", dbError.message);
                contextData = {
                    event: "Predictive Scan (FALLBACK DATA)",
                    mock_items: [{ sku: "FESTIVAL-LIGHTS", qty: 20, expected_demand: 500 }],
                    historical_memory: "Demand spikes 300% starting next week."
                };
            }
        }

        const recommendation = await analyzePredictive(contextData);
        
        // Extract Metrics using Regex
        let predictedEvent = "Unknown Alert";
        let entityType = "REGION";
        let entityId = "Unknown";
        let daysToImpact = 0;
        let confidenceScore = 0;

        const eventMatch = recommendation.match(/Predicted Event:\s*(.+)/i);
        if (eventMatch) predictedEvent = eventMatch[1].trim();

        const typeMatch = recommendation.match(/Affected Entity Type:\s*(REGION|WAREHOUSE|SKU)/i);
        if (typeMatch) entityType = typeMatch[1].toUpperCase();

        const idMatch = recommendation.match(/Affected Entity ID:\s*(.+)/i);
        if (idMatch) entityId = idMatch[1].trim();

        const daysMatch = recommendation.match(/Estimated Days To Impact:\s*(\d+)/i);
        if (daysMatch) daysToImpact = parseInt(daysMatch[1]);

        const confMatch = recommendation.match(/Prediction Confidence:\s*(\d+)%/i);
        if (confMatch) confidenceScore = parseFloat(confMatch[1]);

        let alertId = "PENDING_SAVE";
        try {
            const [insertResult] = await pool.query(`
                INSERT INTO ai_predictive_alerts 
                (entity_type, entity_id, predicted_event, estimated_days_to_impact, confidence_score) 
                VALUES (?, ?, ?, ?, ?)
            `, [entityType, entityId, predictedEvent, daysToImpact, confidenceScore]);
            alertId = insertResult.insertId;
        } catch (dbError) {
            console.error("Error saving predictive alert to DB:", dbError.message);
            alertId = "MOCK_ALERT_ID_999";
        }

        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            alert_id: alertId,
            prediction: {
                event: predictedEvent,
                type: entityType,
                id: entityId,
                days: daysToImpact,
                confidence: confidenceScore
            },
            raw_analysis: recommendation
        });
    } catch (error) {
        console.error("Predictive Engine Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 8: Execution API - Create Transfer Task
app.post('/api/execution/create-transfer-task', async (req, res) => {
    try {
        const { recommendation_id, source, target, sku, quantity, customer_id, product_margin, transfer_cost } = req.body;
        
        // 1. Evaluate Economics
        let economicResult = await evaluateEconomicViability('PRE-TASK', product_margin, transfer_cost);
        let approvedForExecution = economicResult.isViable;
        let overrideApplied = false;

        // 2. Loyalty Override
        if (!approvedForExecution && customer_id) {
            overrideApplied = await evaluateLoyaltyOverride(customer_id, economicResult.analysisId);
            if (overrideApplied) {
                approvedForExecution = true;
                console.log(`[LOYALTY OVERRIDE] Transfer approved for VIP despite negative profit.`);
            }
        }

        if (!approvedForExecution) {
            return res.status(400).json({
                success: false,
                message: "Transfer Task Rejected: Not economically viable and no VIP override applied."
            });
        }

        // 3. Initiate Transfer Workflow (publishes TRANSFER_APPROVED event)
        const workflow = await initiateTransferWorkflow({
            recommendation_id,
            source,
            target,
            sku,
            quantity,
            customer_id,
            product_margin,
            transfer_cost
        });

        res.json({
            success: true,
            message: "Transfer workflow initiated successfully.",
            saga_id: workflow.sagaId,
            event_id: workflow.eventId,
            correlation_id: workflow.correlationId,
            economic_viability: economicResult.isViable,
            loyalty_override: overrideApplied
        });
    } catch (error) {
        console.error("Execution Engine Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Phase 8: Execution API - Verify Physical Receipt
app.post('/api/execution/verify-physical-receipt', async (req, res) => {
    try {
        const { task_id, sku, location_id, quantity } = req.body;

        const event = await publishEvent({
            eventType: 'TRANSFER_RECEIPT_CONFIRMED',
            sourceService: 'execution-api',
            payload: { task_id, sku, location_id, quantity },
            correlationId: task_id,
            idempotencyKey: `TRANSFER_RECEIPT_CONFIRMED:${task_id}:${sku}:${location_id}`
        });

        res.json({
            success: true,
            message: "Physical receipt confirmation event published successfully.",
            event_id: event.eventId
        });
    } catch (error) {
        console.error("Verification Engine Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/events/publish', async (req, res) => {
    try {
        const { eventType, sourceService, payload, correlationId, idempotencyKey } = req.body;
        if (!eventType || !sourceService) {
            return res.status(400).json({ success: false, error: 'eventType and sourceService are required.' });
        }

        const event = await publishEvent({
            eventType,
            sourceService,
            payload,
            correlationId,
            idempotencyKey
        });

        res.json({ success: true, event_id: event.eventId, status: 'published' });
    } catch (error) {
        console.error('Event publish failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
// Phase 9: Command Center APIs
const { getInventoryTruth } = require('./core/inventoryTruthDashboard');
const { getTransferTimeline } = require('./core/transferTimelineService');
const { getEventFeed } = require('./core/eventFeedEngine');
const { getAITrustMetrics } = require('./core/aiTrustAnalytics');
const { getEventHealth } = require('./core/distributedObservabilityEngine');
const {
    getRetryQueueStatus,
    getDeadLetterQueueStatus,
    getEventLatencyMetrics,
    getSynchronizationDriftAlerts,
    getWorkflowSagaStatus,
    getEventStoreHealthSummary,
    getReconciliationStatus
} = require('./core/dashboardMonitoringEngine');

app.get('/api/command-center/truth', async (req, res) => {
    try {
        const data = await getInventoryTruth();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/command-center/timeline', async (req, res) => {
    try {
        const data = await getTransferTimeline();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/command-center/feed', async (req, res) => {
    try {
        const data = await getEventFeed();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/command-center/ai-trust', async (req, res) => {
    try {
        const data = await getAITrustMetrics();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/command-center/event-health', async (req, res) => {
    try {
        const data = await getEventHealth();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// Phase 10: Dashboard Monitoring Endpoints
app.get('/api/dashboard/retry-queue', async (req, res) => {
    try {
        const data = await getRetryQueueStatus();
        res.json({ success: true, data, count: data.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/dead-letter-queue', async (req, res) => {
    try {
        const data = await getDeadLetterQueueStatus();
        res.json({ success: true, data, count: data.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/event-latency-metrics', async (req, res) => {
    try {
        const data = await getEventLatencyMetrics();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/sync-drift-alerts', async (req, res) => {
    try {
        const data = await getSynchronizationDriftAlerts();
        res.json({ success: true, data, alert_count: data.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/workflow-sagas', async (req, res) => {
    try {
        const data = await getWorkflowSagaStatus();
        res.json({ success: true, data, saga_count: data.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/event-store-health', async (req, res) => {
    try {
        const data = await getEventStoreHealthSummary();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/dashboard/reconciliation-status', async (req, res) => {
    try {
        const data = await getReconciliationStatus();
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

initEventOrchestrator().catch((error) => {
    console.error('[EVENT BUS] Failed to initialize event orchestrator:', error.message || error);
});

app.listen(PORT, () => {
    console.log(`InventoryGPT API Server listening on port ${PORT}`);
});
