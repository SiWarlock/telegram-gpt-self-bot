import { PrismaClient, Prisma } from '@prisma/client';

export class PermissionsService {
    private prisma: PrismaClient;

    // Default roles and their permissions
    private readonly DEFAULT_ROLES = {
        admin: ['manage_users', 'manage_roles', 'use_gpt', 'use_tldr', 'use_games', 'use_bot'],
        moderator: ['use_gpt', 'use_tldr', 'use_games', 'manage_games', 'use_bot'],
        user: ['use_gpt', 'use_tldr', 'use_games', 'use_bot']
    };

    constructor() {
        this.prisma = new PrismaClient();
        this.initializeDefaultRoles();
    }

    private async initializeDefaultRoles() {
        try {
            // Create default permissions first
            const allPermissions = new Set<string>();
            Object.values(this.DEFAULT_ROLES).forEach(perms => 
                perms.forEach((p: string) => allPermissions.add(p))
            );

            for (const permName of allPermissions) {
                await this.prisma.permission.upsert({
                    where: { name: permName },
                    update: {},
                    create: { name: permName }
                });
            }

            // Create default roles with their permissions
            for (const [roleName, permissions] of Object.entries(this.DEFAULT_ROLES)) {
                const role = await this.prisma.role.upsert({
                    where: { name: roleName },
                    update: {},
                    create: { name: roleName }
                });

                // Connect permissions to role
                await this.prisma.role.update({
                    where: { id: role.id },
                    data: {
                        permissions: {
                            connect: permissions.map(p => ({ name: p }))
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing default roles:', error);
        }
    }

    // Check if a user has a specific permission
    async hasPermission(userId: string, permissionName: string): Promise<boolean> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    permissions: true,
                    roles: {
                        include: {
                            permissions: true
                        }
                    }
                }
            });

            if (!user) return false;

            // Check direct permissions
            if (user.permissions.some((p: { name: string }) => p.name === permissionName)) return true;

            // Check role-based permissions
            return user.roles.some((role: { permissions: Array<{ name: string }> }) => 
                role.permissions.some((p: { name: string }) => p.name === permissionName)
            );
        } catch (error) {
            console.error('Error checking permission:', error);
            return false;
        }
    }

    // Grant a permission to a user
    async grantPermission(userId: string, permissionName: string): Promise<boolean> {
        try {
            await this.prisma.user.upsert({
                where: { id: userId },
                update: {
                    permissions: {
                        connect: { name: permissionName }
                    }
                },
                create: {
                    id: userId,
                    permissions: {
                        connect: { name: permissionName }
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error granting permission:', error);
            return false;
        }
    }

    // Revoke a permission from a user
    async revokePermission(userId: string, permissionName: string): Promise<boolean> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    permissions: {
                        disconnect: { name: permissionName }
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error revoking permission:', error);
            return false;
        }
    }

    // Assign a role to a user
    async assignRole(userId: string, roleName: string): Promise<boolean> {
        try {
            await this.prisma.user.upsert({
                where: { id: userId },
                update: {
                    roles: {
                        connect: { name: roleName }
                    }
                },
                create: {
                    id: userId,
                    roles: {
                        connect: { name: roleName }
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error assigning role:', error);
            return false;
        }
    }

    // Remove a role from a user
    async removeRole(userId: string, roleName: string): Promise<boolean> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: {
                    roles: {
                        disconnect: { name: roleName }
                    }
                }
            });
            return true;
        } catch (error) {
            console.error('Error removing role:', error);
            return false;
        }
    }

    // Get all permissions for a user (including role-based permissions)
    async getUserPermissions(userId: string): Promise<string[]> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: {
                    permissions: true,
                    roles: {
                        include: {
                            permissions: true
                        }
                    }
                }
            });

            if (!user) return [];

            const permissions = new Set<string>();
            
            // Add direct permissions
            user.permissions.forEach((p: { name: string }) => permissions.add(p.name));
            
            // Add role-based permissions
            user.roles.forEach((role: { permissions: Array<{ name: string }> }) => 
                role.permissions.forEach(p => permissions.add(p.name))
            );

            return Array.from(permissions);
        } catch (error) {
            console.error('Error getting user permissions:', error);
            return [];
        }
    }

    // Get user roles
    async getUserRoles(userId: string): Promise<string[]> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { roles: true }
            });

            return user?.roles.map((r: { name: string }) => r.name) || [];
        } catch (error) {
            console.error('Error getting user roles:', error);
            return [];
        }
    }

    // Get available roles
    async getAvailableRoles(): Promise<string[]> {
        try {
            const roles = await this.prisma.role.findMany();
            return roles.map((r: { name: string }) => r.name);
        } catch (error) {
            console.error('Error getting available roles:', error);
            return [];
        }
    }

    // Get permissions for a role
    async getRolePermissions(roleName: string): Promise<string[]> {
        try {
            const role = await this.prisma.role.findUnique({
                where: { name: roleName },
                include: { permissions: true }
            });

            return role?.permissions.map((p: { name: string }) => p.name) || [];
        } catch (error) {
            console.error('Error getting role permissions:', error);
            return [];
        }
    }
} 