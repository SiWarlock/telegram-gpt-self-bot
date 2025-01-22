import { PermissionsService } from './permissions.service';

export class BotRBACService {
    constructor(private permissionsService: PermissionsService) {}

    async hasPermission(userId: string, permission: string, ownerId?: string): Promise<boolean> {
        // Owner always has all permissions
        if (ownerId && userId === ownerId) {
            return true;
        }
        return this.permissionsService.hasPermission(userId, permission);
    }

    async handleGrantCommand(userId: string, targetUserId: string, permission: string): Promise<{ success: boolean; message: string }> {
        try {
            const granted = await this.permissionsService.grantPermission(targetUserId, permission);
            if (granted) {
                return {
                    success: true,
                    message: `✅ Granted "${permission}" permission to user`
                };
            } else {
                return {
                    success: true,
                    message: `ℹ️ User already has "${permission}" permission`
                };
            }
        } catch (error) {
            console.error('Error granting permission:', error);
            return {
                success: false,
                message: '❌ Failed to grant permission'
            };
        }
    }

    async handleRevokeCommand(userId: string, targetUserId: string, permission: string): Promise<{ success: boolean; message: string }> {
        try {
            const revoked = await this.permissionsService.revokePermission(targetUserId, permission);
            if (revoked) {
                return {
                    success: true,
                    message: `✅ Revoked "${permission}" permission from user`
                };
            } else {
                return {
                    success: true,
                    message: `ℹ️ User doesn't have "${permission}" permission`
                };
            }
        } catch (error) {
            console.error('Error revoking permission:', error);
            return {
                success: false,
                message: '❌ Failed to revoke permission'
            };
        }
    }

    async handleRoleCommand(userId: string, targetUserId: string, role: string): Promise<{ success: boolean; message: string }> {
        try {
            const assigned = await this.permissionsService.assignRole(targetUserId, role);
            if (assigned) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                return {
                    success: true,
                    message: `✅ Assigned role "${role}" to user\n📋 Permissions: ${permissions.join(', ')}`
                };
            } else {
                return {
                    success: false,
                    message: `❌ Invalid role "${role}" or user already has this role`
                };
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            return {
                success: false,
                message: '❌ Failed to assign role'
            };
        }
    }

    async handlePermsCommand(userId: string): Promise<{ success: boolean; message: string }> {
        try {
            const roles = await this.permissionsService.getUserRoles(userId);
            const permissions = await this.permissionsService.getUserPermissions(userId);

            return {
                success: true,
                message: `👤 User Permissions:\n` +
                        `👑 Roles: ${roles.join(', ') || 'None'}\n` +
                        `📋 Permissions: ${permissions.join(', ') || 'None'}`
            };
        } catch (error) {
            console.error('Error getting permissions:', error);
            return {
                success: false,
                message: '❌ Failed to get permissions'
            };
        }
    }

    async handleRolesCommand(): Promise<{ success: boolean; message: string }> {
        try {
            const roles = await this.permissionsService.getAvailableRoles();
            let message = '👑 Available Roles:\n\n';

            for (const role of roles) {
                const permissions = await this.permissionsService.getRolePermissions(role);
                message += `${role}:\n📋 ${permissions.join(', ') || 'No permissions'}\n\n`;
            }

            return {
                success: true,
                message
            };
        } catch (error) {
            console.error('Error listing roles:', error);
            return {
                success: false,
                message: '❌ Failed to list roles'
            };
        }
    }

    async getUserRoles(userId: string): Promise<string[]> {
        return this.permissionsService.getUserRoles(userId);
    }

    async getUserPermissions(userId: string): Promise<string[]> {
        return this.permissionsService.getUserPermissions(userId);
    }
} 