/**
 * User Management Service
 * Enterprise user administration with RBAC
 */

import { User } from '../models';
import { AuditLog } from '../models/audit-log.model';
import { UserRole, AuditAction, RoleHierarchy } from '../types';
import { NotFoundError, ForbiddenError, ValidationError, AppError } from '../middleware';
import logger from '../config/logger';

export class UserService {
  /**
   * Split a display name into firstName/lastName (model requires both).
   */
  private splitName(name: string, firstName?: string, lastName?: string): { firstName: string; lastName: string } {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: firstName || parts[0] || 'Unknown',
      lastName: lastName || parts.slice(1).join(' ') || 'Unknown',
    };
  }

  /**
   * Create a new user (admin function)
   */
  async create(data: {
    email: string;
    password: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    department?: string;
    role: UserRole;
    createdBy: string;
    ipAddress?: string;
  }): Promise<any> {
    // Check if user exists
    const existingUser = await User.findOne({ email: data.email.toLowerCase() });
    if (existingUser) {
      throw new ValidationError('Email already registered', [
        { field: 'email', message: 'A user with this email already exists' },
      ]);
    }

    // Verify creator can assign this role
    const creator: any = await User.findById(data.createdBy);
    if (!creator) {
      throw new ForbiddenError('Invalid creator');
    }

    if (!creator.canAssignRole(data.role)) {
      throw new ForbiddenError(`Cannot assign role ${data.role}`);
    }

    const { firstName, lastName } = this.splitName(data.name ?? '', data.firstName, data.lastName);

    // Create user
    const user = await User.create({
      email: data.email.toLowerCase(),
      password: data.password,
      firstName,
      lastName,
      department: data.department,
      role: data.role,
      createdBy: data.createdBy,
    });

    // Audit
    await (AuditLog as any).log({
      userId: data.createdBy,
      action: AuditAction.USER_CREATE,
      entityType: 'User',
      entityId: user._id.toString(),
      ipAddress: data.ipAddress,
      status: 'success',
      details: { email: user.email, role: user.role },
    });

    logger.info(`User created by ${data.createdBy}: ${user.email} with role ${user.role}`);
    return user;
  }

  /**
   * Get all users with pagination
   */
  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
    role?: UserRole;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ users: any[]; total: number; totalPages: number }> {
    const { page, limit, search, role, isActive, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const query: any = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive;

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const users = await User.find(query)
      .select('-password -failedLoginAttempts -lockedUntil')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // lean() bypasses toJSON transform — add display name explicitly
    users.forEach((u: any) => {
      u.name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email;
    });

    return { users, total, totalPages };
  }

  /**
   * Get user by ID
   */
  async findById(id: string): Promise<any> {
    const user = await User.findById(id)
      .select('-password -failedLoginAttempts -lockedUntil')
      .lean();

    if (!user) {
      throw new NotFoundError('User');
    }

    (user as any).name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    return user;
  }

  /**
   * Update user
   * Supports profile fields (name, email, department, password) plus role
   * changes with the same RBAC guards as the dedicated role endpoint.
   */
  async update(
    id: string,
    data: {
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      department?: string;
      password?: string;
      role?: UserRole;
    },
    updatedBy: string,
    ipAddress?: string
  ): Promise<any> {
    const user = await User.findById(id);
    if (!user) {
      throw new NotFoundError('User');
    }

    const updater: any = await User.findById(updatedBy);
    if (!updater) {
      throw new NotFoundError('User');
    }

    const updatingSelf = id === updatedBy;

    // Only allow updating own profile, or admins managing strictly-lower users
    if (!updatingSelf && !updater.canManageUser(user)) {
      throw new ForbiddenError('Cannot update this user');
    }

    // Name fields (frontend sends a single `name`; model stores first/last)
    const { firstName, lastName } = this.splitName(data.name ?? '', data.firstName, data.lastName);
    if (data.name || data.firstName || data.lastName) {
      user.firstName = firstName;
      user.lastName = lastName;
    }
    if (data.email) user.email = data.email.toLowerCase();
    if (data.department !== undefined) user.department = data.department;
    if (data.password) user.password = data.password;

    // Role change — same guards as changeRole(); self-demotion allowed if assignable
    let roleChanged = false;
    const oldRole = user.role;
    if (data.role && data.role !== user.role) {
      if (!updater.canAssignRole(data.role)) {
        throw new ForbiddenError('Cannot assign this role');
      }
      if (!updatingSelf && !updater.canManageUser(user)) {
        throw new ForbiddenError('Cannot change role of this user');
      }
      user.role = data.role;
      roleChanged = true;
    }

    await user.save();

    // Audit
    await (AuditLog as any).log({
      userId: updatedBy,
      action: roleChanged ? AuditAction.USER_ROLE_CHANGE : AuditAction.USER_UPDATE,
      entityType: 'User',
      entityId: id,
      ipAddress,
      status: 'success',
      details: roleChanged
        ? { oldRole, newRole: data.role, updatedFields: Object.keys(data) }
        : { updatedFields: Object.keys(data) },
    });

    return user;
  }

  /**
   * Change user role
   */
  async changeRole(
    userId: string,
    newRole: UserRole,
    changedBy: string,
    ipAddress?: string
  ): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const changer: any = await User.findById(changedBy);

    if (!changer.canAssignRole(newRole)) {
      throw new ForbiddenError('Cannot assign this role');
    }

    if (!changer.canManageUser(user)) {
      throw new ForbiddenError('Cannot change role of this user');
    }

    const oldRole = user.role;
    user.role = newRole;
    await user.save();

    // Audit
    await (AuditLog as any).log({
      userId: changedBy,
      action: AuditAction.USER_ROLE_CHANGE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      status: 'success',
      details: { oldRole, newRole },
    });

    logger.info(`User ${userId} role changed from ${oldRole} to ${newRole} by ${changedBy}`);
    return user;
  }

  /**
   * Activate/deactivate user
   */
  async setActive(userId: string, isActive: boolean, changedBy: string, ipAddress?: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const changer: any = await User.findById(changedBy);

    if (!changer.canManageUser(user)) {
      throw new ForbiddenError('Cannot modify this user');
    }

    user.isActive = isActive;
    if (isActive) {
      user.isLocked = false;
      user.lockedUntil = undefined;
      user.failedLoginAttempts = 0;
    }

    await user.save();

    // Audit
    await (AuditLog as any).log({
      userId: changedBy,
      action: isActive ? AuditAction.USER_ACTIVATE : AuditAction.USER_DEACTIVATE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      status: 'success',
    });

    logger.info(`User ${userId} ${isActive ? 'activated' : 'deactivated'} by ${changedBy}`);
    return user;
  }

  /**
   * Unlock locked user
   */
  async unlock(userId: string, unlockedBy: string, ipAddress?: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.isLocked = false;
    user.lockedUntil = undefined;
    user.failedLoginAttempts = 0;
    await user.save();

    await (AuditLog as any).log({
      userId: unlockedBy,
      action: AuditAction.USER_UPDATE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      status: 'success',
      details: { action: 'unlock' },
    });

    logger.info(`User ${userId} unlocked by ${unlockedBy}`);
    return user;
  }

  /**
   * Delete user (soft delete - deactivate)
   */
  async delete(userId: string, deletedBy: string, ipAddress?: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const deleter: any = await User.findById(deletedBy);

    if (!deleter.canManageUser(user)) {
      throw new ForbiddenError('Cannot delete this user');
    }

    // Instead of hard delete, deactivate
    user.isActive = false;
    await user.save();

    await (AuditLog as any).log({
      userId: deletedBy,
      action: AuditAction.USER_DELETE,
      entityType: 'User',
      entityId: userId,
      ipAddress,
      status: 'success',
    });

    logger.info(`User ${userId} deactivated by ${deletedBy}`);
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<any> {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ isActive: true });
    const locked = await User.countDocuments({ isLocked: true });

    const byRole = await User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]);

    return {
      total,
      active,
      locked,
      byRole: byRole.reduce((acc: any, item: any) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }
}

export const userService = new UserService();
export default userService;