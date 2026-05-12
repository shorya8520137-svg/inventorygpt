// src/core/aiTrustAnalytics.js
const pool = require('../config/db');

async function getAITrustMetrics() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                agent_name,
                total_recommendations,
                successful_executions,
                failed_executions,
                false_positives,
                false_negatives,
                accuracy_score,
                last_updated
            FROM ai_accuracy_tracking
        `);
        return rows;
    } catch (e) {
        console.warn("Offline mode: Simulated AI Trust Analytics");
        return [
            { agent_name: 'Redistribution Agent', total_recommendations: 145, successful_executions: 132, failed_executions: 13, false_positives: 2, false_negatives: 1, accuracy_score: 91.03, last_updated: new Date() },
            { agent_name: 'Marketplace Agent', total_recommendations: 89, successful_executions: 78, failed_executions: 11, false_positives: 4, false_negatives: 0, accuracy_score: 87.64, last_updated: new Date() },
            { agent_name: 'Predictive Agent', total_recommendations: 54, successful_executions: 48, failed_executions: 6, false_positives: 1, false_negatives: 3, accuracy_score: 88.88, last_updated: new Date() },
            { agent_name: 'Warehouse Risk Agent', total_recommendations: 30, successful_executions: 27, failed_executions: 3, false_positives: 0, false_negatives: 1, accuracy_score: 90.00, last_updated: new Date() }
        ];
    }
}

module.exports = { getAITrustMetrics };
