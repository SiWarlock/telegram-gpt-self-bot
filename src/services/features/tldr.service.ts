import type { Api } from 'telegram';
import { OpenAIService } from '../openai.service';
import { config } from '../../config/config';

export class TLDRFeature {
    constructor(
        private client: any,
        private openAIService: OpenAIService
    ) {}

    async handle(message: Api.Message): Promise<void> {
        const chatId = message.chatId?.toString() || message.peerId?.toString();
        if (!chatId) return;

        try {
            console.log('Processing TLDR command:', message.text);
            const commandResult = this.parseCommand(message.text || '');
            console.log('Command result:', commandResult);
            
            if (!commandResult.isValid || !commandResult.type || !commandResult.value) {
                await message.reply({
                    message: '❌ Format: !tldr [number of messages | time period]\nExamples:\n!tldr 100\n!tldr 2h\n!tldr 30m\n!tldr 1d',
                });
                return;
            }

            const params = {
                type: commandResult.type,
                value: commandResult.value
            };

            const thinkingMessage = await message.reply({
                message: '🤔 Analyzing chat...',
            });

            if (!thinkingMessage) {
                throw new Error('Failed to send thinking message');
            }

            // Get messages based on parameter type
            const messages = await this.getMessages(chatId, params);

            if (!messages.length) {
                await this.client.editMessage(chatId, {
                    message: thinkingMessage.id,
                    text: '❌ No messages found in the specified range.',
                });
                return;
            }

            const chatText = messages
                .reverse()
                .map(msg => msg.text)
                .filter(Boolean)
                .join('\n');

            const response = await this.openAIService.generateResponse([{
                role: 'user',
                content: `Please provide a concise TLDR summary of this chat conversation. Focus on the main points and any decisions made:\n\n${chatText}`
            }]);

            const formattedResponse = this.formatResponse(response, messages.length, commandResult.originalInput);
            
            await this.client.editMessage(chatId, {
                message: thinkingMessage.id,
                text: formattedResponse,
                parseMode: config.bot.enableMarkdown ? 'markdown' : undefined,
            });

        } catch (error) {
            console.error('Error generating TLDR:', error);
            await message.reply({
                message: '❌ Failed to generate summary.',
            });
        }
    }

    private parseCommand(text: string): { 
        isValid: boolean; 
        type?: 'count' | 'time';
        value?: number;
        originalInput?: string;
    } {
        const parts = text.split(' ');
        if (parts.length !== 2) return { isValid: false };

        const input = parts[1];
        
        // Check if it's a message count
        if (/^\d+$/.test(input)) {
            const count = parseInt(input);
            if (count > 0 && count <= 1000) {
                return { 
                    isValid: true, 
                    type: 'count', 
                    value: count,
                    originalInput: input
                };
            }
        }

        // Check if it's a time period
        const timeMatch = input.match(/^(\d+)(m|h|d)$/);
        if (timeMatch) {
            const [, num, unit] = timeMatch;
            const value = parseInt(num);
            if (value <= 0) return { isValid: false };

            const multipliers: Record<string, number> = {
                'm': 60,
                'h': 3600,
                'd': 86400
            };

            const multiplier = multipliers[unit];
            if (!multiplier) return { isValid: false };

            return { 
                isValid: true, 
                type: 'time', 
                value: value * multiplier,
                originalInput: input
            };
        }

        return { isValid: false };
    }

    private async getMessages(chatId: string, params: { type: 'count' | 'time', value: number }): Promise<Api.Message[]> {
        if (params.type === 'count') {
            return await this.client.getMessages(chatId, {
                limit: params.value
            });
        } else {
            const now = Math.floor(Date.now() / 1000);
            const messages: Api.Message[] = [];
            let lastId = 0;
            
            while (true) {
                const batch = await this.client.getMessages(chatId, {
                    limit: 100,
                    minId: lastId
                }) as Api.Message[];

                if (!batch.length) break;

                for (const msg of batch) {
                    if (now - msg.date > params.value) {
                        return messages;
                    }
                    messages.push(msg);
                    lastId = msg.id;
                }

                if (batch.length < 100) break;
            }

            return messages;
        }
    }

    private formatResponse(summary: string, messageCount: number, range?: string): string {
        const timestamp = config.bot.showTimestamps ? new Date().toLocaleTimeString() : '';
        
        return `📝 **Chat Summary**
───────────────
${summary}

───────────────
${timestamp ? `⏰ ${timestamp} | ` : ''}💭 Summarized ${messageCount} messages${range ? ` from last ${range}` : ''}`;
    }
} 