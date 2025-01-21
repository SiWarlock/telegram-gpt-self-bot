import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { config } from '../../../config/config';
import { PermissionsService } from '../../permissions/permissions.service';
import bigInt from 'big-integer';

export class TelegramRBACHandler {
    constructor(
        private client: TelegramClient,
        private permissionsService: PermissionsService
    ) {}

    async hasPermission(userId: string, permission: string): Promise<boolean> {
        // Owner always has all permissions
        if (userId.toString() === config.telegram.ownerId?.toString()) {
            return true;
        }
        return this.permissionsService.hasPermission(userId, permission);
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

    async handleGrantCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !grant @username permission');
            return;
        }

        const [username, permission] = args;
        const cleanUsername = username.replace('@', '');

        try {
            // Get user info from username
            const users = await this.client.getParticipants(message.peerId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.sendMessage(message, '❌ User not found in this chat');
                return;
            }

            const granted = await this.permissionsService.grantPermission(targetUser.id.toString(), permission);
            if (granted) {
                await this.sendMessage(message, `✅ Granted "${permission}" permission to @${cleanUsername}`);
            } else {
                await this.sendMessage(message, `ℹ️ @${cleanUsername} already has "${permission}" permission`);
            }
        } catch (error) {
            console.error('Error granting permission:', error);
            await this.sendMessage(message, '❌ Failed to grant permission');
        }
    }

    async handleRevokeCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !revoke @username permission');
            return;
        }

        const [username, permission] = args;
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.peerId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.sendMessage(message, '❌ User not found in this chat');
                return;
            }

            const revoked = await this.permissionsService.revokePermission(targetUser.id.toString(), permission);
            if (revoked) {
                await this.sendMessage(message, `✅ Revoked "${permission}" permission from @${cleanUsername}`);
            } else {
                await this.sendMessage(message, `ℹ️ @${cleanUsername} doesn't have "${permission}" permission`);
            }
        } catch (error) {
            console.error('Error revoking permission:', error);
            await this.sendMessage(message, '❌ Failed to revoke permission');
        }
    }

    async handleRoleCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 2) {
            await this.sendMessage(message, '❌ Usage: !role @username rolename');
            return;
        }

        const [username, role] = args;
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.peerId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.sendMessage(message, '❌ User not found in this chat');
                return;
            }

            const assigned = await this.permissionsService.assignRole(targetUser.id.toString(), role);
            if (assigned) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                await this.sendMessage(message, `✅ Assigned role "${role}" to @${cleanUsername}\n📋 Permissions: ${permissions.join(', ')}`);
            } else {
                await this.sendMessage(message, `❌ Invalid role "${role}" or user already has this role`);
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            await this.sendMessage(message, '❌ Failed to assign role');
        }
    }

    async handlePermsCommand(message: any) {
        const args = message.text.split(' ').slice(1);
        if (args.length !== 1) {
            await this.sendMessage(message, '❌ Usage: !perms @username');
            return;
        }

        const username = args[0];
        const cleanUsername = username.replace('@', '');

        try {
            const users = await this.client.getParticipants(message.peerId, {
                search: cleanUsername
            });
            const targetUser = users.find((u: any) => u.username === cleanUsername);

            if (!targetUser) {
                await this.sendMessage(message, '❌ User not found in this chat');
                return;
            }

            const permissions = await this.permissionsService.getUserPermissions(targetUser.id.toString());
            const roles = await this.permissionsService.getUserRoles(targetUser.id.toString());

            let message_text = `👤 Permissions for @${cleanUsername}:\n\n`;
            message_text += `👑 Roles: ${roles.join(', ') || 'None'}\n`;
            message_text += `📋 Permissions: ${permissions.join(', ') || 'None'}`;

            await this.sendMessage(message, message_text);
        } catch (error) {
            console.error('Error getting permissions:', error);
            await this.sendMessage(message, '❌ Failed to get permissions');
        }
    }

    async handleRolesCommand(message: any) {
        try {
            const roles = await this.permissionsService.getAvailableRoles();
            let message_text = '👑 Available Roles:\n\n';

            for (const role of roles) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                message_text += `📍 ${role}\n`;
                message_text += `📋 Permissions: ${permissions.join(', ')}\n\n`;
            }

            await this.sendMessage(message, message_text);
        } catch (error) {
            console.error('Error listing roles:', error);
            await this.sendMessage(message, '❌ Failed to list roles');
        }
    }
} 