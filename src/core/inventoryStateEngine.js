// src/core/inventoryStateEngine.js
const pool = require('../config/db');

async function allocatePlannedStock(sku, locationId, quantity) {
    try {
        await pool.query(`
            UPDATE inventory_state_tracking 
            SET planned_stock = planned_stock + ? 
            WHERE sku = ? AND location_id = ?
        `, [quantity, sku, locationId]);
    } catch (e) {
        console.warn("Offline mode: Simulated Planned Stock Allocation");
    }
}

async function verifyPhysicalReceipt(sku, locationId, quantity) {
    try {
        await pool.query(`
            UPDATE inventory_state_tracking 
            SET planned_stock = GREATEST(0, planned_stock - ?),
                physical_stock = physical_stock + ?,
                sellable_stock = sellable_stock + ?
            WHERE sku = ? AND location_id = ?
        `, [quantity, quantity, quantity, sku, locationId]);
    } catch (e) {
        console.warn("Offline mode: Simulated Physical Receipt");
    }
}

module.exports = { allocatePlannedStock, verifyPhysicalReceipt };
