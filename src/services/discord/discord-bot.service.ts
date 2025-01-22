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
        console.log(`Discord ${mode} client started successfully as ${client?.user?.tag}`);
        
        if (mode === 'bot') {
            this.botClient?.user?.setPresence({
                activities: [{ name: 'Managing Permissions | !help' }],
                status: 'online'
            });
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
        const channel = await (this.botClient || this.selfClient)?.channels.fetch(chatId);
        if (channel?.isText()) {
            if (response.silent) {
                // Send to DM if silent
                const user = await (this.botClient || this.selfClient)?.users.fetch(chatId);
                await user?.send(response.content);
            } else {
                await channel.send(response.content);
            }
        }
    }

    private async handleMessageCreate(message: AnyMessage, mode: 'bot' | 'self') {
        // For bot mode, ignore bot messages
        if (mode === 'bot' && (message as BotMessage).author.bot) return;

        const messageText = message.content;
        if (!messageText) return;

        // Convert to common message format
        const botMessage: IBotMessage = {
            content: messageText,
            senderId: message.author.id,
            chatId: message.channelId,
            username: message.author.username
        };

        // Handle RBAC commands
        if (messageText.match(/^!(roles|grant|revoke|role|perms)\b/)) {
            const command = messageText.split(' ')[0].substring(1);
            const response = await this.handleRBACCommand(command, botMessage);
            await this.sendMessage(message.channelId, response);
            return;
        }

        // Check base bot permission
        if (!await this.checkPermission(message.author.id, 'use_bot')) {
            await this.sendMessage(message.channelId, {
                content: "⛔ You don't have permission to use this bot."
            });
            return;
        }

        // Handle feature commands
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

        // Handle dashboard interactions here...
        // This part can be moved to a separate DashboardService if it grows too large
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