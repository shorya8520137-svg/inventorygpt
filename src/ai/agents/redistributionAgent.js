const { ChatOpenAI } = require('@langchain/openai');
const { SystemMessage, HumanMessage } = require('@langchain/core/messages');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize the OpenRouter model using LangChain's ChatOpenAI
const chatModel = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
        baseURL: process.env.OPENAI_API_BASE,
    },
    modelName: process.env.MODEL_NAME,
    temperature: 0.2, // Low temperature for analytical consistency
});

// Load the system prompt
const systemPromptPath = path.join(__dirname, '../prompts/system_prompt.txt');
const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');

/**
 * Analyzes inventory data and returns redistribution recommendations.
 * @param {Object} contextData - Operational data from DB (overstock, understock, sales velocity).
 */
async function analyzeRedistribution(contextData) {
    try {
        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(`Analyze the following operational data and provide redistribution recommendations based on your core responsibilities:
            
            Operational Context:
            ${JSON.stringify(contextData, null, 2)}
            `)
        ];

        const response = await chatModel.invoke(messages);
        return response.content;
    } catch (error) {
        console.error("Error in Redistribution Agent:", error);
        throw error;
    }
}

module.exports = { analyzeRedistribution };
