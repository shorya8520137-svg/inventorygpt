const http = require('http');

function makeRequest(path, payload, testName) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`\n--- ${testName} ---`);
                console.log(data);
                resolve(JSON.parse(data));
            });
        });
        req.write(JSON.stringify(payload));
        req.end();
    });
}

async function runTests() {
    // Test 1: Economics Rejection (Negative profit, no VIP)
    await makeRequest('/api/execution/create-transfer-task', {
        recommendation_id: 123,
        source: 'Warehouse A',
        target: 'Warehouse B',
        sku: 'TEST-SKU',
        quantity: 10,
        customer_id: 'CUST-STD-001',
        product_margin: 100,
        transfer_cost: 150
    }, "TEST 1: Economic Rejection (Loss making transfer)");

    // Test 2: VIP Loyalty Override (Negative profit, but VIP customer)
    const vipRes = await makeRequest('/api/execution/create-transfer-task', {
        recommendation_id: 124,
        source: 'Warehouse A',
        target: 'Warehouse B',
        sku: 'FESTIVAL-LIGHTS',
        quantity: 10,
        customer_id: 'CUST-VIP-999',
        product_margin: 100,
        transfer_cost: 150
    }, "TEST 2: VIP Loyalty Override (Approved despite loss)");

    if (vipRes.success) {
        // Test 3: Verify Physical Receipt (Inventory State Truth Engine)
        await makeRequest('/api/execution/verify-physical-receipt', {
            task_id: vipRes.task_id,
            sku: 'FESTIVAL-LIGHTS',
            location_id: 'Warehouse B',
            quantity: 10
        }, "TEST 3: Verify Physical Receipt (Inventory Truth Engine)");
    }
}

runTests();
