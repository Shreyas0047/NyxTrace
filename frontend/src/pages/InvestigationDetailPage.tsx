import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileText,
  Clock,
  AlertTriangle,
  Activity,
  Brain,
  MessageSquare,
  Upload,
  Shield,
  Eye,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import { DashboardCard } from '../components/enterprise/DashboardGrid';
import { useInvestigationStore } from '../stores/investigationStore';
import { useTimelineStore } from '../stores/timelineStore';
import { useAuthStore } from '../stores/authStore';
import { formatRelativeTime } from '../utils/helpers';
import { cn } from '../design-system';

type TabType = 'overview' | 'evidence' | 'timeline' | 'analysis' | 'notes';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

export function InvestigationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteType, setNoteType] = useState('observation');
  const [noteLoading, setNoteLoading] = useState(false);

  const { currentInvestigation, isLoading, error, fetchInvestigation, updateInvestigation } = useInvestigationStore();
  const { events, notes, setEvents, addNote } = useTimelineStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (id) {
      fetchInvestigation(id);
    }
  }, [id, fetchInvestigation]);

  useEffect(() => {
    setEvents([]);
  }, [id, setEvents]);

  const handleEscalate = useCallback(async () => {
    if (!currentInvestigation) return;
    await updateInvestigation(currentInvestigation.id, { priority: 'critical' });
    fetchInvestigation(currentInvestigation.id);
  }, [currentInvestigation, updateInvestigation, fetchInvestigation]);

  const handleAddNote = useCallback(async () => {
    if (!noteContent.trim()) return;
    setNoteLoading(true);
    try {
      await addNote({
        investigationId: id || '',
        content: noteContent.trim(),
        type: noteType as 'observation' | 'finding' | 'conclusion' | 'remediation' | 'escalation',
        createdBy: user?.id || 'unknown',
        createdByName: user?.name || 'Unknown',
      });
      setNoteContent('');
      setShowNoteModal(false);
    } finally {
      setNoteLoading(false);
    }
  }, [noteContent, noteType, id, addNote, user]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Eye },
    { id: 'evidence' as const, label: 'Evidence', icon: FileText },
    { id: 'timeline' as const, label: 'Timeline', icon: Clock },
    { id: 'analysis' as const, label: 'AI Analysis', icon: Brain },
    { id: 'notes' as const, label: 'Notes', icon: MessageSquare },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-secondary)] " />
      </div>
    );
  }

  if (!currentInvestigation) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
        <AlertTriangle className="w-12 h-12 mb-3 opacity-40" />
        <p className="text-lg font-medium">Investigation not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/investigations')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Investigations
        </Button>
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-4 mb-4">
        <button
          onClick={() => navigate('/investigations')}
          className="p-2 rounded-lg hover:bg-[var(--surface-container-low)]  transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)] " />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <p className="text-sm text-[var(--text-secondary)]  font-mono">{currentInvestigation.caseNumber}</p>
            <SeverityBadge severity={currentInvestigation.priority as any} size="sm" />
            <StatusBadge status={currentInvestigation.status} size="sm" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]  mt-1">{currentInvestigation.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEscalate}>
            <Shield className="w-4 h-4" />
            Escalate
          </Button>
          <Button size="sm">
            <Upload className="w-4 h-4" />
            Add Evidence
          </Button>
        </div>
      </motion.div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50  border border-red-200  rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <span className="text-sm text-red-700  ">{error}</span>
          <button onClick={() => id && fetchInvestigation(id)} className="ml-auto p-1 hover:bg-red-100  rounded">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      <motion.div variants={item} className="border-b border-[var(--border-subtle)] ">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600 '
                  : 'border-transparent text-[var(--text-secondary)]  hover:text-[var(--text-secondary)] '
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      <motion.div variants={item}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <DashboardCard>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]  mb-4">Investigation Details</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-[var(--text-secondary)]  mb-1">Description</p>
                    <p className="text-[var(--text-secondary)] ">{currentInvestigation.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]  mb-1">Category</p>
                      <span className="text-[var(--text-secondary)]  capitalize">{currentInvestigation.category}</span>
                    </div>
                    <div>
                      <p className="text-sm text-[var(--text-secondary)]  mb-1">Phase</p>
                      <span className="text-[var(--text-secondary)]  capitalize">{currentInvestigation.phase?.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentInvestigation.tags?.map((tag: string) => (
                      <span key={tag} className="px-2 py-1 text-xs bg-[var(--surface-container-low)]  text-[var(--text-secondary)]  rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </DashboardCard>

              <div className="grid grid-cols-3 gap-4">
                <DashboardCard>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-amber-600 " />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--text-primary)] ">{currentInvestigation.evidenceCount}</p>
                      <p className="text-sm text-[var(--text-secondary)] ">Evidence</p>
                    </div>
                  </div>
                </DashboardCard>
                <DashboardCard>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100  flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-violet-600  " />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--text-primary)] ">{currentInvestigation.alertCount}</p>
                      <p className="text-sm text-[var(--text-secondary)] ">Alerts</p>
                    </div>
                  </div>
                </DashboardCard>
                <DashboardCard>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100  flex items-center justify-center">
                      <Activity className="w-5 h-5 text-emerald-600  " />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-[var(--text-primary)] ">{events.length}</p>
                      <p className="text-sm text-[var(--text-secondary)] ">Events</p>
                    </div>
                  </div>
                </DashboardCard>
              </div>
            </div>

            <div className="space-y-6">
              <DashboardCard>
                <h3 className="font-semibold text-[var(--text-primary)]  mb-4">Team</h3>
                {currentInvestigation.assignedAnalysts && currentInvestigation.assignedAnalysts.length > 0 ? (
                  <div className="space-y-3">
                    {currentInvestigation.assignedAnalysts.map((analyst: any) => (
                      <div key={analyst.userId} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-violet-500 flex items-center justify-center text-white text-sm font-medium">
                          {analyst.user?.name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--text-secondary)] ">{analyst.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-[var(--text-secondary)]   capitalize">{analyst.role}</p>
                        </div>
                        {analyst.role === 'lead' && (
                          <StatusBadge status="active" size="sm" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] ">No analysts assigned</p>
                )}
              </DashboardCard>

              <DashboardCard>
                <h3 className="font-semibold text-[var(--text-primary)]  mb-4">Linked Alerts</h3>
                <p className="text-sm text-[var(--text-secondary)] ">Alerts will appear when linked to this investigation</p>
              </DashboardCard>

              <DashboardCard>
                <h3 className="font-semibold text-[var(--text-primary)]  mb-4">Timeline</h3>
                {events.length > 0 ? (
                  <div className="space-y-3">
                    {events.slice(0, 5).map((entry, index) => (
                      <div key={index} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-2 h-2 rounded-full bg-amber-500" />
                          {index < events.length - 1 && <div className="w-px h-full bg-[var(--surface-container)]  mt-1" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <p className="text-sm font-medium text-[var(--text-secondary)] ">{entry.type}</p>
                          <p className="text-xs text-[var(--text-secondary)]   mt-0.5">{formatRelativeTime(entry.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)] ">No timeline events yet</p>
                )}
              </DashboardCard>
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <DashboardCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] ">Evidence Items</h2>
              <Button size="sm">
                <Upload className="w-4 h-4" />
                Upload Evidence
              </Button>
            </div>
            <div className="p-6 text-center text-[var(--text-secondary)] ">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Evidence collected from sandbox sessions linked to this investigation will appear here</p>
            </div>
          </DashboardCard>
        )}

        {activeTab === 'timeline' && (
          <DashboardCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] ">Forensic Timeline</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">Filter</Button>
                <Button variant="outline" size="sm">Export</Button>
              </div>
            </div>
            {events.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-secondary)] ">
                <Clock className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No timeline events recorded yet</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {events.map((event, index) => {
                  const eventColors: Record<string, { bg: string; border: string }> = {
                    process: { bg: 'bg-blue-50 ', border: 'border-blue-200 ' },
                    file: { bg: 'bg-orange-50 ', border: 'border-orange-200 ' },
                    registry: { bg: 'bg-purple-50 ', border: 'border-purple-200 ' },
                    network: { bg: 'bg-red-50 ', border: 'border-red-200 ' },
                    module: { bg: 'bg-[var(--surface-container-lowest)] ', border: 'border-[var(--border-subtle)] ' },
                    behavior: { bg: 'bg-amber-50 ', border: 'border-amber-200 ' },
                    anomaly: { bg: 'bg-rose-50 ', border: 'border-rose-200 ' },
                  };
                  const colors = eventColors[event.type || 'process'] || eventColors.process;
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn('w-3 h-3 rounded-full border-2',
                          event.type === 'process' && 'border-blue-500 ',
                          event.type === 'file' && 'border-orange-500 ',
                          event.type === 'registry' && 'border-purple-500 ',
                          event.type === 'network' && 'border-red-500 ',
                          event.type === 'module' && 'border-slate-500 ',
                          event.type === 'behavior' && 'border-amber-500 ',
                          event.type === 'anomaly' && 'border-rose-500 '
                        )} />
                        {index < events.length - 1 && <div className="w-px h-16 bg-[var(--surface-container)]  mt-1" />}
                      </div>
                      <div className={cn('flex-1 p-4 rounded-xl border', colors.bg, colors.border)}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase text-[var(--text-secondary)] ">{event.type}</span>
                            <span className="text-xs text-[var(--text-secondary)]  ">{formatRelativeTime(event.timestamp)}</span>
                          </div>
                          {event.suspiciousScore && (
                            <SeverityBadge severity={event.suspiciousScore > 80 ? 'critical' : event.suspiciousScore > 60 ? 'high' : 'medium'} size="sm" />
                          )}
                        </div>
                        <pre className="text-sm text-[var(--text-secondary)]  whitespace-pre-wrap font-mono">
                          {JSON.stringify(event.details, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardCard>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <DashboardCard>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-violet-500 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] ">AI Threat Analysis</h2>
                  <p className="text-xs text-[var(--text-secondary)] ">Automated forensic intelligence</p>
                </div>
              </div>
              <div className="p-6 text-center text-[var(--text-secondary)] ">
                <Brain className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>Run an AI analysis from the AI Analysis page to generate threat intelligence for this investigation</p>
              </div>
            </DashboardCard>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] ">Analyst Notes</h2>
              <Button onClick={() => setShowNoteModal(true)}>
                <Plus className="w-4 h-4" />
                Add Note
              </Button>
            </div>

            {notes.length === 0 ? (
              <Card>
                <div className="p-6 text-center text-[var(--text-secondary)] ">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>No notes yet. Add your first analyst note.</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {notes.map((note) => {
                  const noteTypeStyles: Record<string, string> = {
                    observation: 'bg-blue-50  border-blue-200 ',
                    finding: 'bg-violet-50  border-violet-200 ',
                    conclusion: 'bg-emerald-50  border-emerald-200 ',
                    remediation: 'bg-amber-50  border-amber-200 ',
                    escalation: 'bg-red-50  border-red-200 ',
                  };
                  const style = noteTypeStyles[note.type] || noteTypeStyles.observation;

                  return (
                    <motion.div
                      key={note.id}
                      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
                      className={cn('p-4 rounded-xl border', style)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium uppercase text-[var(--text-secondary)] ">{note.type.replace('_', ' ')}</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">•</span>
                          <span className="text-xs text-[var(--text-secondary)]  ">{note.createdByName}</span>
                        </div>
                        <span className="text-xs text-[var(--text-secondary)]  ">{formatRelativeTime(note.createdAt)}</span>
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] ">{note.content}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNoteModal(false)}>
          <div className="bg-white  rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]  mb-4">Add Analyst Note</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)]  mb-1">Type</label>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)]  rounded-lg bg-white  text-[var(--text-primary)] "
                >
                  <option value="observation">Observation</option>
                  <option value="finding">Finding</option>
                  <option value="conclusion">Conclusion</option>
                  <option value="remediation">Remediation</option>
                  <option value="escalation">Escalation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)]  mb-1">Content</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-[var(--border-subtle)]  rounded-lg bg-white  text-[var(--text-primary)]  resize-none"
                  rows={4}
                  placeholder="Enter your note..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowNoteModal(false)}>Cancel</Button>
              <Button onClick={handleAddNote} disabled={!noteContent.trim() || noteLoading}>
                {noteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Note
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default InvestigationDetailPage;
