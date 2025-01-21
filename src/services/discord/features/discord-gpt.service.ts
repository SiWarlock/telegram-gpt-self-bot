import { Client as BotClient, Message as BotMessage } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage } from 'discord.js-selfbot-v13';
import { OpenAIService } from '../../openai.service';
import { config } from '../../../config/config';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;

interface Conversation {
    messages: Array<{ role: string; content: string }>;
    lastActive: number;
}

export class DiscordGPTFeature {
    private processingMessages: Set<string> = new Set();
    private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor(
        private client: AnyClient,
        private openAIService: OpenAIService,
        private conversations: Map<string, Conversation>
    ) {
        setInterval(() => this.cleanupOldConversations(), 5 * 60 * 1000);
    }

    async handle(message: AnyMessage): Promise<void> {
        const messageText = message.content;
        const channelId = message.channel.id;

        if (!channelId) return;

        const messageId = `${channelId}_${message.id}`;
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
            const thinkingMessage = await message.reply('🤔 Thinking...');

            if (!this.conversations.has(channelId)) {
                this.conversations.set(channelId, {
                    messages: [],
                    lastActive: Date.now()
                });
            }

            const conversation = this.conversations.get(channelId)!;
            conversation.lastActive = Date.now();
            conversation.messages.push({ role: 'user', content: input });

            if (conversation.messages.length > config.bot.maxConversationLength) {
                conversation.messages = conversation.messages.slice(-config.bot.maxConversationLength);
            }

            const response = await this.openAIService.generateResponse(conversation.messages);
            conversation.messages.push({ role: 'assistant', content: response });

            const formattedResponse = this.formatResponse(input, response, conversation.messages.length);
            
            if ('edit' in thinkingMessage) {
                await thinkingMessage.edit(formattedResponse);
            } else {
                await message.reply(formattedResponse);
            }

        } catch (error) {
            console.error('Error handling GPT message:', error);
            await message.reply('❌ Sorry, there was an error processing your request.');
        } finally {
            this.processingMessages.delete(messageId);
        }
    }

    private async handleCommands(message: AnyMessage, command: string): Promise<boolean> {
        const channelId = message.channel.id;
        
        switch (command.toLowerCase()) {
            case 'clear':
                this.conversations.delete(channelId);
                await message.reply('🧹 Conversation history cleared!');
                return true;

            case 'help':
                await message.reply(`🤖 **GPT-4 Assistant Help**
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
───────────────`);
                return true;

            default:
                return false;
        }
    }

    private formatResponse(prompt: string, response: string, messageCount: number): string {
        const timestamp = config.bot.showTimestamps ? new Date().toLocaleTimeString() : '';
        
        return `🤖 **GPT-4 Response** (#${messageCount})
───────────────
📝 **Query**: ${prompt}

${response}

───────────────
${timestamp ? `⏰ ${timestamp} | ` : ''}💭 ${messageCount} messages in conversation
🔄 Commands:
• ${config.bot.triggerPrefix} [question] - Ask a question
• ${config.bot.triggerPrefix} clear - Clear history
• ${config.bot.triggerPrefix} help - Show help`;
    }

    private cleanupOldConversations() {
        const now = Date.now();
        for (const [channelId, conversation] of this.conversations.entries()) {
            if (now - conversation.lastActive > this.CONVERSATION_TIMEOUT) {
                this.conversations.delete(channelId);
            }
        }
    }
} 