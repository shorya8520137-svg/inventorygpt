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

const marketplacePrompt = PromptTemplate.fromTemplate(`
You are InventoryGPT, an expert AI logistics manager.
Your objective is to optimize fulfillment for external channels (like Amazon/Flipoks) based on regional demand.

# Context Data:
{context}

# Instructions:
Analyze the context data and return EXACTLY the following format. Do not add conversational fluff.

Recommended FC Allocation:
- [Region 1] FC → [X]%
- [Region 2] FC → [Y]%
- [Region 3] FC → [Z]%

Rationale: [1 Actionable Sentence]
`);

const marketplaceChain = RunnableSequence.from([
    marketplacePrompt,
    llm
]);

/**
 * Run the Regional Marketplace Analytics Agent
 * @param {Object} contextData - Context extracted from the logistics database
 * @returns {Promise<string>} - The AI's strategic recommendation
 */
async function analyzeMarketplace(contextData) {
    try {
        const response = await marketplaceChain.invoke({
            context: JSON.stringify(contextData, null, 2)
        });
        
        return response.content;
    } catch (error) {
        console.error("Agent Execution Error (Marketplace):", error);
        throw error;
    }
}

module.exports = {
    analyzeMarketplace
};
