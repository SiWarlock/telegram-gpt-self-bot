import { Telegraf, Context } from 'telegraf';
import { Update, Message } from 'telegraf/types';
import { NewMessage } from 'telegram/events';
import { config } from '../../config/config';
import { BaseBotService, IBotMessage, IBotResponse } from '../bot/base-bot.service';
import { OpenAIService } from '../openai.service';
import { GPTFeature } from './features/telegram-gpt.service';
import { TelegramGrokFeature } from './features/telegram-grok.service';
import { TLDRFeature } from './features/telegram-tldr.service';
import { SelfDestructFeature } from './features/telegram-self-destruct.service';
import { GameFeature } from './features/telegram-game.service';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { XAIService } from '../xai.service';

type BotContext = Context<Update>;
type TextMessage = Message.TextMessage;

export class TelegramBotService extends BaseBotService {
    private bot: any;
    private selfClient: any;
    private mode: 'bot' | 'self';
    private gptFeature: GPTFeature;
    private grokFeature: TelegramGrokFeature;
    private tldrFeature: TLDRFeature;
    private selfDestructFeature: SelfDestructFeature;
    private gameFeature: GameFeature;
    private conversations: Map<string, any> = new Map();

    constructor(config: any, openAIService: OpenAIService, xaiService: XAIService) {
        super(config.telegram.ownerId);
        this.mode = config.telegram.mode;
        console.log('Initializing TelegramBotService with mode:', this.mode, 'ownerId:', this.ownerId);

        if (this.mode === 'bot') {
            this.bot = new Telegraf(config.telegram.botToken);
            this.setupBotHandlers();
        } else {
            const apiId = parseInt(config.telegram.apiId);
            if (isNaN(apiId)) {
                throw new Error('Invalid API ID');
            }
            this.selfClient = new TelegramClient(
                new StringSession(config.telegram.sessionString),
                apiId,
                config.telegram.apiHash,
                { connectionRetries: 5 }
            );
            this.setupSelfBotHandlers();
        }

        // Initialize features
        const client = this.mode === 'bot' ? this.bot : this.selfClient;
        this.gptFeature = new GPTFeature(client, openAIService, this.conversations);
        this.grokFeature = new TelegramGrokFeature(client, xaiService);
        this.tldrFeature = new TLDRFeature(client, openAIService);
        this.selfDestructFeature = new SelfDestructFeature(client);
        this.gameFeature = new GameFeature(client);
    }

    private setupBotHandlers() {
        // Start command
        this.bot.command('start', async (ctx: any) => {
            await ctx.reply('👋 Hello! I am your AI assistant. Use /help to see available commands.');
        });

        // Handle text messages for bot mode
        this.bot.on('text', async (ctx: any) => {
            const message = {
                senderId: ctx.from.id.toString(),
                chatId: ctx.chat.id.toString(),
                content: ctx.message.text,
                username: ctx.from.username || '',
            };

            await this.handleBotMessage(message);
        });
    }

    private setupSelfBotHandlers() {
        this.selfClient.addEventHandler(async (event: any) => {
            const message = event.message;
            if (!message || !message.text) return;

            const botMessage: IBotMessage = {
                senderId: message.senderId?.toString() || '',
                chatId: message.chatId?.toString() || message.peerId?.toString() || '',
                content: message.text || message.message || '',
                username: message.sender?.username || '',
                message_id: message.id,
                originalMessage: message // Pass the raw message object
            };

            await this.handleSelfBotMessage(botMessage);
        }, new NewMessage({ incoming: true, outgoing: true }));
    }

    private async handleBotMessage(message: IBotMessage) {
        // Check if it's a command
        if (message.content.startsWith('!') || message.content.startsWith('/')) {
            const command = message.content.slice(1).split(' ')[0].toLowerCase();

            // RBAC commands
            if (['roles', 'grant', 'revoke', 'role', 'perms'].includes(command)) {
                const response = await this.handleRBACCommand(command, message);
                await this.sendMessage(message.chatId, response);
                return;
            }

            // Feature commands
            // Allow owner to bypass permission checks
            if (!this.isOwner(message.senderId) && !await this.checkPermission(message.senderId, 'use_bot')) {
                await this.sendMessage(message.chatId, { content: "⛔ You don't have permission to use this bot" });
                return;
            }

            // Handle other commands
            await this.handleFeatureCommand(command, message);
        }
    }

    private async handleSelfBotMessage(message: IBotMessage) {
        // Only process messages from the owner in self-bot mode
        if (!this.isOwner(message.senderId)) {
            // console.log('Ignoring message from non-owner in self-bot mode');
            return;
        }

        if (message.content.startsWith('!') || message.content.startsWith('/')) {
            const command = message.content.slice(1).split(' ')[0].toLowerCase();
            
            // Handle commands without permission checks in self-bot mode
            if (['roles', 'grant', 'revoke', 'role', 'perms'].includes(command)) {
                const response = await this.handleRBACCommand(command, message);
                await this.sendMessage(message.chatId, response);
                return;
            }

            await this.handleFeatureCommand(command, message);
        }
    }

    private async handleFeatureCommand(command: string, message: IBotMessage) {
        try {
            switch (command) {
                case 'gpt':
                    await this.gptFeature.handle(message);
                    break;
                case 'grok':
                    await this.grokFeature.handle(message);
                    break;
                case 'tldr':
                    await this.tldrFeature.handle(message);
                    break;
                case 'sd':
                    await this.selfDestructFeature.handle(message);
                    break;
                case 'game':
                    await this.gameFeature.handle({
                        message,
                        _eventName: 'message',
                        _client: this.mode === 'bot' ? this.bot : this.selfClient,
                        originalUpdate: message
                    });
                    break;
                default:
                    await this.sendMessage(message.chatId, { content: '❌ Unknown command' });
            }
        } catch (error) {
            console.error('Error handling feature command:', error);
            await this.sendMessage(message.chatId, { content: '❌ An error occurred while processing your command' });
        }
    }

    protected async resolveUserId(username: string): Promise<string | null> {
        try {
            if (this.mode === 'bot') {
                const chat = await this.bot.telegram.getChat(username);
                return chat?.id?.toString() || null;
            } else {
                const result = await this.selfClient.invoke(new Api.users.GetUsers({
                    id: [username]
                }));
                return result[0]?.id?.toString() || null;
            }
        } catch (error) {
            console.error('Error resolving user ID:', error);
            return null;
        }
    }

    protected async sendMessage(chatId: string, response: IBotResponse): Promise<void> {
        try {
            const numericChatId = parseInt(chatId);
            if (isNaN(numericChatId)) {
                console.error('Invalid chat ID:', chatId);
                return;
            }

            if (this.mode === 'bot') {
                await this.bot.telegram.sendMessage(numericChatId, response.content);
            } else {
                await this.selfClient.sendMessage(numericChatId, { message: response.content });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    public async start(): Promise<void> {
        if (this.mode === 'bot') {
            await this.bot.launch();
            console.log('Telegram bot started');
        } else {
            await this.selfClient.connect();
            console.log('Telegram self-bot connected');
        }
    }

    public async stop(): Promise<void> {
        if (this.mode === 'bot') {
            await this.bot.stop();
        } else {
            await this.selfClient.disconnect();
        }
    }
} 