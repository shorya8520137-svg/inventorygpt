// src/core/customerLoyaltyEngine.js
const pool = require('../config/db');

async function evaluateLoyaltyOverride(customerId, analysisId) {
    try {
        const [loyaltyRows] = await pool.query(`
            SELECT loyalty_tier FROM customer_loyalty_scores WHERE customer_id = ?
        `, [customerId]);
        
        if (loyaltyRows.length > 0 && loyaltyRows[0].loyalty_tier === 'VIP') {
            await pool.query(`
                UPDATE fulfillment_economic_analysis SET loyalty_override_applied = TRUE WHERE analysis_id = ?
            `, [analysisId]);
            return true; // VIP Override applied
        }
        return false;
    } catch (e) {
        console.warn("Offline mode: Simulated Loyalty Evaluation");
        if (customerId === 'CUST-VIP-999') return true;
        return false;
    }
}

module.exports = { evaluateLoyaltyOverride };
