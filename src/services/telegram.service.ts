import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { config } from '../config/config';
import { OpenAIService } from './openai.service';
import { GPTFeature } from './features/gpt.service';
import { SelfDestructFeature } from './features/self-destruct.service';
import { TLDRFeature } from './features/tldr.service';

export class TelegramService {
    private client: TelegramClient;
    private openAIService: OpenAIService;
    private gptFeature: GPTFeature;
    private selfDestructFeature: SelfDestructFeature;
    private tldrFeature: TLDRFeature;
    private conversations: Map<string, any> = new Map();

    constructor() {
        this.client = new TelegramClient(
            new StringSession(config.telegram.sessionString),
            config.telegram.apiId,
            config.telegram.apiHash,
            { connectionRetries: 5 }
        );
        this.openAIService = new OpenAIService();
        this.gptFeature = new GPTFeature(this.client, this.openAIService, this.conversations);
        this.selfDestructFeature = new SelfDestructFeature(this.client);
        this.tldrFeature = new TLDRFeature(this.client, this.openAIService);
    }

    private async handleMessage(event: any) {
        const message = event.message;
        const messageText = message.text;

        if (!messageText) return;

        if (messageText.startsWith(config.bot.triggerPrefix)) {
            await this.gptFeature.handle(message);
        } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
            await this.selfDestructFeature.handle(message);
        } else if (messageText.startsWith(config.bot.tldrPrefix)) {
            await this.tldrFeature.handle(message);
        }
    }

    async start() {
        try {
            console.log('Attempting to connect to Telegram...');
            await this.client.connect();
            
            console.log('Connected, checking authorization...');
            const authorized = await this.client.isUserAuthorized();
            console.log('Authorization status:', authorized);

            if (!authorized) {
                console.error('Session is not authorized. Please generate a new session string locally first.');
                throw new Error('Session is invalid or expired');
            }
            
            console.log('Telegram client started successfully');
            this.client.addEventHandler(this.handleMessage.bind(this), new NewMessage({}));
            console.log('Event handler added');
        } catch (error) {
            console.error('Failed to start Telegram client:', error);
            throw error;
        }
    }

    // ... rest of the base service code
} 