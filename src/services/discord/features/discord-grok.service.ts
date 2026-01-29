import { Client as BotClient, Message as BotMessage } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage } from 'discord.js-selfbot-v13';
import { XAIService } from '../../xai.service';
import { config } from '../../../config/config';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;

export class DiscordGrokFeature {
    private processingMessages: Set<string> = new Set();

    constructor(
        private client: AnyClient,
        private xaiService: XAIService
    ) {}

    async handle(message: AnyMessage): Promise<void> {
        const messageText = message.content;
        const channelId = message.channel.id;

        if (!channelId) return;

        const messageId = `${channelId}_${message.id}`;
        if (this.processingMessages.has(messageId)) {
            return;
        }
        this.processingMessages.add(messageId);

        const prefix = config.bot.grokPrefix || '!grok';
        const query = messageText.slice(prefix.length).trim();

        try {
            if (!query) {
                await message.reply(`🔮 **Grok X-Ray**
Usage: \`${prefix} [query]\`
Examples:
• ${prefix} $DOGE sentiment
• ${prefix} CA: 0x123...456
• ${prefix} What is the vibe on X for Bitcoin?`);
                return;
            }

            const thinkingMessage = await message.reply('👁️ Grok is scanning X (Twitter)...');

            const response = await this.xaiService.analyzeCrypto(query);
            const formattedResponse = this.formatResponse(query, response);

            if ('edit' in thinkingMessage) {
                await thinkingMessage.edit(formattedResponse);
            } else {
                await message.reply(formattedResponse);
            }

        } catch (error) {
            console.error('Error in Grok feature:', error);
            await message.reply('❌ Grok brain freeze. Try again.');
        } finally {
            this.processingMessages.delete(messageId);
        }
    }

    private formatResponse(query: string, response: string): string {
        return `🧠 **Grok Analysis**
───────────────
🔎 **Query**: ${query}

${response}
───────────────
*Powered by xAI*`;
    }
}
