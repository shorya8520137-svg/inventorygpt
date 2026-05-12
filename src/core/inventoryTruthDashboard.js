// src/core/inventoryTruthDashboard.js
const pool = require('../config/db');

async function getInventoryTruth() {
    try {
        const [rows] = await pool.query(`
            SELECT 
                location_id,
                sku,
                physical_stock,
                planned_stock,
                (physical_stock - planned_stock) AS sellable_stock,
                0 AS in_transit_stock, -- Can be expanded later
                0 AS reserved_stock -- Can be expanded later
            FROM inventory_state_tracking
            LIMIT 50
        `);
        return rows;
    } catch (e) {
        console.warn("Offline mode: Simulated Inventory Truth");
        return [
            { location_id: 'Warehouse A', sku: 'FESTIVAL-LIGHTS', physical_stock: 120, planned_stock: 40, sellable_stock: 80, in_transit_stock: 20, reserved_stock: 10 },
            { location_id: 'Warehouse A', sku: 'SUMMER-FAN', physical_stock: 50, planned_stock: 50, sellable_stock: 0, in_transit_stock: 0, reserved_stock: 5 },
            { location_id: 'Warehouse B', sku: 'FESTIVAL-LIGHTS', physical_stock: 10, planned_stock: 0, sellable_stock: 10, in_transit_stock: 50, reserved_stock: 0 },
            { location_id: 'Warehouse B', sku: 'WINTER-HEATER', physical_stock: 200, planned_stock: 10, sellable_stock: 190, in_transit_stock: 0, reserved_stock: 0 }
        ];
    }
}

module.exports = { getInventoryTruth };
