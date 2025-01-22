import { BotRBACService } from '../permissions/bot-rbac.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface IBotMessage {
    content: string;
    senderId: string;
    chatId: string;
    username?: string;
}

export interface IBotResponse {
    content: string;
    silent?: boolean;
}

export abstract class BaseBotService {
    protected rbacService: BotRBACService;
    protected permissionsService: PermissionsService;
    protected ownerId: string;

    constructor(ownerId: string) {
        this.ownerId = ownerId;
        this.permissionsService = new PermissionsService();
        this.rbacService = new BotRBACService(this.permissionsService);
    }

    protected async checkPermission(userId: string, permission: string): Promise<boolean> {
        return this.rbacService.hasPermission(userId, permission, this.ownerId);
    }

    protected async handleRBACCommand(command: string, message: IBotMessage): Promise<IBotResponse> {
        // Only owner can use RBAC management commands
        if (message.senderId !== this.ownerId) {
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

    private async handleRolesCommand(): Promise<IBotResponse> {
        const result = await this.rbacService.handleRolesCommand();
        return { content: result.message };
    }

    private async handleGrantCommand(userId: string, targetUser: string, permission: string): Promise<IBotResponse> {
        const targetUserId = await this.resolveUserId(targetUser);
        if (!targetUserId) {
            return { content: '❌ User not found' };
        }

        const result = await this.rbacService.handleGrantCommand(userId, targetUserId, permission);
        return { content: result.message };
    }

    private async handleRevokeCommand(userId: string, targetUser: string, permission: string): Promise<IBotResponse> {
        const targetUserId = await this.resolveUserId(targetUser);
        if (!targetUserId) {
            return { content: '❌ User not found' };
        }

        const result = await this.rbacService.handleRevokeCommand(userId, targetUserId, permission);
        return { content: result.message };
    }

    private async handleRoleCommand(userId: string, targetUser: string, role: string): Promise<IBotResponse> {
        const targetUserId = await this.resolveUserId(targetUser);
        if (!targetUserId) {
            return { content: '❌ User not found' };
        }

        const result = await this.rbacService.handleRoleCommand(userId, targetUserId, role);
        return { content: result.message };
    }

    private async handlePermsCommand(targetUser: string): Promise<IBotResponse> {
        const targetUserId = await this.resolveUserId(targetUser);
        if (!targetUserId) {
            return { content: '❌ User not found' };
        }

        const result = await this.rbacService.handlePermsCommand(targetUserId);
        return { content: result.message };
    }

    // This method should be implemented by platform-specific bot services
    protected abstract resolveUserId(userIdentifier: string): Promise<string | null>;

    // This method should be implemented by platform-specific bot services
    protected abstract sendMessage(chatId: string, response: IBotResponse): Promise<void>;

    // This method should be implemented by platform-specific bot services
    public abstract start(): Promise<void>;
} 