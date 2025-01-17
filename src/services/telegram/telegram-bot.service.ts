import { Telegraf, Context } from 'telegraf';
import { Update, Message } from 'telegraf/types';
import { config } from '../../config/config';

// We don't need to explicitly define message since it's already in Context
type BotContext = Context<Update>;

export class TelegramBotService {
    private bot: Telegraf<BotContext>;
    private readonly OWNER_ID: string;

    constructor() {
        if (!config.telegram.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured');
        }

        this.bot = new Telegraf<BotContext>(config.telegram.botToken);
        this.OWNER_ID = config.telegram.ownerId || '';

        this.setupCommands();
    }

    private setupCommands(): void {
        // Start command - initial greeting and auth check
        this.bot.command('start', async (ctx) => {
            const userId = ctx.from?.id.toString();
            if (userId === this.OWNER_ID) {
                await ctx.reply(
                    '🔐 Welcome back, owner! I\'m your management bot.\n\n' +
                    'Available commands:\n' +
                    '/dashboard - Open the main dashboard\n' +
                    '/users - Manage user permissions\n' +
                    '/roles - Configure roles\n' +
                    '/settings - Bot settings'
                );
            } else {
                await ctx.reply('⚠️ This bot is private and can only be used by the owner.');
            }
        });

        // Dashboard command - shows main control panel
        this.bot.command('dashboard', this.ownerOnly(async (ctx) => {
            await ctx.reply(
                '🎛 **Dashboard**\n\n' +
                '👥 Users: 0 managed\n' +
                '🎭 Roles: Default configuration\n' +
                '⚙️ Settings: All systems operational\n\n' +
                'Use the commands below to manage:\n' +
                '/users - User Management\n' +
                '/roles - Role Configuration\n' +
                '/settings - Bot Settings',
                { parse_mode: 'Markdown' }
            );
        }));

        // Users command - shows user management interface
        this.bot.command('users', this.ownerOnly(async (ctx) => {
            await ctx.reply(
                '👥 **User Management**\n\n' +
                'No users configured yet.\n\n' +
                'To manage users from any chat:\n' +
                '`!grant @user permission` - Grant permission\n' +
                '`!revoke @user permission` - Revoke permission\n' +
                '`!role @user role` - Set user role\n' +
                '`!perms @user` - Check user permissions',
                { parse_mode: 'Markdown' }
            );
        }));

        // Roles command - shows role configuration interface
        this.bot.command('roles', this.ownerOnly(async (ctx) => {
            await ctx.reply(
                '🎭 **Role Configuration**\n\n' +
                'Available Roles:\n' +
                '• admin - Full access\n' +
                '• moderator - Limited management\n' +
                '• user - Basic access\n\n' +
                'To manage roles from any chat:\n' +
                '`!role @user role` - Assign role\n' +
                '`!roles` - List available roles',
                { parse_mode: 'Markdown' }
            );
        }));

        // Settings command - shows bot settings interface
        this.bot.command('settings', this.ownerOnly(async (ctx) => {
            await ctx.reply(
                '⚙️ **Bot Settings**\n\n' +
                'Current Configuration:\n' +
                '• Silent Mode: Disabled\n' +
                '• Logging: Enabled\n' +
                '• Auto-cleanup: Disabled\n\n' +
                'Use inline buttons below to modify settings.',
                { parse_mode: 'Markdown' }
            );
        }));

        // Error handling
        this.bot.catch((err: any, ctx) => {
            console.error('Bot error:', err);
            ctx.reply('❌ An error occurred while processing your request.');
        });
    }

    // Middleware to ensure only owner can access certain commands
    private ownerOnly(handler: (ctx: BotContext) => Promise<void>) {
        return async (ctx: BotContext) => {
            const userId = ctx.from?.id.toString();
            if (userId !== this.OWNER_ID) {
                await ctx.reply('⚠️ This command can only be used by the bot owner.');
                return;
            }
            await handler(ctx);
        };
    }

    async start(): Promise<void> {
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