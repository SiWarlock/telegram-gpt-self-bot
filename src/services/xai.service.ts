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

CRITICAL INSTRUCTIONS:
- DO NOT include source citations, reference numbers, or links in your response
- Synthesize information into clear, actionable insights
- Focus on the MOST IMPORTANT signals only
- Explain WHY you're giving the sentiment score you're giving

TASK: Analyze this crypto query using LIVE X search (last 1-4 hours):

When you receive a Token Symbol or Contract Address (CA):
1. Search X for recent posts about this EXACT token/CA
2. Identify the STRONGEST sentiment signals (bullish/bearish/neutral)
3. Filter out noise, spam, and outdated information
4. Find breaking news or trending narratives RIGHT NOW
5. Identify posts from verified accounts (blue tick) with more weight, especially if they are from well known or respected crypto influencers

Format your response as:

**Token:** [Name/Symbol]

**Sentiment: [Score/100] - [Bullish/Bearish/Neutral]**
WHY: [2-3 sentences explaining the PRIMARY reasons for this score based on what you found]

**Volume & Activity:**
[Most important volume/liquidity metrics and what they indicate]

**Key Signals:**
• [Most important bullish signal, if any]
• [Most important bearish/risk signal, if any]
• [Notable trend or pattern]
• [Dex/Dexscreener paid, Dexscreener ads paid]


**Bottom Line:**
[One concise sentence: Should traders watch this? Any major red flags?]

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
