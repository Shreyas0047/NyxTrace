import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, BookOpen, FileText, Video, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '../layouts/PageContainer';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { cn } from '../design-system';
import api from '../services/api';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  type: 'guide' | 'reference' | 'tutorial';
  readTime: string;
  updatedAt: string;
}

const categories = [
  { id: 'all', label: 'All' },
  { id: 'forensics', label: 'Forensics' },
  { id: 'malware', label: 'Malware Analysis' },
  { id: 'blockchain', label: 'Blockchain' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'platform', label: 'Platform' },
];

const typeIcons = {
  guide: FileText,
  reference: BookOpen,
  tutorial: Video,
};

const typeColors: Record<string, string> = {
  guide: 'bg-amber-500/15 text-amber-400',
  reference: 'bg-violet-500/15 text-violet-400',
  tutorial: 'bg-emerald-500/15 text-emerald-400',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export function KnowledgeBasePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    loadArticles();
  }, []);

  const loadArticles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getKnowledgeArticles({ limit: 100 });
      if (res.success && res.data) {
        setArticles(Array.isArray(res.data) ? res.data : []);
      }
    } catch {
      setError('Failed to load knowledge base articles');
    } finally {
      setLoading(false);
    }
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.excerpt.toLowerCase().includes(search.toLowerCase());
    const matchCategory = activeCategory === 'all' || a.category === activeCategory;
    return matchSearch && matchCategory;
  });

  if (loading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="Knowledge Base" subtitle="Guides, references, and tutorials for the NyxTrace platform" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <PageHeader title="Knowledge Base" subtitle="Guides, references, and tutorials for the NyxTrace platform" />
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <AlertCircle className="w-12 h-12 mb-3 text-rose-400" />
            <p className="text-lg font-medium text-slate-300">Failed to load articles</p>
            <p className="text-sm mt-1">{error}</p>
            <button onClick={loadArticles} className="mt-4 px-4 py-2 text-sm bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors">Retry</button>
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        subtitle="Guides, references, and tutorials for the NyxTrace platform"
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                activeCategory === cat.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 border border-slate-700 hover:border-slate-500 hover:text-slate-200'
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <BookOpen className="w-12 h-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">No articles found</p>
            <p className="text-sm mt-1">Try a different search or category</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((article) => {
            const Icon = typeIcons[article.type];
            const colorClass = typeColors[article.type];
            return (
              <motion.div key={article.id} variants={item}>
                <Card hover className="cursor-pointer h-full">
                  <div className="p-5 flex flex-col h-full">
                    <div className="flex items-start gap-4">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', colorClass)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-100 text-sm mb-1">{article.title}</h3>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{article.excerpt}</p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 text-[10px] font-mono border border-slate-600 text-slate-400 rounded-full">{article.category}</span>
                        <span className="text-[10px] text-slate-500">{article.readTime}</span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export default KnowledgeBasePage;
