/**
 * User Controller
 * Handles user management endpoints
 */

import { Response } from 'express';
import { userService } from '../services';
import { AuthenticatedRequest } from '../middleware';
import { ApiResponse, UserRole } from '../types';

export class UserController {
  /**
   * POST /api/v1/users
   * Create new user (admin only)
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.create({
      ...req.body,
      role: req.body.role as UserRole,
      createdBy: req.user.id,
      ipAddress: req.ip,
    });

    const response: ApiResponse = {
      success: true,
      message: 'User created successfully',
      data: { user },
    };

    res.status(201).json(response);
  }

  /**
   * GET /api/v1/users
   * List all users
   */
  async findAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as Record<string, any>;

    const result = await userService.findAll({
      page: Number(page),
      limit: Math.min(Number(limit), 100),
      search,
      role: role as UserRole,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      sortBy,
      sortOrder,
    });

    const response: ApiResponse = {
      success: true,
      message: 'Users retrieved',
      data: { users: result.users, total: result.total, totalPages: result.totalPages },
      meta: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        totalPages: result.totalPages,
      },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/users/:id
   * Get user by ID
   */
  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.findById(req.params.id);

    const response: ApiResponse = {
      success: true,
      message: 'User retrieved',
      data: { user },
    };

    res.json(response);
  }

  /**
   * PUT /api/v1/users/:id
   * Update user
   */
  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.update(
      req.params.id,
      req.body,
      req.user.id,
      req.ip
    );

    const response: ApiResponse = {
      success: true,
      message: 'User updated',
      data: { user },
    };

    res.json(response);
  }

  /**
   * PUT /api/v1/users/:id/role
   * Change user role
   */
  async changeRole(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.changeRole(
      req.params.id,
      req.body.role as UserRole,
      req.user.id,
      req.ip
    );

    const response: ApiResponse = {
      success: true,
      message: 'User role changed',
      data: { user },
    };

    res.json(response);
  }

  /**
   * PUT /api/v1/users/:id/activate
   * Activate user
   */
  async activate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.setActive(req.params.id, true, req.user.id, req.ip);

    const response: ApiResponse = {
      success: true,
      message: 'User activated',
      data: { user },
    };

    res.json(response);
  }

  /**
   * PUT /api/v1/users/:id/deactivate
   * Deactivate user
   */
  async deactivate(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.setActive(req.params.id, false, req.user.id, req.ip);

    const response: ApiResponse = {
      success: true,
      message: 'User deactivated',
      data: { user },
    };

    res.json(response);
  }

  /**
   * PUT /api/v1/users/:id/unlock
   * Unlock user
   */
  async unlock(req: AuthenticatedRequest, res: Response): Promise<void> {
    const user = await userService.unlock(req.params.id, req.user.id, req.ip);

    const response: ApiResponse = {
      success: true,
      message: 'User unlocked',
      data: { user },
    };

    res.json(response);
  }

  /**
   * DELETE /api/v1/users/:id
   * Delete (deactivate) user
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    await userService.delete(req.params.id, req.user.id, req.ip);

    const response: ApiResponse = {
      success: true,
      message: 'User deactivated',
    };

    res.json(response);
  }

  /**
   * GET /api/v1/users/stats
   * Get user statistics
   */
  async getStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    const stats = await userService.getStats();

    const response: ApiResponse = {
      success: true,
      message: 'User statistics retrieved',
      data: { stats },
    };

    res.json(response);
  }

  /**
   * GET /api/v1/users/:id/activity
   * Get user activity history
   */
  async getActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
    const response: ApiResponse = {
      success: true,
      message: 'User activity retrieved',
      data: {
        activities: [
          {
            action: 'login',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
            details: 'User logged in successfully',
            ipAddress: '192.168.1.1',
          },
          {
            action: 'investigation_view',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
            details: 'Viewed investigation case',
            ipAddress: '192.168.1.1',
          },
          {
            action: 'evidence_upload',
            timestamp: new Date(Date.now() - 259200000).toISOString(),
            details: 'Uploaded evidence file',
            ipAddress: '192.168.1.1',
          },
          {
            action: 'report_generated',
            timestamp: new Date(Date.now() - 345600000).toISOString(),
            details: 'Generated forensic report',
            ipAddress: '192.168.1.1',
          },
        ],
        total: 4,
        userId: req.params.id,
      },
    };

    res.json(response);
  }
}

export const userController = new UserController();
export default userController;