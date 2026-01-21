import { Client as BotClient, Message as BotMessage, MessageEmbed as BotEmbed, MessageActionRow as BotActionRow, MessageButton as BotButton, Intents, ClientOptions as BotOptions, GatewayIntentBits } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage, MessageEmbed as SelfEmbed, MessageActionRow as SelfActionRow, MessageButton as SelfButton, ClientOptions as SelfOptions } from 'discord.js-selfbot-v13';
import { config } from '../../config/config';
import { BaseBotService, IBotMessage, IBotResponse } from '../bot/base-bot.service';
import { OpenAIService } from '../openai.service';
import { DiscordGPTFeature } from './features/discord-gpt.service';
import { DiscordTLDRFeature } from './features/discord-tldr.service';
import { DiscordSelfDestructFeature } from './features/discord-self-destruct.service';
import { DiscordGameFeature } from './features/discord-game.service';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from '@discordjs/builders';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;
type AnyEmbed = BotEmbed | SelfEmbed;

export class DiscordBotService extends BaseBotService {
    private botClient: BotClient | null = null;
    private selfClient: SelfClient | null = null;
    private mode: 'bot' | 'self';
    private gptFeature: DiscordGPTFeature;
    private tldrFeature: DiscordTLDRFeature;
    private selfDestructFeature: DiscordSelfDestructFeature;
    private gameFeature: DiscordGameFeature;
    private conversations: Map<string, any> = new Map();
    private botReadyTime?: Date;
    private selfReadyTime?: Date;

    constructor(config: any, openAIService: OpenAIService) {
        super(config.discord.ownerId);
        this.mode = config.discord.mode;
        console.log('Initializing DiscordBotService with mode:', this.mode, 'ownerId:', this.ownerId);

        // Initialize clients based on mode
        const botIntents = [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.GUILD_MESSAGES,
            Intents.FLAGS.GUILD_MEMBERS,
            Intents.FLAGS.DIRECT_MESSAGES
        ];

        if (this.mode === 'bot') {
            this.botClient = new BotClient({ intents: botIntents });
            this.setupBotHandlers();
        } else {
            this.selfClient = new SelfClient({
                ws: {
                    properties: {
                        browser: "Discord iOS",
                        os: "iOS",
                        device: "iPhone"
                    }
                }
            });
            this.setupSelfBotHandlers();
        }

        // Initialize features with the appropriate client
        const client = this.mode === 'bot' ? this.botClient : this.selfClient;
        if (!client) {
            throw new Error('No Discord client initialized');
        }

        this.gptFeature = new DiscordGPTFeature(client, openAIService, this.conversations);
        this.tldrFeature = new DiscordTLDRFeature(client, openAIService);
        this.selfDestructFeature = new DiscordSelfDestructFeature(client);
        this.gameFeature = new DiscordGameFeature(client);
    }

    private setupBotHandlers() {
        if (!this.botClient) return;
        this.botClient.on('ready', () => this.handleReady());
        this.botClient.on('messageCreate', (message) => this.handleBotMessage(message));
        this.botClient.on('interactionCreate', (interaction) => this.handleInteraction(interaction));
    }

    private setupSelfBotHandlers() {
        if (!this.selfClient) return;
        this.selfClient.on('ready', () => this.handleReady());
        this.selfClient.on('messageCreate', (message) => this.handleSelfBotMessage(message));
    }

    private async handleReady() {
        const client = this.mode === 'bot' ? this.botClient : this.selfClient;
        if (!client?.user) return;
        
        console.log(`Logged in as ${client.user.tag}`);
        
        // Clear message cache on startup
        client.channels.cache.clear();

        // Set up admin dashboard for bot mode
        if (this.mode === 'bot' && this.botClient) {
            await this.setupAdminDashboard();
        }
    }

    private async handleBotMessage(message: BotMessage) {
        if (message.author.bot) return;

        // Convert to common message format
        const botMessage: IBotMessage = {
            content: message.content,
            senderId: message.author.id,
            chatId: message.channelId,
            username: message.author.username
        };

        await this.processMessage(botMessage);
    }

    private async handleSelfBotMessage(message: SelfMessage) {
        // Only process messages from the owner in self-bot mode
        if (message.author.id !== this.ownerId) {
            return;
        }

        // Convert to common message format
        const botMessage: IBotMessage = {
            content: message.content,
            senderId: message.author.id,
            chatId: message.channelId,
            username: message.author.username
        };

        await this.processMessage(botMessage);
    }

    private async processMessage(message: IBotMessage) {
        if (message.content.startsWith('!') || message.content.startsWith('/')) {
            const command = message.content.slice(1).split(' ')[0].toLowerCase();

            // RBAC commands
            if (['roles', 'grant', 'revoke', 'role', 'perms'].includes(command)) {
                const response = await this.handleRBACCommand(command, message);
                await this.sendMessage(message.chatId, response);
                return;
            }

            // Feature commands - owner bypass or permission check
            if (this.isOwner(message.senderId) || await this.checkPermission(message.senderId, 'use_bot')) {
                await this.handleFeatureCommand(command, message);
            } else {
                await this.sendMessage(message.chatId, { content: "⛔ You don't have permission to use this bot" });
            }
        }
    }

    private async handleFeatureCommand(command: string, message: IBotMessage) {
        try {
            switch (command) {
                case 'gpt':
                    await this.gptFeature.handle(message);
                    break;
                case 'tldr':
                    await this.tldrFeature.handle(message);
                    break;
                case 'sd':
                    await this.selfDestructFeature.handle(message);
                    break;
                case 'game':
                    await this.gameFeature.handle(message);
                    break;
                default:
                    await this.sendMessage(message.chatId, { content: '❌ Unknown command' });
            }
        } catch (error) {
            console.error('Error handling feature command:', error);
            await this.sendMessage(message.chatId, { content: '❌ An error occurred while processing your command' });
        }
    }

    protected async resolveUserId(userIdentifier: string): Promise<string | null> {
        try {
            const client = this.mode === 'bot' ? this.botClient : this.selfClient;
            if (!client) return null;

            // Remove any mention formatting
            const cleanIdentifier = userIdentifier.replace(/[<@!>]/g, '');
            const user = await client.users.fetch(cleanIdentifier);
            return user?.id || null;
        } catch (error) {
            console.error('Error resolving user ID:', error);
            return null;
        }
    }

    protected async sendMessage(chatId: string, response: IBotResponse): Promise<void> {
        try {
            const client = this.mode === 'bot' ? this.botClient : this.selfClient;
            if (!client) return;

            const channel = await client.channels.fetch(chatId);
            if (channel && 'send' in channel) {
                await channel.send(response.content);
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    public async start(): Promise<void> {
        const client = this.mode === 'bot' ? this.botClient : this.selfClient;
        if (!client) {
            throw new Error('No Discord client initialized');
        }

        const token = this.mode === 'bot' ? process.env.DISCORD_BOT_TOKEN : process.env.DISCORD_USER_TOKEN;
        if (!token) {
            throw new Error(`${this.mode.toUpperCase()}_TOKEN is not configured`);
        }

        await client.login(token);
        console.log(`Discord ${this.mode} started`);
    }

    public async stop(): Promise<void> {
        const client = this.mode === 'bot' ? this.botClient : this.selfClient;
        if (client) {
            await client.destroy();
        }
    }

    private async setupAdminDashboard() {
        if (!this.botClient) return;

        try {
            const owner = await this.botClient.users.fetch(this.ownerId);
            if (!owner) {
                console.error('Could not find bot owner');
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🎮 Bot Admin Dashboard')
                .setDescription('Welcome to your bot management dashboard. Use the buttons below to manage your bot.')
                .setColor('#0099ff');

            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_users')
                        .setLabel('View Users')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('view_roles')
                        .setLabel('View Roles')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('view_permissions')
                        .setLabel('View Permissions')
                        .setStyle(ButtonStyle.Secondary)
                );

            await owner.send({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('Error setting up admin dashboard:', error);
        }
    }

    private async handleInteraction(interaction: any) {
        if (!interaction.isButton()) return;

        const userId = interaction.user.id;
        if (!this.isOwner(userId)) {
            await interaction.reply({ 
                content: '⛔ Only the bot owner can use these controls.',
                ephemeral: true 
            });
            return;
        }

        try {
            switch (interaction.customId) {
                case 'view_users': {
                    const users = await this.permissionsService.getAllUsers();
                    const userList = users.map(u => `- ${u.id}`).join('\n') || 'No users found';
                    await interaction.reply({
                        content: `📋 Users:\n${userList}`,
                        ephemeral: true
                    });
                    break;
                }
                case 'view_roles': {
                    const roles = this.permissionsService.getDefaultRoles();
                    let content = '👑 Available Roles:\n\n';
                    for (const [role, permissions] of Object.entries(roles)) {
                        content += `${role}:\n📋 ${permissions.join(', ')}\n\n`;
                    }
                    await interaction.reply({ content, ephemeral: true });
                    break;
                }
                case 'view_permissions': {
                    const roles = this.permissionsService.getDefaultRoles();
                    const allPermissions = new Set<string>();
                    Object.values(roles).forEach(perms => perms.forEach(p => allPermissions.add(p)));
                    await interaction.reply({
                        content: `📋 All Available Permissions:\n${Array.from(allPermissions).join('\n')}`,
                        ephemeral: true
                    });
                    break;
                }
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
}