import KnowledgeArticle from '../models/knowledge-article.model';
import logger from '../config/logger';

interface ArticleQuery {
  page?: number;
  limit?: number;
  category?: string;
  type?: string;
  search?: string;
  published?: boolean;
}

export class KnowledgeService {
  async findAll(query: ArticleQuery) {
    const { page = 1, limit = 20, category, type, search, published } = query;
    const filter: Record<string, unknown> = {};

    if (category) filter.category = category;
    if (type) filter.type = type;
    if (published !== undefined) filter.published = published;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const [articles, total] = await Promise.all([
      KnowledgeArticle.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit),
      KnowledgeArticle.countDocuments(filter),
    ]);

    return {
      articles,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const article = await KnowledgeArticle.findById(id);
    return article;
  }

  async create(data: Record<string, unknown>) {
    const article = await KnowledgeArticle.create(data);
    return article;
  }

  async update(id: string, data: Record<string, unknown>) {
    const article = await KnowledgeArticle.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    return article;
  }

  async delete(id: string) {
    await KnowledgeArticle.findByIdAndDelete(id);
  }

  async seed() {
    const count = await KnowledgeArticle.countDocuments();
    if (count > 0) return;

    const articles = [
      { title: 'Digital Forensics 101: Evidence Collection Best Practices', excerpt: 'Learn the foundational principles of collecting, preserving, and documenting digital evidence for forensic analysis.', category: 'forensics', type: 'guide', readTime: '12 min', author: 'NyxTrace Team', tags: ['forensics', 'evidence', 'collection'] },
      { title: 'Malware Classification Framework', excerpt: 'A comprehensive guide to classifying malware samples based on behavior, propagation, and payload characteristics.', category: 'malware', type: 'reference', readTime: '8 min', author: 'NyxTrace Team', tags: ['malware', 'classification', 'analysis'] },
      { title: 'Blockchain Evidence Verification', excerpt: 'How NyxTrace anchors evidence hashes to the blockchain for tamper-proof chain of custody.', category: 'blockchain', type: 'tutorial', readTime: '15 min', author: 'NyxTrace Team', tags: ['blockchain', 'evidence', 'verification'] },
      { title: 'Sandbox Environment Setup Guide', excerpt: 'Step-by-step instructions for configuring and deploying VirtualBox sandbox environments for malware simulation.', category: 'sandbox', type: 'guide', readTime: '20 min', author: 'NyxTrace Team', tags: ['sandbox', 'setup', 'virtualbox'] },
      { title: 'MITRE ATT&CK Mapping Reference', excerpt: 'Reference table mapping common malware techniques to MITRE ATT&CK framework tactics and techniques.', category: 'forensics', type: 'reference', readTime: '10 min', author: 'NyxTrace Team', tags: ['mitre', 'attack', 'mapping'] },
      { title: 'Running Your First Sandbox Session', excerpt: 'Walk through creating, executing, and analyzing your first sandbox session with real-time telemetry.', category: 'sandbox', type: 'tutorial', readTime: '25 min', author: 'NyxTrace Team', tags: ['sandbox', 'session', 'telemetry'] },
      { title: 'Chain of Custody Documentation', excerpt: 'Understand the chain of custody workflow from evidence collection through courtroom presentation.', category: 'blockchain', type: 'guide', readTime: '7 min', author: 'NyxTrace Team', tags: ['chain-of-custody', 'evidence', 'legal'] },
      { title: 'Platform API Reference', excerpt: 'Complete API documentation for integrating with NyxTrace programmatically.', category: 'platform', type: 'reference', readTime: '30 min', author: 'NyxTrace Team', tags: ['api', 'integration', 'reference'] },
    ];

    await KnowledgeArticle.insertMany(articles);
    logger.info(`Seeded ${articles.length} knowledge base articles`);
  }
}

export const knowledgeService = new KnowledgeService();
