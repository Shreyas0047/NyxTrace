import { Response } from 'express';
import { configService } from '../services';
import { AuthenticatedRequest } from '../middleware';

export class ConfigController {
  async getConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    const config = configService.getConfig();
    res.json({ success: true, message: 'System configuration retrieved', data: config });
  }

  async updateConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { section, values } = req.body;
    if (!section || !values) {
      res.status(400).json({ success: false, message: 'section and values are required' });
      return;
    }
    const config = configService.updateConfig(section, values);
    res.json({ success: true, message: 'Configuration updated', data: config });
  }

  async getSection(req: AuthenticatedRequest, res: Response): Promise<void> {
    const section = configService.getSection(req.params.section);
    if (!section) {
      res.status(404).json({ success: false, message: 'Section not found' });
      return;
    }
    res.json({ success: true, message: 'Section retrieved', data: section });
  }

  async resetConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    const config = configService.resetConfig();
    res.json({ success: true, message: 'Configuration reset to defaults', data: config });
  }
}

export const configController = new ConfigController();
export default configController;
