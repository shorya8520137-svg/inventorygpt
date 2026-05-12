const fs = require('fs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runSetup() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        multipleStatements: true
    });

    try {
        console.log("Reading setup_phase9.sql...");
        const sql = fs.readFileSync('setup_phase9.sql', 'utf8');
        console.log("Executing SQL...");
        await connection.query(sql);
        console.log("Phase 9 tables created successfully!");
    } catch (err) {
        console.error("Error executing SQL:", err);
    } finally {
        await connection.end();
    }
}

runSetup();
