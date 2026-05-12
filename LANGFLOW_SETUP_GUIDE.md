# InventoryGPT: Langflow & LangChain Setup Guide

This guide explains exactly how to connect the Langflow visual interface to the newly created InventoryGPT Node.js backend. 

By following these steps, you will create an AI workflow that analyzes inventory, saves it to your database, and waits for a manager's approval.

---

## Step 1: Start the Local API Server
Before opening Langflow, ensure your InventoryGPT backend is running.
1. Open your terminal in `C:\Users\singh\OneDrive\Desktop\inventorygpt`.
2. Run the command: `node src/server.js`
3. You should see: `InventoryGPT API Server listening on port 3001`

---

## Step 2: Create the API Request Node in Langflow
We are going to use Langflow to trigger our custom redistribution logic.

1. Open your Langflow Canvas.
2. Search for and drag the **API Request** component into the canvas (usually under the `Data Sources` or `Tools` section).
3. Configure the node exactly like this:
   - **Method**: `POST`
   - **URL**: `http://localhost:3001/api/ai/analyze-redistribution`
   - **Headers**: `{ "Content-Type": "application/json" }`
   - **Body**: Leave empty to fetch live database anomalies automatically, OR supply a test JSON object.

*Why do it this way?* Because your Node.js server acts as the secure wrapper. It fetches the live database data and handles the LLM API keys so your Langflow frontend doesn't have to manage raw database connections.

---

## Step 3: Parse the AI Output
The API Request node will output a JSON payload that looks like this:

```json
{
  "success": true,
  "model": "mistralai/mistral-7b-instruct-v0.1",
  "recommendation_id": 24, 
  "analysis": "Observation: Warehouse South..."
}
```

Because Langflow's built-in JSON nodes can be strict with types, the most robust way to extract the data is using a **Custom Component**.

1. In Langflow, click `+ New Custom Component` (usually at the bottom left).
2. Click `<> Code` and paste the `InventoryGPTParser` Python script. (This script takes the API `Data` and wraps the `analysis` string in a `Message` object so `Text Output` can read it).
3. Connect the output of the **API Request** to the input of your new **Parse API Response** node.
4. Connect the `Analysis Text` output to a **Text Output** node to display it on screen!

---

## Step 4: Adding Agent 2 (Dead Stock Analysis)
You can easily duplicate your Langflow canvas to trigger the Dead Stock Analysis Agent instead!

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/analyze-deadstock`
3. Connect it to the exact same **Parse API Response** Python node.
4. When you click Play, the backend will query the `store_inventory` table for slow-moving stock, calculate the locked capital, and return clearance strategies!

---

## Step 5: Adding Agent 3 (Regional Marketplace Analytics)
Optimize your Amazon/Flipkart allocations based on regional demand!

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/analyze-marketplace`
3. The AI will return immediate strategies to move inventory to high-demand regions (e.g., North vs South) to prevent stockouts!

---

## Step 6: Adding Agent 4 (Warehouse & RTO Risk)
Catch delayed fulfillment and high Return-to-Origin rates.

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/analyze-warehouse-risk`
3. The AI will flag problematic warehouses and suggest courier reallocations.

---

## Step 7: Build the Feedback Loop (The Approval Node)
The AI has already saved its recommendation to the `ai_inventory_recommendations` table with a status of `pending`. Now, we need the manager to approve it.

1. Create a new **API Request** node to trigger the approval.
2. Set the **Method** to `POST` and the **URL** to `http://localhost:3001/api/ai/approve-recommendation`.
3. In the **Body** of the API Request node, pass the JSON payload containing the ID extracted from your parser:
   ```json
   {
     "recommendation_id": 123,
     "action": "approve"
   }
   ```
4. The backend will instantly change the status in the MySQL database from `pending` to `accepted` and return a confirmation message!

---

## Architecture Summary

This is what your Langflow visual architecture should look like:

```text
[ Trigger Node (e.g., Daily Cron or Chat input) ]
       ↓
[ API Request Node: POST /api/ai/analyze-redistribution ] 
       ↓
[ JSON Parser: Extracts text + recommendation_id ]
       ↓
[ Chat Output: Shows recommendation to Manager ]
       ↓
[ Human Input: "Approve" ]
       ↓
[ API Request Node: POST /api/ai/approve-recommendation ]
```

This ensures your Langchain agents have full stateful memory stored safely in your SQL database!

---

## Step 8: Adding Phase 5 (Outcome Measurement)
To measure the AI's real-world accuracy, add an API node to log outcomes:

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/measure-outcome`
3. Pass the actual savings and execution success in the JSON Body:
   ```json
   {
     "recommendation_id": 123,
     "actual_savings": 5000,
     "execution_success": true
   }
   ```

---

## Step 9: Adding Phase 6 (Operational Memory)
You can inject historical memories into the AI by adding an endpoint to write to the `ai_operational_memory` table.

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/memory`
3. Send the memory data in the JSON Body:
   ```json
   {
     "entity_type": "REGION",
     "entity_id": "South",
     "pattern_description": "Warehouse South repeatedly underestimates Q4 festival demand."
   }
   ```

---

## Step 10: Adding Phase 7 (Predictive Nightly Scan)
Instead of waiting for an imbalance, trigger the Proactive Predictive AI:

1. Create a new **API Request** node.
2. Change the **URL** to: `http://localhost:3001/api/ai/predictive-scan`
3. The AI will output a strict JSON payload predicting the next failure (e.g., "Expected stockout in 7 days"). Connect this to a parser to alert managers automatically.

---

## Step 11: Adding Phase 8 (Semi-Autonomous Execution)
When a manager approves a transfer, it must be routed through the Economics Engine and Inventory Truth Engine.

**1. Create the Transfer Task (Economics & VIP Override)**
- **URL**: `http://localhost:3001/api/execution/create-transfer-task`
- **Body**:
  ```json
  {
    "recommendation_id": 123,
    "source": "Warehouse A",
    "target": "Warehouse B",
    "sku": "FESTIVAL-LIGHTS",
    "quantity": 50,
    "customer_id": "CUST-VIP-999",
    "product_margin": 100,
    "transfer_cost": 150
  }
  ```
*(This will block unprofitable transfers unless it's a VIP customer!)*

**2. Verify Physical Receipt (Inventory Truth Engine)**
- **URL**: `http://localhost:3001/api/execution/verify-physical-receipt`
- **Body**:
  ```json
  {
    "task_id": "TASK-12345",
    "sku": "FESTIVAL-LIGHTS",
    "location_id": "Warehouse B",
    "quantity": 50
  }
  ```
*(This is the ONLY way to convert `planned_stock` into `sellable_stock`!)*
