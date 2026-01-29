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
        // Handle standard IBotMessage structure (content) or legacy/Telegraf (text)
        const messageText = message.content || message.text || message.message || '';
        
        // Handle IBotMessage (chatId) or Telegraf/GramJS structure
        const chatId = message.chatId || message.chat?.id?.toString() || message.peerId?.toString();

        if (!chatId) return;

        const messageId = `${chatId}_${message.message_id || message.id || Date.now()}`;
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
            // Handle both Telegraf bot and Telegram client
            // For GramJS (self-bot), try to use the original message wrapper to reply
            // This fixes 'Could not find input entity' errors
            let thinkingMessage;
            if (this.client.telegram) {
                 thinkingMessage = await this.client.telegram.sendMessage(chatId, '🤔 Thinking...');
            } else {
                if (message.originalMessage && typeof message.originalMessage.reply === 'function') {
                    thinkingMessage = await message.originalMessage.reply({ message: '🤔 Thinking...' });
                } else {
                    thinkingMessage = await this.client.sendMessage(chatId, { message: '🤔 Thinking...' });
                }
            }

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
            
            // Handle both Telegraf bot and Telegram client for editing
            if (this.client.telegram) {
                await this.client.telegram.editMessageText(
                    chatId,
                    thinkingMessage.message_id,
                    undefined,
                    formattedResponse,
                    { parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined }
                );
            } else {
                // GramJS - Check if thinkingMessage is an object with edit method
                if (thinkingMessage && typeof thinkingMessage.edit === 'function') {
                    await thinkingMessage.edit({ text: formattedResponse });
                } else {
                    await this.client.editMessage(chatId, {
                        message: thinkingMessage.id,
                        text: formattedResponse,
                    });
                }
            }

        } catch (error) {
            console.error('Error handling GPT feature message:', error);
            // Handle both Telegraf bot and Telegram client for error messages
            if (this.client.telegram) {
                await this.client.telegram.sendMessage(chatId, '❌ Sorry, there was an error processing your request.');
            } else {
                // Try replying to original message if available for error too
                 if (message.originalMessage && typeof message.originalMessage.reply === 'function') {
                    await message.originalMessage.reply({ message: '❌ Sorry, error processing request.' });
                 } else {
                    await this.client.sendMessage(chatId, { message: '❌ Sorry, there was an error processing your request.' });
                 }
            }
        } finally {
            this.processingMessages.delete(messageId);
        }
    }

    private async handleCommands(message: any, command: string): Promise<boolean> {
        // Handle IBotMessage (chatId) or Telegraf/GramJS structure
        const chatId = message.chatId || message.chat?.id?.toString() || message.peerId?.toString();
        
        if (!chatId) return false;
        
        switch (command.toLowerCase()) {
            case 'clear':
                this.conversations.delete(chatId);
                // Handle both Telegraf bot and Telegram client
                if (this.client.telegram) {
                    await this.client.telegram.sendMessage(chatId, '🧹 Conversation history cleared!', {
                        parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined
                    });
                } else {
                    await this.client.sendMessage(chatId, { message: '🧹 Conversation history cleared!' });
                }
                return true;

            case 'help':
                const helpMessage = `🤖 **GPT-4 Assistant Help**
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
───────────────`;
                
                // Handle both Telegraf bot and Telegram client
                if (this.client.telegram) {
                    await this.client.telegram.sendMessage(chatId, helpMessage, {
                        parse_mode: config.bot.enableMarkdown ? 'Markdown' : undefined
                    });
                } else {
                    await this.client.sendMessage(chatId, { message: helpMessage });
                }
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