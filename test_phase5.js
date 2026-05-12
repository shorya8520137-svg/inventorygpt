const http = require('http');

const postData = JSON.stringify({
    contextData: {
        event: "Dead Stock Analysis",
        inventory: [{
            warehouse: "Warehouse A",
            sku: "TEST-SKU-1",
            quantity: 500,
            sales_per_month: 2,
            cost_basis: 10,
            days_since_last_sale: 182
        }]
    }
});

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/ai/analyze-deadstock',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const response = JSON.parse(data);
        console.log("--- TEST 1: Autonomous Threshold (Dead Stock) ---");
        console.log("AI Output:\n" + response.analysis);
        console.log("Assigned Status: " + response.status);

        // Test 2: Measure Outcome
        const measureData = JSON.stringify({
            recommendation_id: response.recommendation_id,
            actual_savings: 5000.00,
            execution_success: true
        });

        const req2 = http.request({
            ...options,
            path: '/api/ai/measure-outcome',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(measureData)
            }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                console.log("\n--- TEST 2: Measure Outcome API ---");
                console.log("Measure Output: " + JSON.parse(data2).message);
            });
        });
        req2.write(measureData);
        req2.end();
    });
});
req.write(postData);
req.end();
