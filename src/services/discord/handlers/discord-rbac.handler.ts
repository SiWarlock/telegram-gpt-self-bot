import { Client as BotClient, Message as BotMessage } from 'discord.js';
import { Client as SelfClient, Message as SelfMessage } from 'discord.js-selfbot-v13';
import { PermissionsService } from '../../permissions/permissions.service';

type AnyClient = BotClient | SelfClient;
type AnyMessage = BotMessage | SelfMessage;

export class DiscordRBACHandler {
    constructor(
        private client: AnyClient,
        private permissionsService: PermissionsService
    ) {}

    async hasPermission(userId: string, permission: string): Promise<boolean> {
        return this.permissionsService.hasPermission(userId, permission);
    }

    private async sendMessage(message: AnyMessage, content: string) {
        try {
            await message.reply({ content });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }

    async handleGrantCommand(message: AnyMessage) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !grant @username permission');
            return;
        }

        const [mention, permission] = args;
        const userId = mention.replace(/[<@!>]/g, '');

        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                await this.sendMessage(message, '❌ User not found');
                return;
            }

            const granted = await this.permissionsService.grantPermission(user.id, permission);
            if (granted) {
                await this.sendMessage(message, `✅ Granted "${permission}" permission to ${user.tag}`);
            } else {
                await this.sendMessage(message, `ℹ️ ${user.tag} already has "${permission}" permission`);
            }
        } catch (error) {
            console.error('Error granting permission:', error);
            await this.sendMessage(message, '❌ Failed to grant permission');
        }
    }

    async handleRevokeCommand(message: AnyMessage) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !revoke @username permission');
            return;
        }

        const [mention, permission] = args;
        const userId = mention.replace(/[<@!>]/g, '');

        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                await this.sendMessage(message, '❌ User not found');
                return;
            }

            const revoked = await this.permissionsService.revokePermission(user.id, permission);
            if (revoked) {
                await this.sendMessage(message, `✅ Revoked "${permission}" permission from ${user.tag}`);
            } else {
                await this.sendMessage(message, `ℹ️ ${user.tag} doesn't have "${permission}" permission`);
            }
        } catch (error) {
            console.error('Error revoking permission:', error);
            await this.sendMessage(message, '❌ Failed to revoke permission');
        }
    }

    async handleRoleCommand(message: AnyMessage) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !role @username rolename');
            return;
        }

        const [mention, role] = args;
        const userId = mention.replace(/[<@!>]/g, '');

        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                await this.sendMessage(message, '❌ User not found');
                return;
            }

            const assigned = await this.permissionsService.assignRole(user.id, role);
            if (assigned) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                await this.sendMessage(message, 
                    `✅ Assigned role "${role}" to ${user.tag}\n` +
                    `📋 Permissions: ${permissions.join(', ')}`
                );
            } else {
                await this.sendMessage(message, `❌ Invalid role "${role}" or user already has this role`);
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            await this.sendMessage(message, '❌ Failed to assign role');
        }
    }

    async handlePermsCommand(message: AnyMessage) {
        const args = message.content.split(' ').slice(1);
        if (args.length !== 1) {
            await this.sendMessage(message, '❌ Usage: !perms @username');
            return;
        }

        const mention = args[0];
        const userId = mention.replace(/[<@!>]/g, '');

        try {
            const user = await this.client.users.fetch(userId);
            if (!user) {
                await this.sendMessage(message, '❌ User not found');
                return;
            }

            const permissions = await this.permissionsService.getUserPermissions(user.id);
            const roles = await this.permissionsService.getUserRoles(user.id);

            await this.sendMessage(message,
                `👤 Permissions for ${user.tag}:\n` +
                `👑 Roles: ${roles.join(', ') || 'None'}\n` +
                `📋 Permissions: ${permissions.join(', ') || 'None'}`
            );
        } catch (error) {
            console.error('Error getting permissions:', error);
            await this.sendMessage(message, '❌ Failed to get permissions');
        }
    }

    async handleRolesCommand(message: AnyMessage) {
        try {
            const roles = await this.permissionsService.getAvailableRoles();
            let response = '👑 Available Roles:\n\n';

            for (const role of roles) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                response += `${role}:\n📋 ${permissions.join(', ') || 'No permissions'}\n\n`;
            }

            await this.sendMessage(message, response);
        } catch (error) {
            console.error('Error listing roles:', error);
            await this.sendMessage(message, '❌ Failed to list roles');
        }
    }
} 