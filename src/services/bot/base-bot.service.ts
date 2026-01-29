import { BotRBACService } from '../permissions/bot-rbac.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface IBotMessage {
    content: string;
    senderId: string;
    chatId: string;
    username?: string;
    message_id?: number | string;
    originalMessage?: any; // Stores the raw platform-specific message object for replying
}

export interface IBotResponse {
    content: string;
    silent?: boolean;
}

export abstract class BaseBotService {
    protected permissionsService: PermissionsService;
    protected ownerId: string;

    constructor(ownerId: string) {
        if (!ownerId) {
            throw new Error('Owner ID must be provided');
        }
        this.ownerId = ownerId;
        this.permissionsService = PermissionsService.getInstance();
    }

    protected isOwner(userId: string): boolean {
        // console.log('Checking if owner:', { userId, ownerId: this.ownerId, isMatch: userId === this.ownerId });
        return userId === this.ownerId;
    }

    protected async checkPermission(userId: string, permission: string): Promise<boolean> {
        if (this.isOwner(userId)) {
            return true;
        }
        const hasPerm = await this.permissionsService.hasPermission(userId, permission);
        // console.log(`[Permission Check] User: ${userId}, Permission: ${permission}, Result: ${hasPerm}`);
        return hasPerm;
    }

    protected async handleRBACCommand(command: string, message: IBotMessage): Promise<IBotResponse> {
        // Only owner can use RBAC management commands
        if (!this.isOwner(message.senderId)) {
            return {
                content: "⛔ Only the bot owner can use management commands."
            };
        }

        const args = message.content.split(' ').slice(1);

        switch (command) {
            case 'roles':
                return await this.handleRolesCommand();
            case 'grant':
                if (args.length !== 2) {
                    return { content: '❌ Usage: !grant @username permission' };
                }
                return await this.handleGrantCommand(message.senderId, args[0], args[1]);
            case 'revoke':
                if (args.length !== 2) {
                    return { content: '❌ Usage: !revoke @username permission' };
                }
                return await this.handleRevokeCommand(message.senderId, args[0], args[1]);
            case 'role':
                if (args.length !== 2) {
                    return { content: '❌ Usage: !role @username rolename' };
                }
                return await this.handleRoleCommand(message.senderId, args[0], args[1]);
            case 'perms':
                if (args.length !== 1) {
                    return { content: '❌ Usage: !perms @username' };
                }
                return await this.handlePermsCommand(args[0]);
            default:
                return { content: '❌ Unknown command' };
        }
    }

    protected async handleRolesCommand(): Promise<IBotResponse> {
        const roles = this.permissionsService.getDefaultRoles();
        let response = '👑 Available Roles:\n\n';
        for (const [role, permissions] of Object.entries(roles)) {
            response += `${role}:\n📋 ${permissions.join(', ')}\n\n`;
        }
        return { content: response };
    }

    protected async handleGrantCommand(senderId: string, targetUser: string, permission: string): Promise<IBotResponse> {
        const userId = await this.resolveUserId(targetUser);
        if (!userId) {
            return { content: "❌ Could not find that user." };
        }

        const success = await this.permissionsService.grantPermission(userId, permission);
        return {
            content: success 
                ? `✅ Successfully granted ${permission} to <@${userId}>`
                : "❌ Failed to grant permission."
        };
    }

    protected async handleRevokeCommand(senderId: string, targetUser: string, permission: string): Promise<IBotResponse> {
        const userId = await this.resolveUserId(targetUser);
        if (!userId) {
            return { content: "❌ Could not find that user." };
        }

        const success = await this.permissionsService.revokePermission(userId, permission);
        return {
            content: success 
                ? `✅ Successfully revoked ${permission} from <@${userId}>`
                : "❌ Failed to revoke permission."
        };
    }

    protected async handleRoleCommand(senderId: string, targetUser: string, roleName: string): Promise<IBotResponse> {
        const userId = await this.resolveUserId(targetUser);
        if (!userId) {
            return { content: "❌ Could not find that user." };
        }

        const validRoles = Object.keys(this.permissionsService.getDefaultRoles());
        if (!validRoles.includes(roleName)) {
            return { content: `❌ Invalid role. Valid roles are: ${validRoles.join(', ')}` };
        }

        // Remove existing roles first
        for (const role of validRoles) {
            await this.permissionsService.removeRole(userId, role);
        }

        const success = await this.permissionsService.assignRole(userId, roleName);
        return {
            content: success 
                ? `✅ Successfully assigned role ${roleName} to <@${userId}>`
                : "❌ Failed to assign role."
        };
    }

    protected async handlePermsCommand(targetUser: string): Promise<IBotResponse> {
        const userId = await this.resolveUserId(targetUser);
        if (!userId) {
            return { content: "❌ Could not find that user." };
        }

        const roles = await this.permissionsService.getUserRoles(userId);
        const permissions = await this.permissionsService.getUserPermissions(userId);

        return {
            content: `👤 User Permissions for <@${userId}>:\n` +
                    `Roles: ${roles.join(', ') || 'None'}\n` +
                    `Permissions: ${permissions.join(', ') || 'None'}`
        };
    }

    protected abstract resolveUserId(userIdentifier: string): Promise<string | null>;
    protected abstract sendMessage(chatId: string, response: IBotResponse): Promise<void>;

    // This method should be implemented by platform-specific bot services
    public abstract start(): Promise<void>;
} 