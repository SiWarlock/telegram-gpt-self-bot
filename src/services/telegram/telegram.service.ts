import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { config } from '../../config/config';
import { OpenAIService } from '../openai.service';
import { GPTFeature } from './features/telegram-gpt.service';
import { SelfDestructFeature } from './features/telegram-self-destruct.service';
import { TLDRFeature } from './features/telegram-tldr.service';
import { TelegramGameFeature } from './features/telegram-game.service';
import { COMMANDS } from '../../config/constants';
import { PermissionsService } from '../permissions/permissions.service';

export class TelegramService {
    private client: TelegramClient;
    private openAIService: OpenAIService;
    private gptFeature: GPTFeature;
    private selfDestructFeature: SelfDestructFeature;
    private tldrFeature: TLDRFeature;
    private gameFeature: TelegramGameFeature;
    private permissionsService: PermissionsService;
    private conversations: Map<string, any> = new Map();

    constructor() {
        this.client = new TelegramClient(
            new StringSession(config.telegram.sessionString),
            config.telegram.apiId,
            config.telegram.apiHash,
            { connectionRetries: 5 }
        );
        this.openAIService = new OpenAIService();
        this.permissionsService = new PermissionsService();
        this.gptFeature = new GPTFeature(this.client, this.openAIService, this.conversations);
        this.selfDestructFeature = new SelfDestructFeature(this.client);
        this.tldrFeature = new TLDRFeature(this.client, this.openAIService);
        this.gameFeature = new TelegramGameFeature(this.client);
    }

    private async hasPermission(userId: string, permission: string): Promise<boolean> {
        // Owner always has all permissions
        if (userId === config.telegram.ownerId) {
            return true;
        }
        return this.permissionsService.hasPermission(userId, permission);
    }

    private async handleMessage(event: any) {
        const message = event.message;
        const messageText = message.text;
        const senderId = message.senderId?.toString();
        const chatId = message.chatId?.toString();

        if (!messageText || !senderId || !chatId) return;

        // Only owner can use management commands
        if (senderId === config.telegram.ownerId) {
            if (messageText.startsWith('!grant')) {
                await this.handleGrantCommand(message);
                return;
            } else if (messageText.startsWith('!revoke')) {
                await this.handleRevokeCommand(message);
                return;
            } else if (messageText.startsWith('!role')) {
                await this.handleRoleCommand(message);
                return;
            } else if (messageText.startsWith('!perms')) {
                await this.handlePermsCommand(message);
                return;
            } else if (messageText === '!roles') {
                await this.handleRolesCommand(message);
                return;
            }
        }

        try {
            if (messageText.startsWith(config.bot.triggerPrefix)) {
                if (await this.hasPermission(senderId, 'use_gpt')) {
                    await this.gptFeature.handle(message);
                } else {
                    await this.client.sendMessage(chatId, {
                        message: '⛔ You don\'t have permission to use GPT commands. Please contact the bot owner.',
                        replyTo: message.id
                    });
                }
            } else if (messageText.startsWith(config.bot.selfDestructPrefix)) {
                if (await this.hasPermission(senderId, 'use_bot')) {
                    await this.selfDestructFeature.handle(message);
                } else {
                    await this.client.sendMessage(chatId, {
                        message: '⛔ You don\'t have permission to use self-destruct messages. Please contact the bot owner.',
                        replyTo: message.id
                    });
                }
            } else if (messageText.startsWith(config.bot.tldrPrefix)) {
                if (await this.hasPermission(senderId, 'use_tldr')) {
                    await this.tldrFeature.handle(message);
                } else {
                    await this.client.sendMessage(chatId, {
                        message: '⛔ You don\'t have permission to use TLDR commands. Please contact the bot owner.',
                        replyTo: message.id
                    });
                }
            } else if (messageText.startsWith(COMMANDS.GAME)) {
                if (await this.hasPermission(senderId, 'use_games')) {
                    await this.gameFeature.handle(event);
                } else {
                    await this.client.sendMessage(chatId, {
                        message: '⛔ You don\'t have permission to use game commands. Please contact the bot owner.',
                        replyTo: message.id
                    });
                }
            }
        } catch (error) {
            console.error('Error handling message:', error);
            try {
                await this.client.sendMessage(chatId, {
                    message: '❌ An error occurred while processing your request.',
                    replyTo: message.id
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }

    private async handleGrantCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.client.sendMessage(message.chatId, {
                message: '❌ Usage: !grant @username permission',
                replyTo: message.id
            });
            return;
        }

        const [username, permission] = args;
        const cleanUsername = username.replace('@', '');

        try {
            // Get user info from username
            const users = await this.client.getParticipants(message.chatId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.client.sendMessage(message.chatId, {
                    message: '❌ User not found in this chat',
                    replyTo: message.id
                });
                return;
            }

            const granted = await this.permissionsService.grantPermission(targetUser.id.toString(), permission);
            if (granted) {
                await this.client.sendMessage(message.chatId, {
                    message: `✅ Granted "${permission}" permission to @${cleanUsername}`,
                    replyTo: message.id
                });
            } else {
                await this.client.sendMessage(message.chatId, {
                    message: `ℹ️ @${cleanUsername} already has "${permission}" permission`,
                    replyTo: message.id
                });
            }
        } catch (error) {
            console.error('Error granting permission:', error);
            await this.client.sendMessage(message.chatId, {
                message: '❌ Failed to grant permission',
                replyTo: message.id
            });
        }
    }

    private async handleRevokeCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.client.sendMessage(message.chatId, {
                message: '❌ Usage: !revoke @username permission',
                replyTo: message.id
            });
            return;
        }

        const [username, permission] = args;
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.chatId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.client.sendMessage(message.chatId, {
                    message: '❌ User not found in this chat',
                    replyTo: message.id
                });
                return;
            }

            const revoked = await this.permissionsService.revokePermission(targetUser.id.toString(), permission);
            if (revoked) {
                await this.client.sendMessage(message.chatId, {
                    message: `✅ Revoked "${permission}" permission from @${cleanUsername}`,
                    replyTo: message.id
                });
            } else {
                await this.client.sendMessage(message.chatId, {
                    message: `ℹ️ @${cleanUsername} doesn't have "${permission}" permission`,
                    replyTo: message.id
                });
            }
        } catch (error) {
            console.error('Error revoking permission:', error);
            await this.client.sendMessage(message.chatId, {
                message: '❌ Failed to revoke permission',
                replyTo: message.id
            });
        }
    }

    private async handleRoleCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.client.sendMessage(message.chatId, {
                message: '❌ Usage: !role @username rolename',
                replyTo: message.id
            });
            return;
        }

        const [username, role] = args;
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.chatId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.client.sendMessage(message.chatId, {
                    message: '❌ User not found in this chat',
                    replyTo: message.id
                });
                return;
            }

            const assigned = await this.permissionsService.assignRole(targetUser.id.toString(), role);
            if (assigned) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                await this.client.sendMessage(message.chatId, {
                    message: `✅ Assigned role "${role}" to @${cleanUsername}\n📋 Permissions: ${permissions.join(', ')}`,
                    replyTo: message.id
                });
            } else {
                await this.client.sendMessage(message.chatId, {
                    message: `❌ Invalid role "${role}" or user already has this role`,
                    replyTo: message.id
                });
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            await this.client.sendMessage(message.chatId, {
                message: '❌ Failed to assign role',
                replyTo: message.id
            });
        }
    }

    private async handlePermsCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 1) {
            await this.client.sendMessage(message.chatId, {
                message: '❌ Usage: !perms @username',
                replyTo: message.id
            });
            return;
        }

        const username = args[0];
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.chatId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.client.sendMessage(message.chatId, {
                    message: '❌ User not found in this chat',
                    replyTo: message.id
                });
                return;
            }

            const userId = targetUser.id.toString();
            const roles = await this.permissionsService.getUserRoles(userId);
            const permissions = await this.permissionsService.getUserPermissions(userId);

            let message_text = `👤 **Permissions for @${cleanUsername}**\n\n`;
            message_text += `🎭 Roles: ${roles.join(', ') || 'None'}\n\n`;
            message_text += `📋 Permissions: ${permissions.join(', ') || 'None'}`;

            await this.client.sendMessage(message.chatId, {
                message: message_text,
                replyTo: message.id,
                parseMode: 'markdown'
            });
        } catch (error) {
            console.error('Error getting permissions:', error);
            await this.client.sendMessage(message.chatId, {
                message: '❌ Failed to get permissions',
                replyTo: message.id
            });
        }
    }

    private async handleRolesCommand(message: any) {
        try {
            const availableRoles = await this.permissionsService.getAvailableRoles();
            let message_text = '🎭 **Available Roles**\n\n';
            
            for (const role of availableRoles) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                message_text += `• ${role}:\n  ${permissions.join(', ')}\n\n`;
            }

            await this.client.sendMessage(message.chatId, {
                message: message_text,
                replyTo: message.id,
                parseMode: 'markdown'
            });
        } catch (error) {
            console.error('Error listing roles:', error);
            await this.client.sendMessage(message.chatId, {
                message: '❌ Failed to list roles',
                replyTo: message.id
            });
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