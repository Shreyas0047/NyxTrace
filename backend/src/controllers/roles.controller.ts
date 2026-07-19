import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware';
import { UserRole, RoleHierarchy, RoleNames, RolePermissions, Permission } from '../types';

export class RolesController {
  async getRoles(req: AuthenticatedRequest, res: Response): Promise<void> {
    const roles = Object.values(UserRole).map((role) => ({
      id: role,
      name: RoleNames[role],
      hierarchy: RoleHierarchy[role],
      userCount: 0,
      permissions: RolePermissions[role],
    }));

    res.json({
      success: true,
      message: 'Roles retrieved',
      data: roles,
    });
  }

  async getPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    const permissions = Object.values(Permission).map((perm) => ({
      id: perm,
      name: perm,
    }));

    res.json({
      success: true,
      message: 'Permissions retrieved',
      data: permissions,
    });
  }
}

export const rolesController = new RolesController();
export default rolesController;
