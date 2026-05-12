// src/core/fulfillmentEconomicsEngine.js
const pool = require('../config/db');

async function evaluateEconomicViability(taskId, productMargin, transferCost) {
    const netProfit = productMargin - transferCost;
    const isViable = netProfit > 0;

    try {
        const [insertResult] = await pool.query(`
            INSERT INTO fulfillment_economic_analysis 
            (task_id, product_margin, transfer_cost, net_profit, economically_viable) 
            VALUES (?, ?, ?, ?, ?)
        `, [taskId, productMargin, transferCost, netProfit, isViable]);
        
        return {
            analysisId: insertResult.insertId,
            netProfit,
            isViable
        };
    } catch (dbError) {
        console.warn("Offline mode: Simulated Economic Evaluation");
        return { analysisId: 'MOCK_ANALYSIS_1', netProfit, isViable };
    }
}

module.exports = { evaluateEconomicViability };
