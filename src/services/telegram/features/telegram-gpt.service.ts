import { OpenAIService } from '../../../services/openai.service';
import type { Api } from 'telegram';
import { config } from '../../../config/config';

interface Conversation {
    messages: Array<{ role: string; content: string }>;
    lastActive: number;
}

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

    async handle(message: Api.Message): Promise<void> {
        const messageText = message.text || '';
        const chatId = message.chatId?.toString() || message.peerId?.toString();

        if (!chatId) return;

        const messageId = `${chatId}_${message.id}`;
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
            const thinkingMessage = await message.reply({
                message: '🤔 Thinking...',
            });

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
            
            await this.client.editMessage(chatId, {
                message: thinkingMessage.id,
                text: formattedResponse,
                parseMode: config.bot.enableMarkdown ? 'markdown' : undefined,
            });

        } catch (error) {
            console.error('Error handling message:', error);
            await message.reply({
                message: '❌ Sorry, there was an error processing your request.',
            });
        } finally {
            this.processingMessages.delete(messageId);
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

    private async handleCommands(message: Api.Message, command: string): Promise<boolean> {
        const chatId = message.chatId?.toString() || message.peerId?.toString();
        if (!chatId) return false;
        
        switch (command.toLowerCase()) {
            case 'clear':
                this.conversations.delete(chatId);
                await message.reply({ 
                    message: '🧹 Conversation history cleared!',
                    parseMode: config.bot.enableMarkdown ? 'markdown' : undefined,
                });
                return true;

            case 'help':
                await message.reply({ 
                    message: `🤖 **GPT-4 Assistant Help**
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
                    parseMode: config.bot.enableMarkdown ? 'markdown' : undefined,
                });
                return true;

            default:
                return false;
        }
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