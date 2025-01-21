import { Client as BotClient, Message as BotMessage, MessageEmbed as BotEmbed, MessageActionRow as BotActionRow, MessageButton as BotButton, Intents, ClientOptions as BotOptions } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage, MessageEmbed as SelfEmbed, MessageActionRow as SelfActionRow, MessageButton as SelfButton, ClientOptions as SelfOptions } from 'discord.js-selfbot-v13';
import { config } from '../../config/config';
import { PermissionsService } from '../permissions/permissions.service';
import { DiscordRBACHandler } from './handlers/discord-rbac.handler';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;
type AnyEmbed = BotEmbed | SelfEmbed;

interface Log {
    timestamp: Date;
    action: string;
    details: string;
}

export class DiscordBotService {
    private client: AnyClient;
    private permissionsService: PermissionsService;
    private rbacHandler: DiscordRBACHandler;
    private isSelfBot: boolean;

    constructor() {
        this.isSelfBot = !config.discord.botToken;
        
        if (this.isSelfBot) {
            const options: SelfOptions = {
                ws: {
                    properties: {
                        browser: "Discord iOS",
                        os: "iOS",
                        device: "iPhone"
                    }
                }
            };
            this.client = new SelfClient(options);
        } else {
            const options: BotOptions = {
                intents: [
                    Intents.FLAGS.GUILDS,
                    Intents.FLAGS.GUILD_MESSAGES,
                    Intents.FLAGS.GUILD_MEMBERS,
                    Intents.FLAGS.DIRECT_MESSAGES
                ]
            };
            this.client = new BotClient(options);
        }

        this.permissionsService = new PermissionsService();
        this.rbacHandler = new DiscordRBACHandler(this.client, this.permissionsService);
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        if (this.isSelfBot) {
            const selfClient = this.client as SelfClient;
            selfClient.on('ready', this.handleReady.bind(this));
            selfClient.on('messageCreate', this.handleMessageCreate.bind(this));
        } else {
            const botClient = this.client as BotClient;
            botClient.on('ready', this.handleReady.bind(this));
            botClient.on('messageCreate', this.handleMessageCreate.bind(this));
            botClient.on('interactionCreate', this.handleInteraction.bind(this));
        }
    }

    private handleReady() {
        console.log(`Discord ${this.isSelfBot ? 'self-bot' : 'bot'} started successfully as ${this.client.user?.tag}`);
        
        if (!this.isSelfBot) {
            (this.client as BotClient).user?.setPresence({
                activities: [{ name: 'Managing Permissions | !help' }],
                status: 'online'
            });
        }
    }

    private async handleMessageCreate(message: AnyMessage) {
        if (this.isSelfBot) {
            if (message.author.id === this.client.user?.id) return;
        } else {
            if ((message as BotMessage).author.bot) return;
        }

        const messageText = message.content;
        // Only process messages that start with !
        if (!messageText.startsWith('!')) return;

        const senderId = message.author.id;
        const command = messageText.split(' ')[0].substring(1);

        // Check if it's a valid command first
        const isManagementCommand = ['roles', 'grant', 'revoke', 'role', 'perms', 'dashboard', 'users', 'settings'].includes(command);
        const isRegularCommand = ['gpt', 'tldr', 'help'].includes(command);

        if (!isManagementCommand && !isRegularCommand) return;

        // Check base bot permission for any command
        if (!await this.rbacHandler.hasPermission(senderId, 'use_bot')) {
            await message.reply("⛔ You don't have permission to use this bot.");
            return;
        }

        // Handle regular commands first
        switch (command) {
            case 'gpt':
                if (await this.rbacHandler.hasPermission(senderId, 'use_gpt')) {
                    // Handle GPT command
                } else {
                    await message.reply('⛔ You don\'t have permission to use GPT commands. Please contact the bot owner.');
                }
                return;
            case 'tldr':
                if (await this.rbacHandler.hasPermission(senderId, 'use_tldr')) {
                    // Handle TLDR command
                } else {
                    await message.reply('⛔ You don\'t have permission to use TLDR commands. Please contact the bot owner.');
                }
                return;
            case 'help':
                await this.sendHelpMessage(message);
                return;
        }

        // Handle management commands
        if (isManagementCommand) {
            if (senderId !== config.discord.ownerId) {
                await message.reply("⛔ Only the bot owner can use management commands.");
                return;
            }

            const typedMessage = this.isSelfBot ? message as SelfMessage : message as BotMessage;

            switch (command) {
                case 'dashboard':
                    await this.showDashboard(typedMessage);
                    break;
                case 'users':
                    await this.showUserManagement(typedMessage);
                    break;
                case 'roles':
                    await this.showRoleManagement(typedMessage);
                    break;
                case 'settings':
                    await this.showSettings(typedMessage);
                    break;
                case 'grant':
                    await this.rbacHandler.handleGrantCommand(typedMessage);
                    break;
                case 'revoke':
                    await this.rbacHandler.handleRevokeCommand(typedMessage);
                    break;
                case 'role':
                    await this.rbacHandler.handleRoleCommand(typedMessage);
                    break;
                case 'perms':
                    await this.rbacHandler.handlePermsCommand(typedMessage);
                    break;
            }
        }
    }

    private async handleInteraction(interaction: any) {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        if (userId !== config.discord.ownerId) {
            await interaction.reply({ content: '⛔ Only the bot owner can use these controls.', ephemeral: true });
            return;
        }

        switch (interaction.customId) {
            case 'dashboard_users':
                await this.showUserManagement(interaction);
                break;
            case 'dashboard_roles':
                await this.showRoleManagement(interaction);
                break;
            case 'dashboard_settings':
                await this.showSettings(interaction);
                break;
            case 'back_dashboard':
                await this.showDashboard(interaction);
                break;
            case 'add_user':
                await this.handleAddUser(interaction);
                break;
            case 'edit_user':
                await this.handleEditUser(interaction);
                break;
            case 'remove_user':
                await this.handleRemoveUser(interaction);
                break;
            case 'add_role':
                await this.handleAddRole(interaction);
                break;
            case 'edit_role':
                await this.handleEditRole(interaction);
                break;
            case 'delete_role':
                await this.handleDeleteRole(interaction);
                break;
            case 'toggle_features':
                await this.handleToggleFeatures(interaction);
                break;
            case 'view_logs':
                await this.handleViewLogs(interaction);
                break;
        }
    }

    private async handleToggleFeatures(interaction: any) {
        const features = ['gpt', 'tldr'];
        const row = this.createActionRow(
            features.map(feature => ({
                customId: `toggle_${feature}`,
                label: feature.toUpperCase(),
                style: 'PRIMARY',
                emoji: '🔄'
            }))
        );

        await interaction.reply({
            content: '⚙️ Select a feature to toggle:',
            components: [row as any],
            ephemeral: true
        });
    }

    private async handleViewLogs(interaction: any) {
        const logs = await this.permissionsService.getRecentLogs(10);
        const logText = logs.length > 0 
            ? logs.map((log: Log) => `${log.timestamp} - ${log.action} - ${log.details}`).join('\n')
            : 'No logs found.';

        await interaction.reply({
            content: `📋 Recent Activity Logs:\n\`\`\`\n${logText}\n\`\`\``,
            ephemeral: true
        });
    }

    async start() {
        try {
            console.log('Attempting to connect to Discord...');
            const token = this.isSelfBot ? config.discord.token : config.discord.botToken;
            await this.client.login(token);
        } catch (error) {
            console.error('Failed to start Discord client:', error);
            throw error;
        }
    }

    private async sendHelpMessage(message: AnyMessage) {
        const embed = this.isSelfBot ? 
            new SelfEmbed()
                .setTitle('🤖 Permission Management')
                .setColor('#00ff00')
                .addField('General Commands', '`!help` - Show this help message\n`!perms` - Check your permissions')
                .addField('Admin Commands (Owner Only)', 
                    '`!roles` - List all roles\n' +
                    '`!grant @user permission` - Grant permission\n' +
                    '`!revoke @user permission` - Revoke permission\n' +
                    '`!role @user rolename` - Assign role\n' +
                    '`!perms @user` - Check user permissions'
                )
                .setFooter({ text: 'Running in self-bot mode' })
            :
            new BotEmbed()
                .setTitle('🤖 Permission Management')
                .setColor('#00ff00')
                .addField('General Commands', '`!help` - Show this help message\n`!perms` - Check your permissions')
                .addField('Admin Commands (Owner Only)', 
                    '`!roles` - List all roles\n' +
                    '`!grant @user permission` - Grant permission\n' +
                    '`!revoke @user permission` - Revoke permission\n' +
                    '`!role @user rolename` - Assign role\n' +
                    '`!perms @user` - Check user permissions'
                )
                .setFooter({ text: 'Running in bot mode' });

        await message.reply({ embeds: [embed as any] });
    }

    private async handleAddRole(interaction: any) {
        const modal = {
            title: 'Add New Role',
            custom_id: 'add_role_modal',
            components: [{
                type: 1,
                components: [{
                    type: 4,
                    custom_id: 'role_name',
                    label: 'Role Name',
                    style: 1,
                    min_length: 1,
                    max_length: 32,
                    placeholder: 'Enter role name',
                    required: true
                }]
            }]
        };

        await interaction.showModal(modal);
    }

    private async handleEditRole(interaction: any) {
        const roles = await this.permissionsService.getAvailableRoles();
        const options = roles.map(role => ({
            label: role,
            value: role,
            description: `Edit permissions for ${role} role`
        }));

        const row = new SelfActionRow()
            .addComponents(
                new SelfButton()
                    .setCustomId('select_role')
                    .setLabel('Select Role')
                    .setStyle('PRIMARY')
            );

        await interaction.reply({
            content: '✏️ Select a role to edit:',
            components: [row],
            ephemeral: true
        });
    }

    private async handleDeleteRole(interaction: any) {
        const roles = await this.permissionsService.getAvailableRoles();
        const options = roles.map(role => ({
            label: role,
            value: role,
            description: `Delete ${role} role`
        }));

        const row = new SelfActionRow()
            .addComponents(
                new SelfButton()
                    .setCustomId('select_role_delete')
                    .setLabel('Select Role')
                    .setStyle('DANGER')
            );

        await interaction.reply({
            content: '🗑️ Select a role to delete:',
            components: [row],
            ephemeral: true
        });
    }

    private createActionRow(buttons: { customId: string; label: string; style: string; emoji?: string; }[]) {
        if (this.isSelfBot) {
            const row = new SelfActionRow();
            row.addComponents(
                buttons.map(btn => 
                    new SelfButton()
                        .setCustomId(btn.customId)
                        .setLabel(btn.label)
                        .setStyle(btn.style as any)
                        .setEmoji(btn.emoji || '')
                )
            );
            return row;
        } else {
            const row = new BotActionRow();
            row.addComponents(
                buttons.map(btn => 
                    new BotButton()
                        .setCustomId(btn.customId)
                        .setLabel(btn.label)
                        .setStyle(btn.style as any)
                        .setEmoji(btn.emoji || '')
                )
            );
            return row;
        }
    }

    private async showDashboard(message: AnyMessage) {
        const embed = this.isSelfBot ? new SelfEmbed() : new BotEmbed();
        embed.setTitle('🎛️ Bot Management Dashboard')
            .setColor('#00ff00')
            .addField('👥 Users', 'Manage users and their permissions', true)
            .addField('👑 Roles', 'Configure roles and their permissions', true)
            .addField('⚙️ Settings', 'Bot configuration and settings', true)
            .setFooter({ text: `Running in ${this.isSelfBot ? 'self-bot' : 'bot'} mode` });

        const row = this.createActionRow([
            { customId: 'dashboard_users', label: 'Users', style: 'PRIMARY', emoji: '👥' },
            { customId: 'dashboard_roles', label: 'Roles', style: 'PRIMARY', emoji: '👑' },
            { customId: 'dashboard_settings', label: 'Settings', style: 'PRIMARY', emoji: '⚙️' }
        ]);

        await message.reply({ embeds: [embed as any], components: [row as any] });
    }

    private async showUserManagement(message: AnyMessage) {
        const embed = this.isSelfBot ? new SelfEmbed() : new BotEmbed();
        embed.setTitle('👥 User Management')
            .setColor('#00ff00')
            .addField('Current Users', 'Loading user list...')
            .setFooter({ text: 'Use the buttons below to manage users' });

        const row = this.createActionRow([
            { customId: 'add_user', label: 'Add User', style: 'SUCCESS', emoji: '➕' },
            { customId: 'edit_user', label: 'Edit User', style: 'PRIMARY', emoji: '✏️' },
            { customId: 'remove_user', label: 'Remove User', style: 'DANGER', emoji: '🗑️' },
            { customId: 'back_dashboard', label: 'Back', style: 'SECONDARY', emoji: '◀️' }
        ]);

        await message.reply({ embeds: [embed as any], components: [row as any] });
    }

    private async showRoleManagement(message: AnyMessage) {
        const embed = this.isSelfBot ? new SelfEmbed() : new BotEmbed();
        embed.setTitle('👑 Role Management')
            .setColor('#00ff00')
            .addField('Available Roles', 'Loading role list...')
            .setFooter({ text: 'Use the buttons below to manage roles' });

        const row = this.createActionRow([
            { customId: 'add_role', label: 'Add Role', style: 'SUCCESS', emoji: '➕' },
            { customId: 'edit_role', label: 'Edit Role', style: 'PRIMARY', emoji: '✏️' },
            { customId: 'delete_role', label: 'Delete Role', style: 'DANGER', emoji: '🗑️' },
            { customId: 'back_dashboard', label: 'Back', style: 'SECONDARY', emoji: '◀️' }
        ]);

        await message.reply({ embeds: [embed as any], components: [row as any] });
    }

    private async showSettings(message: AnyMessage) {
        const embed = this.isSelfBot ? new SelfEmbed() : new BotEmbed();
        embed.setTitle('⚙️ Bot Settings')
            .setColor('#00ff00')
            .addField('Mode', `Running in ${this.isSelfBot ? 'self-bot' : 'bot'} mode`, true)
            .addField('Owner', `<@${config.discord.ownerId}>`, true)
            .addField('Commands', 'Use !help to see available commands', true)
            .setFooter({ text: 'Use the buttons below to manage settings' });

        const row = this.createActionRow([
            { customId: 'toggle_features', label: 'Toggle Features', style: 'PRIMARY', emoji: '🔧' },
            { customId: 'view_logs', label: 'View Logs', style: 'PRIMARY', emoji: '📋' },
            { customId: 'back_dashboard', label: 'Back', style: 'SECONDARY', emoji: '◀️' }
        ]);

        await message.reply({ embeds: [embed as any], components: [row as any] });
    }

    private async handleAddUser(interaction: any) {
        const modal = {
            title: 'Add New User',
            custom_id: 'add_user_modal',
            components: [{
                type: 1,
                components: [{
                    type: 4,
                    custom_id: 'user_id',
                    label: 'User ID or @mention',
                    style: 1,
                    min_length: 1,
                    placeholder: 'Enter user ID or @mention',
                    required: true
                }]
            }]
        };

        await interaction.showModal(modal);
    }

    private async handleEditUser(interaction: any) {
        const users = await this.permissionsService.getAllUsers();
        if (!users.length) {
            await interaction.reply({ content: '❌ No users found in the database.', ephemeral: true });
            return;
        }

        const row = this.createActionRow(
            users.map(user => ({
                customId: `edit_user_${user.id}`,
                label: user.username || user.id,
                style: 'PRIMARY',
                emoji: '✏️'
            }))
        );

        await interaction.reply({
            content: '👥 Select a user to edit:',
            components: [row as any],
            ephemeral: true
        });
    }

    private async handleRemoveUser(interaction: any) {
        const users = await this.permissionsService.getAllUsers();
        if (!users.length) {
            await interaction.reply({ content: '❌ No users found in the database.', ephemeral: true });
            return;
        }

        const row = this.createActionRow(
            users.map(user => ({
                customId: `remove_user_${user.id}`,
                label: user.username || user.id,
                style: 'DANGER',
                emoji: '🗑️'
            }))
        );

        await interaction.reply({
            content: '🗑️ Select a user to remove:',
            components: [row as any],
            ephemeral: true
        });
    }
}