import mongoose, { Schema } from 'mongoose';

const knowledgeArticleSchema = new Schema({
  title: { type: String, required: true, trim: true },
  excerpt: { type: String, required: true, trim: true },
  content: { type: String, default: '' },
  category: { type: String, required: true, enum: ['forensics', 'malware', 'blockchain', 'sandbox', 'platform'] },
  type: { type: String, required: true, enum: ['guide', 'reference', 'tutorial'] },
  readTime: { type: String, required: true },
  published: { type: Boolean, default: true },
  author: { type: String, default: '' },
  tags: [{ type: String }],
}, {
  timestamps: true,
  toJSON: {
    transform: (doc: any, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
});

knowledgeArticleSchema.index({ category: 1, published: 1 });
knowledgeArticleSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

export const KnowledgeArticle = mongoose.model('KnowledgeArticle', knowledgeArticleSchema);
export default KnowledgeArticle;
