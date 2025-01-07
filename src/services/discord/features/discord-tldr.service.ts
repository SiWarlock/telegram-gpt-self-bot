import { Client, Message as DiscordMessage, TextChannel, Collection } from 'discord.js-selfbot-v13';
import { OpenAIService } from '../../openai.service';
import { config } from '../../../config/config';

export class DiscordTLDRFeature {
    constructor(
        private client: Client,
        private openAIService: OpenAIService
    ) {}

    async handle(message: DiscordMessage): Promise<void> {
        try {
            const commandResult = this.parseCommand(message.content);
            if (!commandResult.isValid || !commandResult.type || !commandResult.value) {
                await message.reply('❌ Format: !tldr [number of messages | time period]\nExamples:\n!tldr 100\n!tldr 2h\n!tldr 30m\n!tldr 1d');
                return;
            }

            const thinkingMsg = await message.reply('🤔 Analyzing chat...');

            const messages = await this.getMessages(message.channel as TextChannel, {
                type: commandResult.type as 'count' | 'time',
                value: commandResult.value as number
            });
            if (!messages.length) {
                await thinkingMsg.edit('❌ No messages found in the specified range.');
                return;
            }

            const chatText = messages
                .reverse()
                .map(msg => msg.content)
                .filter(Boolean)
                .join('\n');

            const response = await this.openAIService.generateResponse([{
                role: 'user',
                content: `Please provide a concise TLDR summary of this chat conversation. Focus on the main points and any decisions made:\n\n${chatText}`
            }]);

            const formattedResponse = this.formatResponse(response, messages.length, commandResult.originalInput);
            await thinkingMsg.edit(formattedResponse);

        } catch (error) {
            console.error('Error generating TLDR:', error);
            await message.reply('❌ Failed to generate summary.');
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

    private async getMessages(channel: TextChannel, params: { type: 'count' | 'time', value: number }): Promise<DiscordMessage[]> {
        if (params.type === 'count') {
            const messages = await channel.messages.fetch({ limit: params.value });
            return [...messages.values()];
        } else {
            const messages: DiscordMessage[] = [];
            const now = Date.now();
            const timeLimit = params.value * 1000;
            
            let lastId: string | undefined;
            while (true) {
                const batch: Collection<string, DiscordMessage> = await channel.messages.fetch({ limit: 100, before: lastId });
                if (batch.size === 0) break;

                for (const msg of batch.values()) {
                    if (now - msg.createdTimestamp > timeLimit) {
                        return messages;
                    }
                    messages.push(msg);
                    lastId = msg.id;
                }

                if (batch.size < 100) break;
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