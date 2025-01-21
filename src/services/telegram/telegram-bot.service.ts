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
                const roles = await this.permissionsService.getUserRoles(userId || '');
                if (roles.length > 0) {
                    const permissions = await this.permissionsService.getUserPermissions(userId || '');
                    await ctx.reply(
                        '👋 *Welcome\\!* Here are your current permissions:\n\n' +
                        `🎭 *Roles:* ${roles.map(r => `\`${r}\``).join(', ')}\n` +
                        `📋 *Permissions:* ${permissions.map(p => `\`${p}\``).join(', ')}`,
                        { parse_mode: 'MarkdownV2' }
                    );
                } else {
                    await ctx.reply('⚠️ You don\'t have any roles or permissions yet\\. Please contact the bot owner\\.');
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

        // Handle callback queries
        this.bot.on('callback_query', async (ctx) => {
            const query = ctx.callbackQuery;
            if (!('data' in query)) return;
            
            const data = query.data;
            const userId = ctx.from?.id.toString();

            if (userId !== this.OWNER_ID) {
                await ctx.answerCbQuery('⛔ Only the bot owner can use these controls.');
                return;
            }

            switch (data) {
                case 'dashboard':
                    await this.handleDashboard(ctx);
                    break;
                case 'users':
                    await this.handleUsers(ctx);
                    break;
                case 'roles':
                    await this.handleRoles(ctx);
                    break;
                case 'settings':
                    await this.handleSettings(ctx);
                    break;
                case 'add_user':
                    await this.handleAddUser(ctx);
                    break;
                case 'edit_user':
                    await this.handleEditUserList(ctx);
                    break;
                case 'remove_user':
                    await this.handleRemoveUserList(ctx);
                    break;
                case 'back_to_users':
                    await this.handleUsers(ctx);
                    break;
            }

            // Handle dynamic callbacks
            if (data.startsWith('edit_user_')) {
                const targetUserId = data.replace('edit_user_', '');
                await this.handleEditUserMenu(ctx, targetUserId);
            } else if (data.startsWith('remove_user_')) {
                const targetUserId = data.replace('remove_user_', '');
                await this.handleRemoveUserConfirm(ctx, targetUserId);
            } else if (data.startsWith('toggle_role_')) {
                const [_, userId, roleName] = data.split('_').slice(1);
                await this.handleToggleRole(ctx, userId, roleName);
            } else if (data.startsWith('toggle_perm_')) {
                const [_, userId, permName] = data.split('_').slice(1);
                await this.handleTogglePermission(ctx, userId, permName);
            } else if (data.startsWith('confirm_remove_')) {
                const targetUserId = data.replace('confirm_remove_', '');
                await this.handleRemoveUser(ctx, targetUserId);
            }

            // Acknowledge the callback query
            await ctx.answerCbQuery();
        });

        // Handle replies for adding users
        this.bot.on('message', async (ctx) => {
            if (!ctx.message || !('reply_to_message' in ctx.message)) return;
            
            const replyTo = ctx.message.reply_to_message;
            if (!replyTo || !('text' in replyTo)) return;

            // Check if this is a reply to our "add user" message
            if (replyTo.text.includes('Reply with the username')) {
                await this.handleAddUserReply(ctx);
            }
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
                await ctx.reply(
                    '📝 *Usage:* /grant @username permission\n\n' +
                    '*Example:*\n' +
                    '`/grant @user use_gpt`',
                    { parse_mode: 'MarkdownV2' }
                );
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
                    await ctx.reply(
                        `✅ Granted \`${permission}\` permission to @${cleanUsername}`,
                        { parse_mode: 'MarkdownV2' }
                    );
                } else {
                    await ctx.reply(
                        `ℹ️ @${cleanUsername} already has \`${permission}\` permission`,
                        { parse_mode: 'MarkdownV2' }
                    );
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
                let message = '👑 *Available Roles*\n\n';
                
                for (const role of availableRoles) {
                    const permissions = await this.permissionsService.getRolePermissions(role);
                    message += `*${role}*\n`;
                    message += `📋 ${permissions.map(p => `\`${p}\``).join(', ')}\n\n`;
                }

                await ctx.reply(message, { 
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '➕ Add Role', callback_data: 'add_role' }],
                            [{ text: '✏️ Edit Role', callback_data: 'edit_role' }, { text: '🗑️ Delete Role', callback_data: 'delete_role' }],
                            [{ text: '🔙 Back', callback_data: 'dashboard' }]
                        ]
                    }
                });
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

    // New helper methods for handling callbacks
    private async handleDashboard(ctx: any) {
        const stats = await this.getStats();
        await ctx.editMessageText(
            '📊 *Dashboard*\n\n' +
            `👥 Total Users: \`${stats.users}\`\n` +
            `👑 Total Roles: \`${stats.roles}\`\n` +
            `🤖 Bot Uptime: \`${stats.uptime}\``,
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh', callback_data: 'dashboard' }],
                        [{ text: '👥 Users', callback_data: 'users' }, { text: '👑 Roles', callback_data: 'roles' }],
                        [{ text: '⚙️ Settings', callback_data: 'settings' }]
                    ]
                }
            }
        );
    }

    private async handleUsers(ctx: any) {
        const users = await this.permissionsService.getAllUsers();
        let message = '👥 *User Management*\n\n';
        
        for (const user of users) {
            const roles = await this.permissionsService.getUserRoles(user.id);
            message += `*@${user.username}*\n`;
            message += `🎭 Roles: ${roles.map(r => `\`${r}\``).join(', ')}\n\n`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Add User', callback_data: 'add_user' }],
                    [{ text: '✏️ Edit User', callback_data: 'edit_user' }, { text: '🗑️ Remove User', callback_data: 'remove_user' }],
                    [{ text: '🔙 Back', callback_data: 'dashboard' }]
                ]
            }
        });
    }

    private async handleRoles(ctx: any) {
        const roles = await this.permissionsService.getAvailableRoles();
        let message = '👑 *Role Management*\n\n';
        
        for (const role of roles) {
            const permissions = await this.permissionsService.getRolePermissions(role);
            message += `*${role}*\n`;
            message += `📋 ${permissions.map(p => `\`${p}\``).join(', ')}\n\n`;
        }

        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '➕ Add Role', callback_data: 'add_role' }],
                    [{ text: '✏️ Edit Role', callback_data: 'edit_role' }, { text: '🗑️ Delete Role', callback_data: 'delete_role' }],
                    [{ text: '🔙 Back', callback_data: 'dashboard' }]
                ]
            }
        });
    }

    private async handleSettings(ctx: any) {
        await ctx.editMessageText(
            '⚙️ *Bot Settings*\n\n' +
            '• Configure bot behavior\n' +
            '• Manage permissions\n' +
            '• Set up notifications',
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔔 Notifications', callback_data: 'settings_notifications' }],
                        [{ text: '🔒 Security', callback_data: 'settings_security' }],
                        [{ text: '🔙 Back', callback_data: 'dashboard' }]
                    ]
                }
            }
        );
    }

    private async getStats() {
        const users = await this.permissionsService.getUserCount();
        const roles = (await this.permissionsService.getAvailableRoles()).length;
        const uptime = this.formatUptime(process.uptime());

        return { users, roles, uptime };
    }

    private formatUptime(uptime: number): string {
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        
        return `${days}d ${hours}h ${minutes}m`;
    }

    private async handleAddUser(ctx: any) {
        await ctx.editMessageText(
            '👤 *Add New User*\n\n' +
            'Reply to this message with the username of the user you want to add\\.\n' +
            'You can use either:\\.\n' +
            '• Username \\(e\\.g\\. @username\\)\n' +
            '• User ID \\(if known\\)',
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Back', callback_data: 'back_to_users' }]
                    ]
                }
            }
        );
    }

    private async handleEditUserList(ctx: any) {
        const users = await this.permissionsService.getAllUsers();
        let message = '✏️ *Select User to Edit*\n\n';
        
        const keyboard = [];
        for (const user of users) {
            keyboard.push([{
                text: `@${user.username || user.id}`,
                callback_data: `edit_user_${user.id}`
            }]);
        }
        keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_users' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    private async handleEditUserMenu(ctx: any, userId: string) {
        const user = await this.permissionsService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('User not found');
            return;
        }

        const userRoles = await this.permissionsService.getUserRoles(userId);
        const userPerms = await this.permissionsService.getUserPermissions(userId);
        const allRoles = await this.permissionsService.getAvailableRoles();

        let message = `✏️ *Edit User: @${user.username || user.id}*\n\n`;
        message += '*Current Roles:*\n';
        
        const keyboard = [];
        // Add role toggles
        for (const role of allRoles) {
            const hasRole = userRoles.includes(role);
            keyboard.push([{
                text: `${hasRole ? '✅' : '❌'} Role: ${role}`,
                callback_data: `toggle_role_${userId}_${role}`
            }]);
        }

        // Add navigation
        keyboard.push([{ text: '🔙 Back to Users', callback_data: 'back_to_users' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    private async handleRemoveUserList(ctx: any) {
        const users = await this.permissionsService.getAllUsers();
        let message = '🗑️ *Select User to Remove*\n\n';
        
        const keyboard = [];
        for (const user of users) {
            keyboard.push([{
                text: `@${user.username || user.id}`,
                callback_data: `remove_user_${user.id}`
            }]);
        }
        keyboard.push([{ text: '🔙 Back', callback_data: 'back_to_users' }]);

        await ctx.editMessageText(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: keyboard }
        });
    }

    private async handleRemoveUserConfirm(ctx: any, userId: string) {
        const user = await this.permissionsService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('User not found');
            return;
        }

        await ctx.editMessageText(
            `⚠️ *Confirm Remove User*\n\n` +
            `Are you sure you want to remove @${user.username || user.id}?`,
            {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Yes, Remove', callback_data: `confirm_remove_${userId}` },
                            { text: '❌ No, Cancel', callback_data: 'back_to_users' }
                        ]
                    ]
                }
            }
        );
    }

    private async handleToggleRole(ctx: any, userId: string, roleName: string) {
        const user = await this.permissionsService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('User not found');
            return;
        }

        const hasRole = await this.permissionsService.hasRole(userId, roleName);
        if (hasRole) {
            await this.permissionsService.removeRole(userId, roleName);
        } else {
            await this.permissionsService.assignRole(userId, roleName);
        }

        // Refresh the edit menu
        await this.handleEditUserMenu(ctx, userId);
    }

    private async handleRemoveUser(ctx: any, userId: string) {
        try {
            await this.permissionsService.removeUser(userId);
            await ctx.editMessageText(
                '✅ User has been removed successfully\\.',
                {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Users', callback_data: 'back_to_users' }]
                        ]
                    }
                }
            );
        } catch (error) {
            console.error('Error removing user:', error);
            await ctx.editMessageText(
                '❌ Failed to remove user\\.',
                {
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔙 Back to Users', callback_data: 'back_to_users' }]
                        ]
                    }
                }
            );
        }
    }

    private async handleAddUserReply(ctx: any) {
        const text = ctx.message.text;
        let userId = text.replace('@', '');

        try {
            // Try to find user in the chat
            const chatMember = await ctx.getChatMember(userId);
            if (!chatMember) {
                await ctx.reply('❌ User not found in this chat');
                return;
            }

            // Add user to database
            const added = await this.permissionsService.addUser({
                id: chatMember.user.id.toString(),
                username: chatMember.user.username
            });

            if (added) {
                await ctx.reply(
                    `✅ User @${chatMember.user.username || chatMember.user.id} has been added\\.\n` +
                    'Use the edit menu to assign roles\\.',
                    { parse_mode: 'MarkdownV2' }
                );
            } else {
                await ctx.reply('❌ Failed to add user');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            await ctx.reply('❌ Failed to add user');
        }
    }

    private async handleTogglePermission(ctx: any, userId: string, permName: string) {
        const user = await this.permissionsService.getUser(userId);
        if (!user) {
            await ctx.answerCbQuery('User not found');
            return;
        }

        const hasPermission = await this.permissionsService.hasPermission(userId, permName);
        if (hasPermission) {
            await this.permissionsService.revokePermission(userId, permName);
        } else {
            await this.permissionsService.grantPermission(userId, permName);
        }

        // Refresh the edit menu
        await this.handleEditUserMenu(ctx, userId);
    }
} 