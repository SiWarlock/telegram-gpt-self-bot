import { Client as BotClient, Message as BotMessage, MessageEmbed as BotEmbed, MessageActionRow as BotActionRow, MessageButton as BotButton, Intents, ClientOptions as BotOptions } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage, MessageEmbed as SelfEmbed, MessageActionRow as SelfActionRow, MessageButton as SelfButton, ClientOptions as SelfOptions } from 'discord.js-selfbot-v13';
import { config } from '../../config/config';
import { BaseBotService, IBotMessage, IBotResponse } from '../bot/base-bot.service';
import { OpenAIService } from '../openai.service';
import { DiscordGPTFeature } from './features/discord-gpt.service';
import { DiscordTLDRFeature } from './features/discord-tldr.service';
import { DiscordSelfDestructFeature } from './features/discord-self-destruct.service';
import { DiscordGameFeature } from './features/discord-game.service';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;
type AnyEmbed = BotEmbed | SelfEmbed;

export class DiscordBotService extends BaseBotService {
    private botClient?: BotClient;
    private selfClient?: SelfClient;
    private openAIService: OpenAIService;
    private botGPTFeature?: DiscordGPTFeature;
    private selfGPTFeature?: DiscordGPTFeature;
    private botTLDRFeature?: DiscordTLDRFeature;
    private selfTLDRFeature?: DiscordTLDRFeature;
    private botSelfDestructFeature?: DiscordSelfDestructFeature;
    private selfSelfDestructFeature?: DiscordSelfDestructFeature;
    private botGameFeature?: DiscordGameFeature;
    private selfGameFeature?: DiscordGameFeature;
    private conversations: Map<string, any> = new Map();
    private botReadyTime?: Date;
    private selfReadyTime?: Date;

    constructor() {
        super(config.discord.ownerId || '');

        const botToken = config.discord.botToken;
        const userToken = config.discord.token;
        
        // Initialize available clients
        if (botToken) {
            const options: BotOptions = {
                intents: [
                    Intents.FLAGS.GUILDS,
                    Intents.FLAGS.GUILD_MESSAGES,
                    Intents.FLAGS.GUILD_MEMBERS,
                    Intents.FLAGS.DIRECT_MESSAGES
                ]
            };
            this.botClient = new BotClient(options);
        }
        
        if (userToken) {
            const options: SelfOptions = {
                ws: {
                    properties: {
                        browser: "Discord iOS",
                        os: "iOS",
                        device: "iPhone"
                    }
                }
            };
            this.selfClient = new SelfClient(options);
        }

        if (!this.botClient && !this.selfClient) {
            throw new Error('No Discord token provided. Please set either DISCORD_BOT_TOKEN or DISCORD_TOKEN in your environment.');
        }

        this.openAIService = new OpenAIService();
        
        // Initialize features for each client
        if (this.botClient) {
            this.botGPTFeature = new DiscordGPTFeature(this.botClient as any, this.openAIService, this.conversations);
            this.botTLDRFeature = new DiscordTLDRFeature(this.botClient as any, this.openAIService);
            this.botSelfDestructFeature = new DiscordSelfDestructFeature(this.botClient as any);
            this.botGameFeature = new DiscordGameFeature(this.botClient as any);
        }
        if (this.selfClient) {
            this.selfGPTFeature = new DiscordGPTFeature(this.selfClient as any, this.openAIService, this.conversations);
            this.selfTLDRFeature = new DiscordTLDRFeature(this.selfClient as any, this.openAIService);
            this.selfSelfDestructFeature = new DiscordSelfDestructFeature(this.selfClient as any);
            this.selfGameFeature = new DiscordGameFeature(this.selfClient as any);
        }
        
        this.setupEventHandlers();
    }

    private setupEventHandlers() {
        // Set up bot client handlers
        if (this.botClient) {
            this.botClient.on('ready', () => this.handleReady('bot'));
            this.botClient.on('messageCreate', (message: BotMessage) => this.handleMessageCreate(message, 'bot'));
            this.botClient.on('interactionCreate', this.handleInteraction.bind(this));
        }

        // Set up self-bot client handlers
        if (this.selfClient) {
            this.selfClient.on('ready', () => this.handleReady('self'));
            this.selfClient.on('messageCreate', (message: SelfMessage) => this.handleMessageCreate(message, 'self'));
        }
    }

    private handleReady(mode: 'bot' | 'self') {
        const client = mode === 'bot' ? this.botClient : this.selfClient;
        if (mode === 'bot') {
            this.botReadyTime = new Date();
        } else {
            this.selfReadyTime = new Date();
        }
        console.log(`Discord ${mode} client started successfully as ${client?.user?.tag}`);
        
        if (mode === 'bot') {
            this.botClient?.user?.setPresence({
                activities: [{ name: 'Managing Permissions | !help' }],
                status: 'online'
            });
        }
    }

    private async setupAdminDashboard(channelId: string) {
        if (!this.botClient) return;

        try {
            const channel = await this.botClient.channels.fetch(channelId);
            if (!channel?.isText()) return;

            const embed = new BotEmbed()
                .setTitle('🎮 Bot Management Dashboard')
                .setDescription('Manage users and their permissions')
                .addFields(
                    { name: '👥 Users', value: 'Manage users and their permissions', inline: true },
                    { name: '👑 Roles', value: 'Configure roles and their permissions', inline: true },
                    { name: '⚙️ Settings', value: 'Bot configuration and settings', inline: true }
                )
                .setColor('#0099ff')
                .setFooter({ text: 'Running in bot mode' });

            const row = new BotActionRow()
                .addComponents(
                    new BotButton()
                        .setCustomId('view_users')
                        .setLabel('Users')
                        .setStyle('PRIMARY')
                        .setEmoji('👥'),
                    new BotButton()
                        .setCustomId('view_roles')
                        .setLabel('Roles')
                        .setStyle('PRIMARY')
                        .setEmoji('👑'),
                    new BotButton()
                        .setCustomId('view_permissions')
                        .setLabel('Settings')
                        .setStyle('PRIMARY')
                        .setEmoji('⚙️')
                );

            await channel.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Failed to set up admin dashboard:', error);
        }
    }

    protected async resolveUserId(userIdentifier: string): Promise<string | null> {
        const mention = userIdentifier.replace(/[<@!>]/g, '');
        try {
            const user = await (this.botClient || this.selfClient)?.users.fetch(mention);
            return user?.id || null;
        } catch {
            return null;
        }
    }

    protected async sendMessage(chatId: string, response: IBotResponse): Promise<void> {
        try {
            const client = this.botClient || this.selfClient;
            if (!client) return;

            // If silent, try to send DM
            if (response.silent) {
                try {
                    const user = await client.users.fetch(chatId);
                    await user.send(response.content);
                    return;
                } catch (error) {
                    console.error('Failed to send DM:', error);
                    // If DM fails, try to send in channel if available
                }
            }

            // Try to send in channel
            try {
                const channel = await client.channels.fetch(chatId);
                if (!channel?.isText()) return;

                // Check if bot has permission to send messages in this channel
                const permissions = (channel as any).permissionsFor?.(client.user);
                if (!permissions?.has('SEND_MESSAGES')) return;

                await channel.send(response.content);
            } catch (error) {
                // Silently fail if we can't send the message
                return;
            }
        } catch (error) {
            // Silently fail if we can't send the message
            return;
        }
    }

    private async handleMessageCreate(message: AnyMessage, mode: 'bot' | 'self') {
        // For bot mode, ignore bot messages
        if (mode === 'bot' && (message as BotMessage).author.bot) return;

        // If this is a self-bot message and the bot client exists and is in the channel, ignore it
        if (mode === 'self' && this.botClient) {
            const channel = await this.botClient.channels.fetch(message.channelId).catch(() => null);
            if (channel) return; // Bot is in this channel, let the bot handle it
        }

        const messageText = message.content;
        if (!messageText) return;

        // Convert to common message format
        const botMessage: IBotMessage = {
            content: messageText,
            senderId: message.author.id,
            chatId: message.channelId,
            username: message.author.username
        };

        // Handle dashboard command for owner
        if (messageText === '!dashboard' && message.author.id === this.ownerId) {
            await this.setupAdminDashboard(message.channelId);
            return;
        }

        // Handle RBAC commands for owner
        if (messageText.match(/^!(roles|grant|revoke|role|perms)\b/)) {
            if (message.author.id === this.ownerId) {
                const command = messageText.split(' ')[0].substring(1);
                const response = await this.handleRBACCommand(command, botMessage);
                await this.sendMessage(message.channelId, { content: response.content });
                return;
            } else if (!await this.checkPermission(message.author.id, 'manage_roles')) {
                await this.sendMessage(message.channelId, {
                    content: "⛔ You don't have permission to manage roles."
                });
                return;
            }
            const command = messageText.split(' ')[0].substring(1);
            const response = await this.handleRBACCommand(command, botMessage);
            await this.sendMessage(message.channelId, { content: response.content });
            return;
        }

        // Owner always has permission for other commands
        if (message.author.id === this.ownerId) {
            try {
                if (messageText.startsWith(config.bot.triggerPrefix)) {
                    const feature = mode === 'bot' ? this.botGPTFeature : this.selfGPTFeature;
                    await feature?.handle(message as any);
                } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
                    const feature = mode === 'bot' ? this.botSelfDestructFeature : this.selfSelfDestructFeature;
                    await feature?.handle(message as any);
                } else if (messageText.startsWith(config.bot.tldrPrefix)) {
                    const feature = mode === 'bot' ? this.botTLDRFeature : this.selfTLDRFeature;
                    await feature?.handle(message as any);
                } else if (messageText.startsWith('!game')) {
                    const feature = mode === 'bot' ? this.botGameFeature : this.selfGameFeature;
                    await feature?.handle(message as any);
                }
            } catch (error) {
                console.error('Error handling message:', error);
                await this.sendMessage(message.channelId, {
                    content: '❌ An error occurred while processing your request.'
                });
            }
            return;
        }

        // Check base bot permission for non-owners
        if (!await this.checkPermission(message.author.id, 'use_bot')) {
            await this.sendMessage(message.channelId, {
                content: "⛔ You don't have permission to use this bot."
            });
            return;
        }

        // Handle feature commands for non-owners
        try {
            if (messageText.startsWith(config.bot.triggerPrefix)) {
                if (await this.checkPermission(message.author.id, 'use_gpt')) {
                    const feature = mode === 'bot' ? this.botGPTFeature : this.selfGPTFeature;
                    await feature?.handle(message as any);
                }
            } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
                if (await this.checkPermission(message.author.id, 'use_bot')) {
                    const feature = mode === 'bot' ? this.botSelfDestructFeature : this.selfSelfDestructFeature;
                    await feature?.handle(message as any);
                }
            } else if (messageText.startsWith(config.bot.tldrPrefix)) {
                if (await this.checkPermission(message.author.id, 'use_tldr')) {
                    const feature = mode === 'bot' ? this.botTLDRFeature : this.selfTLDRFeature;
                    await feature?.handle(message as any);
                }
            } else if (messageText.startsWith('!game')) {
                if (await this.checkPermission(message.author.id, 'use_games')) {
                    const feature = mode === 'bot' ? this.botGameFeature : this.selfGameFeature;
                    await feature?.handle(message as any);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
            await this.sendMessage(message.channelId, {
                content: '❌ An error occurred while processing your request.'
            });
        }
    }

    private async handleInteraction(interaction: any) {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        if (userId !== this.ownerId) {
            await interaction.reply({ 
                content: '⛔ Only the bot owner can use these controls.',
                ephemeral: true 
            });
            return;
        }

        try {
            switch (interaction.customId) {
                case 'view_users':
                    const users = await this.permissionsService.getAllUsers();
                    const userList = users.map(u => `- ${u.id}`).join('\n') || 'No users found';
                    await interaction.reply({
                        content: `📋 Users:\n${userList}`,
                        ephemeral: true
                    });
                    break;
                case 'view_roles':
                    const roles = await this.permissionsService.getAvailableRoles();
                    const roleList = roles.join('\n') || 'No roles found';
                    await interaction.reply({
                        content: `👑 Roles:\n${roleList}`,
                        ephemeral: true
                    });
                    break;
                case 'view_permissions':
                    const perms = Object.values(this.permissionsService.getDefaultRoles()).flat();
                    const uniquePerms = [...new Set(perms)];
                    const permList = uniquePerms.join('\n') || 'No permissions found';
                    await interaction.reply({
                        content: `🔑 Permissions:\n${permList}`,
                        ephemeral: true
                    });
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Unknown button interaction',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            await interaction.reply({
                content: '❌ An error occurred while processing your request',
                ephemeral: true
            });
        }
    }

    protected async handleRBACCommand(command: string, message: IBotMessage): Promise<IBotResponse> {
        const args = message.content.split(' ').slice(1);
        const isOwner = message.senderId === this.ownerId;

        switch (command) {
            case 'roles':
                const roles = this.permissionsService.getDefaultRoles();
                let response = '👑 Available Roles:\n\n';
                for (const [role, permissions] of Object.entries(roles)) {
                    response += `${role}:\n📋 ${permissions.join(', ')}\n\n`;
                }
                return { content: response };

            case 'role':
                if (!isOwner) {
                    return { content: "⛔ Only the owner can assign roles." };
                }
                if (args.length < 2) {
                    return { content: "❌ Usage: !role @user <role>" };
                }
                const targetUser = args[0].replace(/[<@!>]/g, '');
                const roleName = args[1].toLowerCase();
                const validRoles = Object.keys(this.permissionsService.getDefaultRoles());
                
                if (!validRoles.includes(roleName)) {
                    return { content: `❌ Invalid role. Valid roles are: ${validRoles.join(', ')}` };
                }

                try {
                    const userId = await this.resolveUserId(targetUser);
                    if (!userId) {
                        return { content: "❌ Could not find that user." };
                    }

                    // Remove existing roles first
                    for (const role of validRoles) {
                        await this.permissionsService.removeRole(userId, role);
                    }

                    // Assign new role
                    const success = await this.permissionsService.assignRole(userId, roleName);
                    return {
                        content: success 
                            ? `✅ Successfully assigned role ${roleName} to <@${userId}>`
                            : "❌ Failed to assign role."
                    };
                } catch (error) {
                    console.error('Error assigning role:', error);
                    return { content: "❌ An error occurred while assigning the role." };
                }

            case 'perms':
                if (args.length === 0) {
                    // Show all permissions
                    const allPerms = new Set<string>();
                    Object.values(this.permissionsService.getDefaultRoles()).forEach(perms => 
                        perms.forEach(p => allPerms.add(p))
                    );
                    return { content: `🔑 Available Permissions:\n${Array.from(allPerms).join('\n')}` };
                } else {
                    // Show user permissions
                    const userId = await this.resolveUserId(args[0]);
                    if (!userId) {
                        return { content: "❌ Could not find that user." };
                    }
                    const userRoles = await this.permissionsService.getUserRoles(userId);
                    const userPerms = await this.permissionsService.getUserPermissions(userId);
                    return {
                        content: `👤 User Permissions for <@${userId}>:\n` +
                                `Roles: ${userRoles.join(', ') || 'None'}\n` +
                                `Permissions: ${userPerms.join(', ') || 'None'}`
                    };
                }

            default:
                return { content: "❌ Unknown RBAC command." };
        }
    }

    public async start(): Promise<void> {
        try {
            console.log('Attempting to connect to Discord...');
            
            // Start bot client if available
            if (this.botClient) {
                await this.botClient.login(config.discord.botToken);
                console.log('Bot client connected successfully');
            }
            
            // Start self-bot client if available
            if (this.selfClient) {
                await this.selfClient.login(config.discord.token);
                console.log('Self-bot client connected successfully');
            }
        } catch (error) {
            console.error('Failed to start Discord client:', error);
            throw error;
        }
    }
}