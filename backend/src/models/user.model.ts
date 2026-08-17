/**
 * User Model - Enterprise Security Enhanced
 * Mongoose schema for user authentication and authorization
 */

import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, RoleHierarchy, RolePermissions, Permission } from '../types';

// Password validation: min 8 chars, at least 1 number
const PASSWORD_REGEX = /^(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;

const userSchema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
    validate: {
      validator: function(v: string) {
        // Skip validation if password not being modified
        if (!this.isModified('password') || this.isNew) return true;
        return PASSWORD_REGEX.test(v);
      },
      message: 'Password must be at least 8 characters with at least one number',
    },
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50,
  },
  department: {
    type: String,
    trim: true,
    maxlength: 100,
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.AUDITOR,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isLocked: {
    type: Boolean,
    default: false,
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  lockedUntil: {
    type: Date,
  },
  lastLogin: {
    type: Date,
  },
  lastLoginIp: {
    type: String,
  },
  passwordChangedAt: {
    type: Date,
  },
  mustChangePassword: {
    type: Boolean,
    default: false,
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      ret.name = [ret.firstName, ret.lastName].filter(Boolean).join(' ').trim() || ret.email;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.failedLoginAttempts;
      delete ret.lockedUntil;
      return ret;
    },
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = new Date();
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if user has specific permission
userSchema.methods.hasPermission = function(permission: Permission): boolean {
  const permissions = RolePermissions[this.role as UserRole];
  return permissions.includes(permission);
};

// Check if user role allows access to target role
userSchema.methods.canAssignRole = function(targetRole: UserRole): boolean {
  const currentHierarchy = RoleHierarchy[this.role as UserRole];
  const targetHierarchy = RoleHierarchy[targetRole];

  // Can only assign roles lower than or equal to own level
  return currentHierarchy >= targetHierarchy;
};

// Check if user can manage target user
userSchema.methods.canManageUser = function(targetUser: any): boolean {
  // Can always manage self
  if (targetUser._id.equals(this._id)) return false; // Actually can but different check

  // Super admin can manage everyone
  if (this.role === UserRole.SUPER_ADMIN) return true;

  // Admin cannot manage super admin
  if (targetUser.role === UserRole.SUPER_ADMIN) return false;

  // Admin can manage below admin level
  const currentHierarchy = RoleHierarchy[this.role as UserRole];
  const targetHierarchy = RoleHierarchy[targetUser.role as UserRole];

  return currentHierarchy > targetHierarchy;
};

// Increment failed login attempts
userSchema.methods.incrementFailedLogin = async function() {
  this.failedLoginAttempts += 1;

  // Lock account after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.isLocked = true;
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }

  await this.save();
};

// Reset failed login attempts on successful login
userSchema.methods.resetFailedLogin = async function() {
  this.failedLoginAttempts = 0;
  this.isLocked = false;
  this.lockedUntil = undefined;
  this.lastLogin = new Date();
  await this.save();
};

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ isLocked: 1 });
userSchema.index({ createdAt: -1 });

export const User = mongoose.model('User', userSchema);
export default User;