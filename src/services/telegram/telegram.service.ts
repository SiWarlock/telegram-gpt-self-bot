import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { config } from '../../config/config';
import { OpenAIService } from '../openai.service';
import { GPTFeature } from './features/telegram-gpt.service';
import { SelfDestructFeature } from './features/telegram-self-destruct.service';
import { TLDRFeature } from './features/telegram-tldr.service';
import { GameFeature } from './features/telegram-game.service';
import { COMMANDS } from '../../config/constants';
import { PermissionsService } from '../permissions/permissions.service';
import { BotRBACService } from '../permissions/bot-rbac.service';
import { Api } from 'telegram';
import bigInt from 'big-integer';

export class TelegramService {
    private client: TelegramClient;
    private openAIService: OpenAIService;
    private gptFeature: GPTFeature;
    private selfDestructFeature: SelfDestructFeature;
    private tldrFeature: TLDRFeature;
    private gameFeature: GameFeature;
    private permissionsService: PermissionsService;
    private rbacService: BotRBACService;
    private conversations: Map<string, any> = new Map();

    constructor() {
        this.client = new TelegramClient(
            new StringSession(config.telegram.sessionString),
            config.telegram.apiId || 0,
            config.telegram.apiHash || '',
            { connectionRetries: 5 }
        );
        this.openAIService = new OpenAIService();
        this.permissionsService = PermissionsService.getInstance();
        this.rbacService = new BotRBACService(this.permissionsService);
        this.gptFeature = new GPTFeature(this.client, this.openAIService, this.conversations);
        this.selfDestructFeature = new SelfDestructFeature(this.client);
        this.tldrFeature = new TLDRFeature(this.client, this.openAIService);
        this.gameFeature = new GameFeature(this.client);
    }

    private async sendMessage(message: any, text: string) {
        try {
            await message.reply({
                message: text
            });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    async handleMessage(event: any) {
        try {
            const message = event.message;
            const messageText = message.text;
            const senderId = message.senderId?.toString();

            if (!messageText || !senderId) return;

            // Check if the message is a command
            const isCommand = messageText.startsWith(config.bot.triggerPrefix) ||
                            messageText.startsWith(config.bot.selfDestructPrefix) ||
                            messageText.startsWith(config.bot.tldrPrefix) ||
                            messageText.startsWith(COMMANDS.GAME) ||
                            messageText.startsWith('!');

            if (!isCommand) return;

            // Check base bot permission for any command
            if (!await this.rbacService.hasPermission(senderId, 'use_bot')) {
                await this.sendMessage(message, "⛔ You don't have permission to use this bot.");
                return;
            }

            // Only owner can use RBAC management commands (those starting with !)
            if (messageText.match(/^!(roles|grant|revoke|role|perms)\b/)) {
                if (senderId !== config.telegram.ownerId?.toString()) {
                    await this.sendMessage(message, "⛔ Only the bot owner can use management commands.");
                    return;
                }

                if (messageText === '!roles') {
                    const result = await this.rbacService.handleRolesCommand();
                    await this.sendMessage(message, result.message);
                    return;
                } else if (messageText.startsWith('!grant')) {
                    const args = messageText.split(' ').slice(1);
                    if (args.length !== 2) {
                        await this.sendMessage(message, '❌ Usage: !grant @username permission');
                        return;
                    }
                    const result = await this.rbacService.handleGrantCommand(senderId, args[0], args[1]);
                    await this.sendMessage(message, result.message);
                    return;
                } else if (messageText.startsWith('!revoke')) {
                    const args = messageText.split(' ').slice(1);
                    if (args.length !== 2) {
                        await this.sendMessage(message, '❌ Usage: !revoke @username permission');
                        return;
                    }
                    const result = await this.rbacService.handleRevokeCommand(senderId, args[0], args[1]);
                    await this.sendMessage(message, result.message);
                    return;
                } else if (messageText.startsWith('!role ')) {
                    const args = messageText.split(' ').slice(1);
                    if (args.length !== 2) {
                        await this.sendMessage(message, '❌ Usage: !role @username rolename');
                        return;
                    }
                    const result = await this.rbacService.handleRoleCommand(senderId, args[0], args[1]);
                    await this.sendMessage(message, result.message);
                    return;
                } else if (messageText.startsWith('!perms')) {
                    const args = messageText.split(' ').slice(1);
                    if (args.length !== 1) {
                        await this.sendMessage(message, '❌ Usage: !perms @username');
                        return;
                    }
                    const result = await this.rbacService.handlePermsCommand(args[0]);
                    await this.sendMessage(message, result.message);
                    return;
                }
            }

            try {
                if (messageText.startsWith(config.bot.triggerPrefix)) {
                    if (await this.rbacService.hasPermission(senderId, 'use_gpt')) {
                        await this.gptFeature.handle(message);
                    } else {
                        await this.sendMessage(message, '⛔ You don\'t have permission to use GPT commands. Please contact the bot owner.');
                    }
                } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
                    if (await this.rbacService.hasPermission(senderId, 'use_bot')) {
                        await this.selfDestructFeature.handle(message);
                    } else {
                        await this.sendMessage(message, '⛔ You don\'t have permission to use self-destruct messages. Please contact the bot owner.');
                    }
                } else if (messageText.startsWith(config.bot.tldrPrefix)) {
                    if (await this.rbacService.hasPermission(senderId, 'use_tldr')) {
                        await this.tldrFeature.handle(message);
                    } else {
                        await this.sendMessage(message, '⛔ You don\'t have permission to use TLDR commands. Please contact the bot owner.');
                    }
                } else if (messageText.startsWith(COMMANDS.GAME)) {
                    if (await this.rbacService.hasPermission(senderId, 'use_games')) {
                        await this.gameFeature.handle(event);
                    } else {
                        await this.sendMessage(message, '⛔ You don\'t have permission to use game commands. Please contact the bot owner.');
                    }
                }
            } catch (error) {
                console.error('Error handling message:', error);
                try {
                    await this.sendMessage(message, '❌ An error occurred while processing your request.');
                } catch (sendError) {
                    console.error('Error sending error message:', sendError);
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
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
} 