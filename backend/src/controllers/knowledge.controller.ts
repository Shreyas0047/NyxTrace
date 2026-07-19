import { Response } from 'express';
import { knowledgeService } from '../services';
import { AuthenticatedRequest } from '../middleware';

export class KnowledgeController {
  async findAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { page, limit, category, type, search } = req.query as Record<string, string>;
    const result = await knowledgeService.findAll({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
      category,
      type,
      search,
      published: true,
    });

    res.json({
      success: true,
      message: 'Articles retrieved',
      data: result.articles,
      meta: {
        page: result.page,
        limit: Number(limit) || 20,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  }

  async findById(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await knowledgeService.findById(req.params.id);
    if (!article) {
      res.status(404).json({ success: false, message: 'Article not found' });
      return;
    }
    res.json({ success: true, message: 'Article retrieved', data: article });
  }

  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await knowledgeService.create(req.body);
    res.status(201).json({ success: true, message: 'Article created', data: article });
  }

  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    const article = await knowledgeService.update(req.params.id, req.body);
    if (!article) {
      res.status(404).json({ success: false, message: 'Article not found' });
      return;
    }
    res.json({ success: true, message: 'Article updated', data: article });
  }

  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    await knowledgeService.delete(req.params.id);
    res.json({ success: true, message: 'Article deleted' });
  }
}

export const knowledgeController = new KnowledgeController();
export default knowledgeController;
