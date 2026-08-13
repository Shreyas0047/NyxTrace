/**
 * Investigation Service
 * Business logic for investigation management
 */

import { Investigation } from '../models';
import { InvestigationStatus, InvestigationPriority } from '../types';
import { NotFoundError, ValidationError } from '../middleware';
import { v4 as uuidv4 } from 'uuid';

export class InvestigationService {
  /**
   * Create a new investigation
   */
  async create(data: {
    title: string;
    description: string;
    priority?: InvestigationPriority;
    caseNumber?: string;
    assignedTo?: string;
    createdBy: string;
    tags?: string[];
  }): Promise<any> {
    // Generate case number if not provided
    const caseNumber = data.caseNumber || this.generateCaseNumber();

    // Check for duplicate case number
    const existing = await Investigation.findOne({ caseNumber });
    if (existing) {
      throw new ValidationError('Case number already exists', [
        { field: 'caseNumber', message: 'An investigation with this case number already exists' },
      ]);
    }

    const investigation = await Investigation.create({
      title: data.title,
      description: data.description,
      priority: data.priority || InvestigationPriority.MEDIUM,
      caseNumber,
      leadAnalyst: data.assignedTo,
      createdBy: data.createdBy,
      tags: data.tags || [],
    });

    return investigation;
  }

  /**
   * Get all investigations with pagination and filters
   */
  async findAll(options: {
    page: number;
    limit: number;
    status?: InvestigationStatus;
    priority?: InvestigationPriority;
    assignedTo?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ investigations: any[]; total: number; totalPages: number }> {
    const { page, limit, status, priority, assignedTo, search, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    // Build query
    const query: Record<string, any> = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.leadAnalyst = assignedTo;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { caseNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Execute query
    const total = await Investigation.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const investigations = await Investigation.find(query)
      .populate('leadAnalyst', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return { investigations: investigations as any, total, totalPages };
  }

  /**
   * Get investigation by ID
   */
  async findById(id: string): Promise<any> {
    const investigation = await Investigation.findById(id)
      .populate('leadAnalyst', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!investigation) {
      throw new NotFoundError('Investigation');
    }

    return investigation as any;
  }

  /**
   * Update investigation
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      status?: InvestigationStatus;
      priority?: InvestigationPriority;
      assignedTo?: string;
      tags?: string[];
    }
  ): Promise<any> {
    const investigation = await Investigation.findById(id);

    if (!investigation) {
      throw new NotFoundError('Investigation');
    }

    // Handle status change to closed
    if (data.status === InvestigationStatus.CLOSED && investigation.status !== InvestigationStatus.CLOSED) {
      data.status = InvestigationStatus.CLOSED;
      (investigation as any).closedAt = new Date();
    }

    Object.assign(investigation, data);
    await investigation.save();

    return investigation;
  }

  /**
   * Delete investigation
   */
  async delete(id: string): Promise<void> {
    const result = await Investigation.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundError('Investigation');
    }
  }

  /**
   * Get investigation statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  }> {
    const total = await Investigation.countDocuments();

    const byStatus = await Investigation.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const byPriority = await Investigation.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
      byPriority: byPriority.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
    };
  }

  /**
   * Generate unique case number
   */
  private generateCaseNumber(): string {
    const year = new Date().getFullYear();
    const uuid = uuidv4().split('-')[0].toUpperCase();
    return `CASE-${year}-${uuid}`;
  }
}

export const investigationService = new InvestigationService();
export default investigationService;