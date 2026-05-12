const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
require('dotenv').config();

const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1"
    },
    modelName: process.env.MODEL_NAME || "mistralai/mistral-7b-instruct:free",
    temperature: 0.1, // Very low temperature for highly analytical/deterministic prediction
    maxTokens: 500
});

const SYSTEM_PROMPT = `You are InventoryGPT's Predictive Operational Intelligence Engine.
Your role is to transition the logistics system from REACTIVE to PROACTIVE.
You will receive current inventory levels, sales velocity, and historical operational memory.
Your goal is to predict future failures before they occur.

YOU MUST ONLY OUTPUT THE FOLLOWING DETERMINISTIC STRUCTURE. DO NOT ADD CONVERSATIONAL TEXT.

Predicted Event: [Short description of what will go wrong]
Affected Entity Type: [REGION, WAREHOUSE, or SKU]
Affected Entity ID: [ID or Name]
Estimated Days To Impact: [Integer]
Prediction Confidence: [Integer between 1 and 100]%
Recommended Preemptive Action: [Brief actionable advice]

Example Output:
Predicted Event: Impending stockout of electronic goods.
Affected Entity Type: REGION
Affected Entity ID: South Region
Estimated Days To Impact: 9
Prediction Confidence: 88%
Recommended Preemptive Action: Dispatch emergency transfer of 500 units from East Region within 48 hours.
`;

async function analyzePredictive(contextData) {
    try {
        const messages = [
            new SystemMessage(SYSTEM_PROMPT),
            new HumanMessage(`
                Analyze the following data and generate a predictive operational alert.
                
                Current Operational Data:
                ${JSON.stringify(contextData, null, 2)}
            `)
        ];

        const response = await llm.invoke(messages);
        return response.content;
    } catch (error) {
        console.error("Predictive Agent Error:", error);
        throw new Error("Failed to generate predictive analysis.");
    }
}

module.exports = { analyzePredictive };
