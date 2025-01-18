import { Telegraf, Context } from 'telegraf';
import { Update, Message } from 'telegraf/types';
import { config } from '../../config/config';
import { PermissionsService } from '../permissions/permissions.service';

type BotContext = Context<Update>;

export class TelegramBotService {
    private bot: Telegraf<BotContext>;
    private readonly OWNER_ID: string;
    private permissionsService: PermissionsService;

    constructor() {
        if (!config.telegram.botToken) {
            throw new Error('TELEGRAM_BOT_TOKEN is not configured');
        }

        this.bot = new Telegraf<BotContext>(config.telegram.botToken);
        this.OWNER_ID = config.telegram.ownerId || '';
        this.permissionsService = new PermissionsService();

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
                const roles = await this.permissionsService.getUserRoles(userId || '');
                if (roles.length > 0) {
                    const permissions = await this.permissionsService.getUserPermissions(userId || '');
                    await ctx.reply(
                        '👋 Welcome! Here are your current permissions:\n\n' +
                        `🎭 Roles: ${roles.join(', ')}\n` +
                        `📋 Permissions: ${permissions.join(', ')}`
                    );
                } else {
                    await ctx.reply('⚠️ You don\'t have any roles or permissions yet. Please contact the bot owner.');
                }
            }
        });

        // Middleware to check permissions for all commands except /start
        this.bot.use(async (ctx, next) => {
            if (!ctx.message || !('text' in ctx.message) || !ctx.message.text.startsWith('/')) {
                return next();
            }

            const command = ctx.message.text.split(' ')[0].substring(1); // Remove the '/'
            if (command === 'start') {
                return next();
            }

            const userId = ctx.from?.id.toString();
            
            // Owner always has access
            if (userId === this.OWNER_ID) {
                return next();
            }

            // Check if user has any required permission
            const hasPermission = await this.permissionsService.hasPermission(userId || '', 'use_bot');
            if (!hasPermission) {
                await ctx.reply('⛔ Access denied. You need appropriate permissions to use this command.');
                return;
            }

            return next();
        });

        // Handle permission commands
        this.bot.command('grant', this.ownerOnly(async (ctx) => {
            const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
            const chatId = ctx.chat?.id;

            if (!messageText || !chatId) {
                await ctx.reply('❌ Invalid command context');
                return;
            }

            const args = messageText.split(' ').slice(1);
            if (args.length !== 2) {
                await ctx.reply('❌ Usage: /grant @username permission');
                return;
            }

            const [username, permission] = args;
            const cleanUsername = username.replace('@', '');

            try {
                const users = await ctx.telegram.getChatAdministrators(chatId);
                const targetUser = users.find(u => u.user.username === cleanUsername);
                
                if (!targetUser) {
                    await ctx.reply('❌ User not found in this chat');
                    return;
                }

                const granted = await this.permissionsService.grantPermission(targetUser.user.id.toString(), permission);
                if (granted) {
                    await ctx.reply(`✅ Granted "${permission}" permission to @${cleanUsername}`);
                } else {
                    await ctx.reply(`ℹ️ @${cleanUsername} already has "${permission}" permission`);
                }
            } catch (error) {
                console.error('Error granting permission:', error);
                await ctx.reply('❌ Failed to grant permission');
            }
        }));

        this.bot.command('revoke', this.ownerOnly(async (ctx) => {
            const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
            const chatId = ctx.chat?.id;

            if (!messageText || !chatId) {
                await ctx.reply('❌ Invalid command context');
                return;
            }

            const args = messageText.split(' ').slice(1);
            if (args.length !== 2) {
                await ctx.reply('❌ Usage: /revoke @username permission');
                return;
            }

            const [username, permission] = args;
            const cleanUsername = username.replace('@', '');

            try {
                const users = await ctx.telegram.getChatAdministrators(chatId);
                const targetUser = users.find(u => u.user.username === cleanUsername);
                
                if (!targetUser) {
                    await ctx.reply('❌ User not found in this chat');
                    return;
                }

                const revoked = await this.permissionsService.revokePermission(targetUser.user.id.toString(), permission);
                if (revoked) {
                    await ctx.reply(`✅ Revoked "${permission}" permission from @${cleanUsername}`);
                } else {
                    await ctx.reply(`ℹ️ @${cleanUsername} doesn't have "${permission}" permission`);
                }
            } catch (error) {
                console.error('Error revoking permission:', error);
                await ctx.reply('❌ Failed to revoke permission');
            }
        }));

        this.bot.command('role', this.ownerOnly(async (ctx) => {
            const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
            const chatId = ctx.chat?.id;

            if (!messageText || !chatId) {
                await ctx.reply('❌ Invalid command context');
                return;
            }

            const args = messageText.split(' ').slice(1);
            if (args.length !== 2) {
                await ctx.reply('❌ Usage: /role @username rolename');
                return;
            }

            const [username, role] = args;
            const cleanUsername = username.replace('@', '');

            try {
                const users = await ctx.telegram.getChatAdministrators(chatId);
                const targetUser = users.find(u => u.user.username === cleanUsername);
                
                if (!targetUser) {
                    await ctx.reply('❌ User not found in this chat');
                    return;
                }

                const assigned = await this.permissionsService.assignRole(targetUser.user.id.toString(), role);
                if (assigned) {
                    const permissions = await this.permissionsService.getRolePermissions(role);
                    await ctx.reply(
                        `✅ Assigned role "${role}" to @${cleanUsername}\n` +
                        `📋 Permissions: ${permissions.join(', ')}`
                    );
                } else {
                    await ctx.reply(`❌ Invalid role "${role}" or user already has this role`);
                }
            } catch (error) {
                console.error('Error assigning role:', error);
                await ctx.reply('❌ Failed to assign role');
            }
        }));

        this.bot.command('roles', this.ownerOnly(async (ctx) => {
            try {
                const availableRoles = await this.permissionsService.getAvailableRoles();
                let message = '🎭 **Available Roles**\n\n';
                
                for (const role of availableRoles) {
                    const permissions = await this.permissionsService.getRolePermissions(role);
                    message += `• ${role}:\n  ${permissions.join(', ')}\n\n`;
                }

                await ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error listing roles:', error);
                await ctx.reply('❌ Failed to list roles');
            }
        }));

        this.bot.command('perms', this.ownerOnly(async (ctx) => {
            const messageText = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
            const chatId = ctx.chat?.id;

            if (!messageText || !chatId) {
                await ctx.reply('❌ Invalid command context');
                return;
            }

            const args = messageText.split(' ').slice(1);
            if (args.length !== 1) {
                await ctx.reply('❌ Usage: /perms @username');
                return;
            }

            const username = args[0];
            const cleanUsername = username.replace('@', '');

            try {
                const users = await ctx.telegram.getChatAdministrators(chatId);
                const targetUser = users.find(u => u.user.username === cleanUsername);
                
                if (!targetUser) {
                    await ctx.reply('❌ User not found in this chat');
                    return;
                }

                const userId = targetUser.user.id.toString();
                const roles = await this.permissionsService.getUserRoles(userId);
                const permissions = await this.permissionsService.getUserPermissions(userId);

                let message = `👤 **Permissions for @${cleanUsername}**\n\n`;
                message += `🎭 Roles: ${roles.join(', ') || 'None'}\n\n`;
                message += `📋 Permissions: ${permissions.join(', ') || 'None'}`;

                await ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error getting permissions:', error);
                await ctx.reply('❌ Failed to get permissions');
            }
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