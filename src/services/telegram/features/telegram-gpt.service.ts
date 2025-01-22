import { Telegraf } from 'telegraf';
import { Message, Update } from 'telegraf/types';
import { OpenAIService } from '../../../services/openai.service';
import { config } from '../../../config/config';

interface Conversation {
    messages: Array<{ role: string; content: string }>;
    lastActive: number;
}

type TextMessage = Message.TextMessage;

export class GPTFeature {
    private processingMessages: Set<string> = new Set();
    private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor(
        private client: any,
        private openAIService: OpenAIService,
        private conversations: Map<string, Conversation>
    ) {
        setInterval(() => this.cleanupOldConversations(), 5 * 60 * 1000);
    }

    async handle(message: any): Promise<void> {
        const messageText = message.text;
        const chatId = message.chat.id.toString();

        if (!chatId) return;

        const messageId = `${chatId}_${message.message_id}`;
        if (this.processingMessages.has(messageId)) {
            return;
        }
        this.processingMessages.add(messageId);

        const input = messageText.slice(config.bot.triggerPrefix.length).trim();
        
        if (await this.handleCommands(message, input)) {
            this.processingMessages.delete(messageId);
            return;
        }

        try {
            const thinkingMessage = await this.client.telegram.sendMessage(chatId, '🤔 Thinking...');

            if (!thinkingMessage) {
                throw new Error('Failed to send thinking message');
            }

            if (!this.conversations.has(chatId)) {
                this.conversations.set(chatId, {
                    messages: [],
                    lastActive: Date.now()
                });
            }

            const conversation = this.conversations.get(chatId)!;
            conversation.lastActive = Date.now();
            conversation.messages.push({ role: 'user', content: input });

            if (conversation.messages.length > config.bot.maxConversationLength) {
                conversation.messages = conversation.messages.slice(-config.bot.maxConversationLength);
            }

            const response = await this.openAIService.generateResponse(conversation.messages);
            conversation.messages.push({ role: 'assistant', content: response });

            const formattedResponse = this.formatResponse(input, response, conversation.messages.length);
            
            await this.client.telegram.editMessageText(
                chatId,
                thinkingMessage.message_id,
                undefined,
                formattedResponse,
                { parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined }
            );

        } catch (error) {
            console.error('Error handling message:', error);
            await this.client.telegram.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
        } finally {
            this.processingMessages.delete(messageId);
        }
    }

    private async handleCommands(message: Message, command: string): Promise<boolean> {
        const chatId = message.chat.id.toString();
        
        switch (command.toLowerCase()) {
            case 'clear':
                this.conversations.delete(chatId);
                await this.client.telegram.sendMessage(chatId, '🧹 Conversation history cleared!', {
                    parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined
                });
                return true;

            case 'help':
                await this.client.telegram.sendMessage(chatId, 
                    `🤖 **GPT-4 Assistant Help**
───────────────
Available commands:
• ${config.bot.triggerPrefix} [question] - Ask GPT-4 a question
• ${config.bot.triggerPrefix} clear - Clear conversation history
• ${config.bot.triggerPrefix} help - Show this help message

Features:
• Conversation memory
• Code formatting
• Markdown support
• Message threading
───────────────`,
                    { parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined }
                );
                return true;

            default:
                return false;
        }
    }

    private formatResponse(prompt: string, response: string, messageCount: number): string {
        const timestamp = config.bot.showTimestamps ? new Date().toLocaleTimeString() : '';
        const formattedResponse = this.formatCode(response);
        
        return `🤖 **GPT-4 Response** (#${messageCount})
───────────────
📝 **Query**: ${prompt}

${formattedResponse}

───────────────
${timestamp ? `⏰ ${timestamp} | ` : ''}💭 ${messageCount} messages in conversation
🔄 Commands:
• ${config.bot.triggerPrefix} [question] - Ask a question
• ${config.bot.triggerPrefix} clear - Clear history
• ${config.bot.triggerPrefix} help - Show help`;
    }

    private formatCode(response: string): string {
        return response.replace(/```(\w+)?\n([\s\S]+?)\n```/g, (_, lang, code) => {
            return `\`\`\`${lang || ''}\n${code.trim()}\n\`\`\``;
        });
    }

    private cleanupOldConversations() {
        const now = Date.now();
        for (const [chatId, conversation] of this.conversations.entries()) {
            if (now - conversation.lastActive > this.CONVERSATION_TIMEOUT) {
                this.conversations.delete(chatId);
            }
        }
    }
} 