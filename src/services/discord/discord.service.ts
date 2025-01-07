import { Client } from 'discord.js-selfbot-v13';
import { config } from '../../config/config';
import { DiscordGPTFeature } from './features/discord-gpt.service';
import { DiscordSelfDestructFeature } from './features/discord-self-destruct.service';
import { DiscordTLDRFeature } from './features/discord-tldr.service';
import { DiscordGameFeature } from './features/discord-game.service';
import { OpenAIService } from '../openai.service';

export class DiscordService {
    private client: Client;
    private gptFeature: DiscordGPTFeature;
    private selfDestructFeature: DiscordSelfDestructFeature;
    private tldrFeature: DiscordTLDRFeature;
    private gameFeature: DiscordGameFeature;
    private conversations: Map<string, any> = new Map();

    constructor() {
        this.client = new Client({
            checkUpdate: false,
        });

        const openAIService = new OpenAIService();
        this.gptFeature = new DiscordGPTFeature(this.client, openAIService, this.conversations);
        this.selfDestructFeature = new DiscordSelfDestructFeature(this.client);
        this.tldrFeature = new DiscordTLDRFeature(this.client, openAIService);
        this.gameFeature = new DiscordGameFeature(this.client);
    }

    async start() {
        try {
            console.log('Attempting to connect to Discord...');
            await this.client.login(config.discord.token);
            
            this.client.on('ready', () => {
                console.log(`Discord client started as ${this.client.user?.tag}`);
            });

            this.client.on('messageCreate', async (message) => {
                const messageText = message.content;
                if (!messageText) return;

                // For game commands, allow both bot and other users
                if (messageText.startsWith(config.bot.gamePrefix)) {
                    await this.gameFeature.handle(message);
                    return;
                }

                // For other commands, only respond to bot's own messages
                if (message.author.id !== this.client.user?.id) return;

                if (messageText.startsWith(config.bot.triggerPrefix)) {
                    await this.gptFeature.handle(message);
                } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
                    await this.selfDestructFeature.handle(message);
                } else if (messageText.startsWith(config.bot.tldrPrefix)) {
                    await this.tldrFeature.handle(message);
                }
            });

        } catch (error) {
            console.error('Failed to start Discord client:', error);
            throw error;
        }
    }
} 