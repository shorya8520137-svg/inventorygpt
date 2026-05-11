const express = require('express');
const cors = require('cors');
const { analyzeRedistribution } = require('./ai/agents/redistributionAgent');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
        if (req.body.contextData) {
            contextData = req.body.contextData;
        } else {
            // Fetch real operational context from the database
            
            // 1. Fetch current inventory anomalies (potential overstock/understock)
            // Note: Adjust the column names (e.g. sku_id, warehouse_id, quantity) to match your exact schema.
            // Using store_inventory based on standard analysis
            const [inventoryData] = await pool.query(`
                SELECT *
                FROM store_inventory 
                ORDER BY quantity DESC 
                LIMIT 10
            `);
            
            // 2. Fetch warehouse performance constraints
            const [warehousePerformance] = await pool.query(`
                SELECT 
                    warehouse_id, 
                    fulfillment_speed, 
                    dead_stock_ratio 
                FROM warehouse_performance_metrics
                ORDER BY fulfillment_speed ASC
            `);

            // 3. Assemble the context for the AI
            contextData = {
                event: "AI Redistribution Workflow Triggered",
                timestamp: new Date().toISOString(),
                inventory_anomalies: inventoryData,
                warehouse_performance: warehousePerformance,
                instruction: "Identify imbalances and recommend stock transfers considering fulfillment speeds."
            };
        }

        const recommendation = await analyzeRedistribution(contextData);
        
        res.json({
            success: true,
            model: process.env.MODEL_NAME,
            analysis: recommendation
        });
    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`InventoryGPT API Server listening on port ${PORT}`);
});
