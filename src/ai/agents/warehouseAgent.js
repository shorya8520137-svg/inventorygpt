const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
require("dotenv").config();

const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "http://localhost:3001",
            "X-Title": "InventoryGPT",
        }
    },
    modelName: "mistralai/mistral-7b-instruct-v0.1", 
    temperature: 0.2,
});

const warehousePrompt = PromptTemplate.fromTemplate(`
You are InventoryGPT, an expert AI logistics manager.
Your objective is to analyze warehouse dispatch efficiency and identify Return To Origin (RTO) risks.

# Context Data:
{context}

# Instructions:
Analyze the context data and return EXACTLY the following format. Do not add conversational fluff.

Warehouse Health Score: [0-100]/100
Risk Classification:
- Delay Risk: [HIGH/MED/LOW]
- RTO Risk: [CRITICAL/HIGH/MED/LOW]
- Courier Reliability: [HIGH/MED/LOW]

Actionable Fix: [1 Actionable Sentence]
`);

const warehouseChain = RunnableSequence.from([
    warehousePrompt,
    llm
]);

/**
 * Run the Warehouse Intelligence Agent
 * @param {Object} contextData - Context extracted from the logistics database
 * @returns {Promise<string>} - The AI's strategic recommendation
 */
async function analyzeWarehouseRisk(contextData) {
    try {
        const response = await warehouseChain.invoke({
            context: JSON.stringify(contextData, null, 2)
        });
        
        return response.content;
    } catch (error) {
        console.error("Agent Execution Error (Warehouse):", error);
        throw error;
    }
}

module.exports = {
    analyzeWarehouseRisk
};
