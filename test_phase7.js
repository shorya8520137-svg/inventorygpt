const http = require('http');

const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/ai/predictive-scan',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const response = JSON.parse(data);
        console.log("--- TEST 1: Nightly Predictive Scan ---");
        console.log("Status:", response.success ? "Success" : "Failed");
        if (response.success) {
            console.log("\nRaw AI Analysis:\n" + response.raw_analysis);
            console.log("\nExtracted Predictive Alert:");
            console.log(response.prediction);
            console.log(`\nAlert saved with ID: ${response.alert_id}`);
        } else {
            console.log(response.error);
        }
    });
});
req.write('{}');
req.end();
