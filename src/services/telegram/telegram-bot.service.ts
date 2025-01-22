import { Telegraf, Context } from 'telegraf';
import { Update, Message } from 'telegraf/types';
import { config } from '../../config/config';
import { BaseBotService, IBotMessage, IBotResponse } from '../bot/base-bot.service';
import { OpenAIService } from '../openai.service';
import { GPTFeature } from './features/telegram-gpt.service';
import { TLDRFeature } from './features/telegram-tldr.service';
import { SelfDestructFeature } from './features/telegram-self-destruct.service';
import { GameFeature } from './features/telegram-game.service';

type BotContext = Context<Update>;
type TextMessage = Message.TextMessage;

export class TelegramBotService extends BaseBotService {
    private bot: Telegraf<BotContext>;
    private openAIService: OpenAIService;
    private gptFeature: GPTFeature;
    private tldrFeature: TLDRFeature;
    private selfDestructFeature: SelfDestructFeature;
    private gameFeature: GameFeature;
    private conversations: Map<string, any> = new Map();

    constructor() {
        // Convert owner ID to string and ensure it's not undefined
        const ownerId = config.telegram.ownerId?.toString();
        if (!ownerId) {
            throw new Error('TELEGRAM_OWNER_ID is not configured');
        }
        super(ownerId);

        if (!config.telegram.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured');
        }

        this.bot = new Telegraf<BotContext>(config.telegram.botToken);
        this.openAIService = new OpenAIService();
        
        // Initialize features
        this.gptFeature = new GPTFeature(this.bot, this.openAIService, this.conversations);
        this.tldrFeature = new TLDRFeature(this.bot, this.openAIService);
        this.selfDestructFeature = new SelfDestructFeature(this.bot);
        this.gameFeature = new GameFeature(this.bot);

        this.setupCommands();
    }

    protected async resolveUserId(userIdentifier: string): Promise<string | null> {
        const username = userIdentifier.replace('@', '');
        try {
            // First get user info from username
            const users = await this.bot.telegram.getChat(username);
            if (!users || !users.id) return null;

            // Then get chat member using numeric ID
            const chatMember = await this.bot.telegram.getChatMember(parseInt(this.ownerId) || 0, users.id);
            return chatMember.user.id.toString();
        } catch {
            return null;
        }
    }

    protected async sendMessage(chatId: string, response: IBotResponse): Promise<void> {
        try {
            const numericChatId = parseInt(chatId) || 0;
            if (response.silent) {
                await this.bot.telegram.sendMessage(numericChatId, response.content, {
                    parse_mode: 'MarkdownV2'
                });
            } else {
                await this.bot.telegram.sendMessage(numericChatId, response.content, {
                    parse_mode: 'MarkdownV2'
                });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    private setupCommands(): void {
        // Middleware to check permissions for all commands except /start
        this.bot.use(async (ctx, next) => {
            if (!ctx.message || !('text' in ctx.message) || !ctx.message.text.startsWith('/')) {
                return next();
            }

            const command = ctx.message.text.split(' ')[0].substring(1);
            if (command === 'start') {
                return next();
            }

            const userId = ctx.from?.id.toString();
            if (!userId) return;
            
            // Check base bot permission
            if (!await this.checkPermission(userId, 'use_bot')) {
                await ctx.reply('⛔ Access denied. You need appropriate permissions to use this command.');
                return;
            }

            return next();
        });

        // Start command - initial greeting and auth check
        this.bot.command('start', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (!userId) return;

            if (userId === this.ownerId) {
                await ctx.reply(
                    '🔐 *Welcome back, owner\\!*\n\n' +
                    '📋 *Available Commands:*\n' +
                    '• /dashboard \\- Open the main dashboard\n' +
                    '• /users \\- Manage user permissions\n' +
                    '• /roles \\- Configure roles\n' +
                    '• /settings \\- Bot settings',
                    {
                        parse_mode: 'MarkdownV2',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📊 Dashboard', callback_data: 'dashboard' }],
                                [{ text: '👥 Users', callback_data: 'users' }, { text: '👑 Roles', callback_data: 'roles' }],
                                [{ text: '⚙️ Settings', callback_data: 'settings' }]
                            ]
                        }
                    }
                );
            } else {
                const roles = await this.rbacService.getUserRoles(userId);
                if (roles.length > 0) {
                    const permissions = await this.rbacService.getUserPermissions(userId);
                    await ctx.reply(
                        '👋 *Welcome\\!* Here are your current permissions:\n\n' +
                        `🎭 *Roles:* ${roles.map(r => `\`${r}\``).join(', ')}\n` +
                        `📋 *Permissions:* ${permissions.map(p => `\`${p}\``).join(', ')}`,
                        { parse_mode: 'MarkdownV2' }
                    );
                } else {
                    await ctx.reply('⚠️ You don\'t have any roles or permissions yet. Please contact the bot owner.');
                }
            }
        });

        // Handle message commands
        this.bot.on('text', async (ctx) => {
            const message = ctx.message as TextMessage;
            const userId = ctx.from?.id.toString();
            const chatId = ctx.chat?.id.toString();

            if (!message || !userId || !chatId) return;

            // Convert to common message format
            const botMessage: IBotMessage = {
                content: message.text,
                senderId: userId,
                chatId: chatId,
                username: ctx.from?.username
            };

            // Handle RBAC commands
            if (message.text.match(/^!(roles|grant|revoke|role|perms)\b/)) {
                const command = message.text.split(' ')[0].substring(1);
                const response = await this.handleRBACCommand(command, botMessage);
                await this.sendMessage(chatId, response);
                return;
            }

            // Handle feature commands
            try {
                if (message.text.startsWith(config.bot.triggerPrefix)) {
                    if (await this.checkPermission(userId, 'use_gpt')) {
                        await this.gptFeature.handle(message);
                    }
                } else if (message.text.startsWith(config.bot.selfDestructPrefix)) {
                    if (await this.checkPermission(userId, 'use_bot')) {
                        await this.selfDestructFeature.handle(message);
                    }
                } else if (message.text.startsWith(config.bot.tldrPrefix)) {
                    if (await this.checkPermission(userId, 'use_tldr')) {
                        await this.tldrFeature.handle(message);
                    }
                } else if (message.text.startsWith('!game')) {
                    if (await this.checkPermission(userId, 'use_games')) {
                        await this.gameFeature.handle(message);
                    }
                }
            } catch (error) {
                console.error('Error handling message:', error);
                await this.sendMessage(chatId, {
                    content: '❌ An error occurred while processing your request.'
                });
            }
        });

        // Error handling
        this.bot.catch((err: any) => {
            console.error('Bot error:', err);
        });
    }

    public async start(): Promise<void> {
        try {
            await this.bot.launch();
            console.log('Telegram bot started successfully');

            // Enable graceful stop
            process.once('SIGINT', () => this.bot.stop('SIGINT'));
            process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
        } catch (error) {
            console.error('Failed to start Telegram bot:', error);
            throw error;
        }
    }
} 