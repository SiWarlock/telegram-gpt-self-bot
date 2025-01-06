import { Client, Message } from 'discord.js-selfbot-v13';
import { OpenAIService } from '../../openai.service';
import { config } from '../../../config/config';

interface Conversation {
    messages: Array<{ role: string; content: string }>;
    lastActive: number;
}

export class DiscordGPTFeature {
    private readonly CONVERSATION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    constructor(
        private client: Client,
        private openAIService: OpenAIService,
        private conversations: Map<string, Conversation>
    ) {
        setInterval(() => this.cleanupOldConversations(), 5 * 60 * 1000);
    }

    async handle(message: Message): Promise<void> {
        const channelId = message.channel.id;
        const input = message.content.slice(config.bot.triggerPrefix.length).trim();
        
        if (await this.handleCommands(message, input)) {
            return;
        }

        try {
            const thinkingMsg = await message.reply('🤔 Thinking...');

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
            
            await thinkingMsg.edit(formattedResponse);

        } catch (error) {
            console.error('Error handling GPT message:', error);
            await message.reply('❌ Sorry, there was an error processing your request.');
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

    private async handleCommands(message: Message, command: string): Promise<boolean> {
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

    private cleanupOldConversations() {
        const now = Date.now();
        for (const [channelId, conversation] of this.conversations.entries()) {
            if (now - conversation.lastActive > this.CONVERSATION_TIMEOUT) {
                this.conversations.delete(channelId);
            }
        }
    }
} 