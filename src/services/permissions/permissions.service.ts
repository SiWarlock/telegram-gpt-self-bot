import { PrismaClient } from '@prisma/client';

export class PermissionsService {
    private static instance: PermissionsService;
    private prisma: PrismaClient;
    private isInitialized: boolean = false;

    // Default roles and their permissions
    private readonly DEFAULT_ROLES = {
        admin: ['manage_users', 'manage_roles', 'use_gpt', 'use_tldr', 'use_games', 'use_bot'],
        moderator: ['use_gpt', 'use_tldr', 'use_games', 'manage_games', 'use_bot'],
        user: ['use_gpt', 'use_tldr', 'use_games', 'use_bot']
    };

    private constructor() {
        this.prisma = new PrismaClient();
        // Initialize roles silently without sending messages
        this.initializeDefaultRoles().catch(error => {
            console.error('Failed to initialize default roles:', error);
        });
    }

    public static getInstance(): PermissionsService {
        if (!PermissionsService.instance) {
            PermissionsService.instance = new PermissionsService();
        }
        return PermissionsService.instance;
    }

    private async initializeDefaultRoles() {
        if (this.isInitialized) return;
        
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
            
            this.isInitialized = true;
            // Only log initialization once at startup
            if (!PermissionsService.instance) {
                console.log('Default roles and permissions initialized successfully');
            }
        } catch (error) {
            console.error('Error initializing default roles:', error);
        }
    }

    // Ensure initialization is complete before any operation
    private async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initializeDefaultRoles();
        }
    }

    // Check if a user has a specific permission
    async hasPermission(userId: string, permissionName: string): Promise<boolean> {
        await this.ensureInitialized();
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

            if (!user) {
                console.log(`[RBAC] User ${userId} not found in database`);
                return false;
            }

            // Check direct permissions
            if (user.permissions.some((p: { name: string }) => p.name === permissionName)) return true;

            // Check role-based permissions
            const hasRolePerm = user.roles.some((role: { permissions: Array<{ name: string }> }) => 
                role.permissions.some((p: { name: string }) => p.name === permissionName)
            );
            
            if (!hasRolePerm) {
                console.log(`[RBAC] User ${userId} found but missing permission ${permissionName}. Roles: ${user.roles.map((r: any) => r.name).join(', ')}`);
            }
            return hasRolePerm;

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
            await this.logAction('ROLE_ASSIGN', `Assigned role ${roleName} to user ${userId}`);
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
            await this.logAction('ROLE_REMOVE', `Removed role ${roleName} from user ${userId}`);
            return true;
        } catch (error) {
            console.error('Error removing role:', error);
            return false;
        }
    }

    // Get user roles
    async getUserRoles(userId: string): Promise<string[]> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { roles: true }
            });
            return user?.roles.map(r => r.name) || [];
        } catch (error) {
            console.error('Error getting user roles:', error);
            return [];
        }
    }

    // Get user permissions (including role-based permissions)
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

            const directPerms = user.permissions.map(p => p.name);
            const rolePerms = user.roles.flatMap(role => role.permissions.map(p => p.name));
            
            return [...new Set([...directPerms, ...rolePerms])];
        } catch (error) {
            console.error('Error getting user permissions:', error);
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

    // Get all users
    async getAllUsers() {
        try {
            const users = await this.prisma.user.findMany();
            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    }

    // Get total user count
    async getUserCount(): Promise<number> {
        try {
            const count = await this.prisma.user.count();
            return count;
        } catch (error) {
            console.error('Error getting user count:', error);
            return 0;
        }
    }

    // Get a specific user
    async getUser(userId: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId }
            });
            return user;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    }

    // Add a new user
    async addUser(userData: { id: string; username?: string }) {
        try {
            const user = await this.prisma.user.create({
                data: userData
            });
            await this.logAction('ADD_USER', `Added user ${userData.username || userData.id}`);
            return user;
        } catch (error) {
            console.error('Error adding user:', error);
            return null;
        }
    }

    // Remove a user
    async removeUser(userId: string) {
        try {
            await this.prisma.user.delete({
                where: { id: userId }
            });
            await this.logAction('REMOVE_USER', `Removed user ${userId}`);
            return true;
        } catch (error) {
            console.error('Error removing user:', error);
            return false;
        }
    }

    // Check if user has a specific role
    async hasRole(userId: string, roleName: string): Promise<boolean> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                include: { roles: true }
            });

            return user?.roles.some((r: { name: string }) => r.name === roleName) || false;
        } catch (error) {
            console.error('Error checking role:', error);
            return false;
        }
    }

    async getRecentLogs(limit: number = 10) {
        try {
            const logs = await this.prisma.log.findMany({
                take: limit,
                orderBy: { timestamp: 'desc' }
            });
            return logs;
        } catch (error) {
            console.error('Error getting logs:', error);
            return [];
        }
    }

    private async logAction(action: string, details: string) {
        try {
            await this.prisma.log.create({
                data: {
                    action,
                    details,
                    timestamp: new Date()
                }
            });
        } catch (error) {
            console.error('Error logging action:', error);
        }
    }

    // Get default roles and permissions
    public getDefaultRoles() {
        return this.DEFAULT_ROLES;
    }
} 