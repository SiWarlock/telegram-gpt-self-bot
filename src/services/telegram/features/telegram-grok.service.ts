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



        if (!chatId) {

            return;
        }

        const messageId = `${chatId}_${message.message_id || message.id || Date.now()}`;
        if (this.processingMessages.has(messageId)) {

            return;
        }
        this.processingMessages.add(messageId);

        // Strip prefix (defaults to !grok)
        const prefix = config.bot.grokPrefix || '!grok';
        if (!messageText.startsWith(prefix)) {

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
            const thinkingMsg = await this.sendMessage(chatId, '👁️ Grok is thinking...');

            // Analyze vs Chat logic
            const cryptoKeywords = ['sentiment', 'ca:', '$', 'token', 'scan', 'analyze', 'audit', 'check', 'price', 'volume'];
            const isCryptoQuery = cryptoKeywords.some(k => query.toLowerCase().includes(k));

            let response: string;
            if (isCryptoQuery) {
                await this.editMessage(chatId, thinkingMsg, '👁️ Grok is scanning X (Twitter)...');
                response = await this.xaiService.analyzeCrypto(query);
            } else {
                response = await this.xaiService.chat(query);
            }

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

    private async editMessage(chatId: string, message: any, text: string): Promise<void> {
        try {
            if (this.client.telegram) {
                // Telegraf
                await this.client.telegram.editMessageText(
                    chatId,
                    message.message_id,
                    undefined,
                    text,
                    { parse_mode: 'Markdown' }
                );
            } else {
                // GramJS / SelfClient
                await this.client.editMessage(chatId, {
                    message: message.id,
                    text: text,
                });
            }
        } catch (error) {
            console.error('Error editing message:', error);
        }
    }
}
