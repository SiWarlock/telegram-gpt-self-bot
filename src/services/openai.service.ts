import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { config } from '../config/config';

export class OpenAIService {
    private openai: OpenAI;
    private readonly systemPrompt = "You are a helpful AI assistant in a Telegram chat. Be concise yet informative.";

    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });
    }

    async generateResponse(messages: Array<{ role: string, content: string }>): Promise<string> {
        try {
            const formattedMessages: ChatCompletionMessageParam[] = [
                { role: 'system', content: this.systemPrompt },
                ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
            ];

            const completion = await this.openai.chat.completions.create({
                messages: formattedMessages,
                model: 'gpt-4-turbo',
                max_tokens: 500,
                temperature: 0.7,
                presence_penalty: 0.6,
                frequency_penalty: 0.5,
            });

            return completion.choices[0].message.content || 'No response generated';
        } catch (error: any) {
            if (error?.error?.type === 'insufficient_quota') {
                console.error('OpenAI API Key issue: Please check your billing and credits');
                return 'Error: OpenAI API key has insufficient quota. Please check billing settings.';
            }
            console.error('Error generating OpenAI response:', error?.message || error);
            throw error;
        }
    }
} 