import { Client } from 'discord.js-selfbot-v13';
import { config } from '../../config/config';
import { DiscordGPTFeature } from './features/discord-gpt.service';
import { OpenAIService } from '../openai.service';

export class DiscordService {
    private client: Client;
    private gptFeature: DiscordGPTFeature;
    private conversations: Map<string, any> = new Map();

    constructor() {
        this.client = new Client({
            checkUpdate: false,
        });

        const openAIService = new OpenAIService();
        this.gptFeature = new DiscordGPTFeature(this.client, openAIService, this.conversations);
    }

    async start() {
        try {
            console.log('Attempting to connect to Discord...');
            await this.client.login(config.discord.token);
            
            this.client.on('ready', () => {
                console.log(`Discord client started as ${this.client.user?.tag}`);
            });

            this.client.on('messageCreate', async (message) => {
                if (message.author.id !== this.client.user?.id) return;

                const messageText = message.content;
                if (!messageText) return;

                if (messageText.startsWith(config.bot.triggerPrefix)) {
                    await this.gptFeature.handle(message);
                }
                // Add other features here later
            });

        } catch (error) {
            console.error('Failed to start Discord client:', error);
            throw error;
        }
    }
} 