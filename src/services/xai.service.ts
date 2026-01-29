import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { config } from '../config/config';

export class XAIService {
    private readonly model: string;

    constructor() {
        if (!config.xai.apiKey) {
            console.warn('XAI_API_KEY is not set. Grok features will be disabled.');
        }
        
        this.model = config.xai.model;
    }

    /**
     * Analyze a crypto query using Grok's REAL-TIME X search via Agent Tools API.
     * Uses @ai-sdk/xai with x_search tool for actual X (Twitter) searches.
     * @param query The user's prompt (e.g., "$TOKEN sentiment", "CA: 0x...", etc.)
     */
    async analyzeCrypto(query: string): Promise<string> {
        if (!config.xai.apiKey) {
            return '❌ Grok API key is not configured.';
        }

        try {
            const { text, sources } = await generateText({
                model: xai.responses(this.model),
                prompt: `You are an expert crypto analyst with real-time access to X (Twitter) search.

TASK: Analyze the following crypto query using LIVE X search data.

When you receive a Token Symbol (e.g., $DOGE, $PENGUIN) or a Contract Address (CA), you MUST:
1. Search X for recent posts (last 1-4 hours) about this EXACT token/CA.
2. Analyze the current sentiment (Bullish/Bearish/Neutral) based on LIVE search results.
3. Identify breaking news, FUD, or trending narratives happening RIGHT NOW.
4. Ignore outdated information and spam.

Format your response to include:
- Token name/symbol (if identifiable from CA)
- Sentiment score (0-100)
- Volume trend
- Key findings from X posts

Query: ${query}`,
                tools: {
                    x_search: xai.tools.xSearch({
                        // Search last 4 hours for maximum freshness
                        // No handle restrictions - we want all public sentiment
                    }),
                },
                temperature: 0.7,
            });

            console.log('[XAIService] Agent Tools response:', {
                textLength: text.length,
                sourcesUsed: sources?.length || 0,
                sources: sources
            });

            return text || 'No response from Grok.';
        } catch (error: any) {
            console.error('Error calling Grok Agent Tools API:', {
                message: error.message,
                stack: error.stack
            });
            return `❌ Failed to get analysis from Grok. (${error.message || 'Unknown error'})`;
        }
    }

    /**
     * General chat with Grok (no X search)
     */
    async chat(prompt: string): Promise<string> {
        if (!config.xai.apiKey) {
            return '❌ Grok API key is not configured.';
        }

        try {
            const { text } = await generateText({
                model: xai.responses(this.model),
                prompt: `You are Grok, a rebellious and witty AI assistant. ${prompt}`,
                temperature: 0.9,
            });

            return text || 'No response.';
        } catch (error) {
            console.error('Error calling Grok API:', error);
            return '❌ Request failed.';
        }
    }
}
