const { ChatOpenAI } = require("@langchain/openai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence } = require("@langchain/core/runnables");
require("dotenv").config();

// We are using Mistral via OpenRouter
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
    temperature: 0.2, // Keep it low for analytical consistency
});

const deadStockPrompt = PromptTemplate.fromTemplate(`
You are InventoryGPT, an expert AI logistics manager.
Your objective is to identify dead stock using strict operational metrics, calculate the capital locked up, and propose a strategic liquidation plan.

# Context Data:
{context}

# Instructions:
Analyze the context data and return EXACTLY the following format. Do not add conversational fluff.

Dead Stock Severity: [HIGH/MEDIUM/LOW]
Inventory Aging: [Estimated Days]
Estimated Holding Loss: $[Value]/month
Clearance Strategy: [1 Actionable Sentence]
`);

const deadStockChain = RunnableSequence.from([
    deadStockPrompt,
    llm
]);

/**
 * Run the Dead Stock Analysis Agent
 * @param {Object} contextData - Context extracted from the logistics database
 * @returns {Promise<string>} - The AI's strategic recommendation
 */
async function analyzeDeadStock(contextData) {
    try {
        const response = await deadStockChain.invoke({
            context: JSON.stringify(contextData, null, 2)
        });
        
        // Return the raw text content
        return response.content;
    } catch (error) {
        console.error("Agent Execution Error (Dead Stock):", error);
        throw error;
    }
}

module.exports = {
    analyzeDeadStock
};
