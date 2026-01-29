import { config } from '../../../config/config';
import { XAIService } from '../../xai.service';
import { Message } from 'telegraf/types';

export class TelegramGrokFeature {
    private processingMessages: Set<string> = new Set();

    constructor(
        private client: any,
        private xaiService: XAIService
    ) {}

    async handle(message: any): Promise<void> {
        const messageText = message.content || message.text || message.message || '';
        const chatId = message.chatId || message.chat?.id?.toString() || message.peerId?.toString();

        console.log('TelegramGrokFeature handling message:', { 
            hasContent: !!message.content, 
            hasText: !!message.text, 
            textLength: messageText.length,
            chatId 
        });

        if (!chatId) {
            console.log('TelegramGrokFeature: No chat ID found');
            return;
        }

        const messageId = `${chatId}_${message.message_id || message.id || Date.now()}`;
        if (this.processingMessages.has(messageId)) {
            console.log('TelegramGrokFeature: Duplicate message', messageId);
            return;
        }
        this.processingMessages.add(messageId);

        // Strip prefix (defaults to !grok)
        const prefix = config.bot.grokPrefix || '!grok';
        if (!messageText.startsWith(prefix)) {
            console.log(`TelegramGrokFeature: Message "${messageText}" does not start with prefix "${prefix}"`);
            this.processingMessages.delete(messageId);
            return;
        }

        const query = messageText.slice(prefix.length).trim();

        try {
            if (!query) {
                const helpMsg = `🔮 **Grok X-Ray**
Usage: ${prefix} [query]
Examples:
• ${prefix} $DOGE sentiment
• ${prefix} CA: 0x123...456
• ${prefix} What is the vibe on X for Bitcoin?`;
                
                await this.sendMessage(chatId, helpMsg);
                return;
            }

            // Send thinking message
            const thinkingMsg = await this.sendMessage(chatId, '👁️ Grok is scanning X (Twitter)...');

            // Analyze
            const response = await this.xaiService.analyzeCrypto(query);
            const formattedResponse = this.formatResponse(query, response);

            // Edit message with response
            if (this.client.telegram) {
                // Telegraf
                await this.client.telegram.editMessageText(
                    chatId,
                    thinkingMsg.message_id,
                    undefined,
                    formattedResponse,
                    { parse_mode: 'Markdown' }
                );
            } else {
                // GramJS / SelfClient
                await this.client.editMessage(chatId, {
                    message: thinkingMsg.id,
                    text: formattedResponse,
                });
            }

        } catch (error) {
            console.error('Error in Grok feature:', error);
            await this.sendMessage(chatId, '❌ Grok brain freeze. Try again.');
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

    private async sendMessage(chatId: string, text: string): Promise<any> {
        if (this.client.telegram) {
            return await this.client.telegram.sendMessage(chatId, text, { parse_mode: 'Markdown' });
        } else {
            return await this.client.sendMessage(chatId, { message: text });
        }
    }
}
