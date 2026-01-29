import OpenAI from 'openai';
import { config } from '../config/config';

export class XAIService {
    private client: OpenAI;
    private readonly model: string;

    constructor() {
        if (!config.xai.apiKey) {
            console.warn('XAI_API_KEY is not set. Grok features will be disabled.');
        }

        this.client = new OpenAI({
            apiKey: config.xai.apiKey || 'dummy_key',
            baseURL: 'https://api.x.ai/v1'
        });
        
        this.model = config.xai.model;
    }

    /**
     * Analyze a generic crypto query or contract address (CA) using Grok's real-time capabilities.
     * @param query The user's prompt (e.g., "$TOKEN sentiment", "CA: 0x...", "What is people saying about X?")
     */
    async analyzeCrypto(query: string): Promise<string> {
        if (!config.xai.apiKey) {
            return '❌ Grok API key is not configured.';
        }

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: `You are Grok, an expert crypto analyst with **agentic access to Real-Time X (Twitter) Search**.
                        
Your GOAL is to provide the most up-to-date sentiment analysis possible by actively searching X for the latest data.

When the user provides a Token Symbol (e.g., $DOGE) or a Contract Address (CA), you MUST:
1. **PERFORM A LIVE SEARCH** on X for recent posts (last 1-4 hours) about this token.
2. Analyze the *current* sentiment (Bullish, Bearish, Neutral) based on these *live* search results.
3. Identify breaking news, FUD, or trending narratives *right now*.
4. Ignore outdated information and spam. Focus ONLY on the present moment.

Keep your response concise, edgy, and engaging. Use emojis.
Display the "Sentiment Score" (0-100) and "Volume Trend" if discernible.`
                    },
                    {
                        role: 'user',
                        content: query
                    }
                ],
                temperature: 0.7, // Slightly creative but grounded in search results
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'x_search',
                            description: 'Search X (Twitter) for real-time posts, sentiment, and news.',
                            parameters: {
                                type: 'object',
                                properties: {
                                    query: {
                                        type: 'string',
                                        description: 'The search query string'
                                    },
                                    date_range: {
                                        type: 'string',
                                        description: 'Optional date range filter'
                                    }
                                },
                                required: ['query']
                            }
                        }
                    }
                ],
                tool_choice: 'auto'
            });

            return completion.choices[0]?.message?.content || 'No response from Grok.';
        } catch (error: any) {
            console.error('Error calling Grok API:', {
                message: error.message,
                response: error.response?.data,
                status: error.status
            });
            return `❌ Failed to get analysis from Grok. (${error.message || 'Unknown error'})`;
        }
    }

    /**
     * General chat with Grok
     */
    async chat(prompt: string): Promise<string> {
        if (!config.xai.apiKey) {
            return '❌ Grok API key is not configured.';
        }

        try {
            const completion = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are Grok, a rebellious and witty AI assistant with real-time knowledge from X.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            });

            return completion.choices[0]?.message?.content || 'No response.';
        } catch (error) {
            console.error('Error calling Grok API:', error);
            return '❌ Request failed.';
        }
    }
}
