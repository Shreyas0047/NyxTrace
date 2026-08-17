import { useEffect, useRef, useState } from 'react';
import {
  FileCode,
  FileText,
  Globe,
  Upload,
  Loader2,
  FolderInput,
  Link2,
  AlertTriangle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useEvidenceStore } from '../../stores/evidenceStore';
import { useInvestigationStore } from '../../stores/investigationStore';
import { useStatusStore } from '../../stores/statusStore';
import api from '../../services/api';
import { cn } from '../../design-system';
import { DOCUMENT_SAMPLES, URL_SAMPLES, type DocumentSample, type UrlSample } from '../../data/demo-samples';

type ArtifactKind = 'executable' | 'document' | 'url';

const KIND_ORDER: ArtifactKind[] = ['executable', 'document', 'url'];

interface SimulatorOption {
  id: string;
  display_name: string;
  description: string;
}

interface KindDraft {
  file: File | null;
  sampleId: string;
  url: string;
  name: string;
  description: string;
  simulatorHint: string;
}

const emptyDraft = (): KindDraft => ({ file: null, sampleId: '', url: '', name: '', description: '', simulatorHint: '' });

interface EvidenceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
}

const kindMeta: Record<ArtifactKind, { label: string; hint: string; icon: typeof FileCode }> = {
  executable: {
    label: 'Executable',
    hint: 'Malware sample / binary to detonate in the sandbox',
    icon: FileCode,
  },
  document: {
    label: 'Document',
    hint: 'PDF or DOCX to run static + AI analysis on',
    icon: FileText,
  },
  url: {
    label: 'URL',
    hint: 'Indicators or payload URL to hash and analyze',
    icon: Globe,
  },
};

export function EvidenceUploadModal({ isOpen, onClose, onUploaded }: EvidenceUploadModalProps) {
  const uploadEvidence = useEvidenceStore((s) => s.uploadEvidence);
  const registerUrlEvidence = useEvidenceStore((s) => s.registerUrlEvidence);
  const investigations = useInvestigationStore((s) => s.investigations);
  const investigationsError = useInvestigationStore((s) => s.error);
  const fetchInvestigations = useInvestigationStore((s) => s.fetchInvestigations);
  const showStatus = useStatusStore((s) => s.show);

  const [kind, setKind] = useState<ArtifactKind>('executable');
  const [drafts, setDrafts] = useState<Record<ArtifactKind, KindDraft>>({
    executable: emptyDraft(),
    document: emptyDraft(),
    url: emptyDraft(),
  });
  const [registered, setRegistered] = useState<Record<ArtifactKind, boolean>>({
    executable: false,
    document: false,
    url: false,
  });
  const [investigationId, setInvestigationId] = useState('');
  const [simulatorHint, setSimulatorHint] = useState('');
  const [sampleId, setSampleId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [simulators, setSimulators] = useState<SimulatorOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const samples = kind === 'document' ? DOCUMENT_SAMPLES : kind === 'url' ? URL_SAMPLES : [];
  const selectedSample = samples.find((s) => s.id === sampleId) || null;
  const selectedDocSample = kind === 'document' && selectedSample ? (selectedSample as DocumentSample) : null;
  const selectedUrlSample = kind === 'url' && selectedSample ? (selectedSample as UrlSample) : null;

  useEffect(() => {
    if (isOpen) {
      if (investigations.length === 0) fetchInvestigations({ page: 1, limit: 100 });
      if (investigations.length === 1 && !investigationId) {
        setInvestigationId(investigations[0].id);
      }
      api
        .getSandboxSimulators()
        .then((res) => {
          if (res.success && res.data?.simulators) {
            setSimulators(
              res.data.simulators.map((s) => ({
                id: s.id,
                display_name: s.display_name,
                description: s.description,
              }))
            );
          }
        })
        .catch(() => setSimulators([]));
    }
  }, [isOpen, investigations.length, fetchInvestigations]);

  const reset = () => {
    setKind('executable');
    setInvestigationId('');
    setDrafts({ executable: emptyDraft(), document: emptyDraft(), url: emptyDraft() });
    setRegistered({ executable: false, document: false, url: false });
    setSimulatorHint('');
    setSampleId('');
    setFile(null);
    setUrl('');
    setName('');
    setDescription('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleKindSwitch = (k: ArtifactKind) => {
    if (k === kind) return;
    setDrafts((prev) => ({
      ...prev,
      [kind]: { file, sampleId, url, name, description, simulatorHint },
    }));
    const draft = drafts[k];
    setFile(draft.file);
    setSampleId(draft.sampleId);
    setUrl(draft.url);
    setName(draft.name);
    setDescription(draft.description);
    setSimulatorHint(draft.simulatorHint);
    setKind(k);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (f: File | null) => {
    setFile(f);
    setSampleId('');
    if (f && !name) setName(f.name);
  };

  const handleSampleChange = (id: string) => {
    const sample = samples.find((s) => s.id === id) || null;
    setSampleId(id);
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (sample) {
      setName(sample.name);
      setDescription(sample.description);
      setSimulatorHint('');
      if (kind === 'url' && 'url' in sample) setUrl(sample.url);
    } else {
      setUrl('');
      setSimulatorHint('');
    }
  };

  const draftFor = (k: ArtifactKind): KindDraft =>
    k === kind ? { file, sampleId, url, name, description, simulatorHint } : drafts[k];

  const kindValid = (k: ArtifactKind): boolean => {
    const d = draftFor(k);
    if (k === 'url') return d.url.trim().length > 0;
    if (k === 'document') return !!d.file || !!d.sampleId;
    return !!d.file;
  };

  const pendingKinds = KIND_ORDER.filter((k) => !registered[k]);
  const allPendingValid = pendingKinds.length > 0 && pendingKinds.every((k) => kindValid(k));
  const submitEnabled = !!investigationId && allPendingValid;
  const pendingCount = pendingKinds.length;

  const blockerText: string | null = (() => {
    if (pendingKinds.length === 0) return 'All artifacts already registered — nothing left to submit';
    if (!investigationId) return 'Select an investigation to enable registration';
    const missing = pendingKinds.filter((k) => !kindValid(k));
    if (missing.length > 0) return `Fill ${missing.map((k) => kindMeta[k].label).join(' and ')} to enable registration`;
    return null;
  })();

  const readinessLine = KIND_ORDER.map((k) => {
    const ok = registered[k] || kindValid(k);
    return `${kindMeta[k].label} ${ok ? '✓' : '—'}`;
  }).join(' · ');

  const retryInvestigations = () => fetchInvestigations({ page: 1, limit: 100 });

  const resolveUploadFileFor = async (d: KindDraft): Promise<File> => {
    if (d.file) return d.file;
    if (d.sampleId) {
      const sample = DOCUMENT_SAMPLES.find((s) => s.id === d.sampleId);
      if (sample) {
        const res = await fetch(`${import.meta.env.BASE_URL}samples/${sample.file}`);
        if (!res.ok) throw new Error('Could not load sample file from the sample library');
        const blob = await res.blob();
        return new File([blob], sample.file, { type: blob.type || 'application/octet-stream' });
      }
    }
    throw new Error('No file selected');
  };

  const submitKind = async (k: ArtifactKind): Promise<void> => {
    const d = draftFor(k);
    if (k === 'url') {
      await registerUrlEvidence({
        investigationId,
        url: d.url.trim(),
        name: d.name.trim() || d.url.trim(),
        description: d.description.trim(),
      });
      return;
    }
    const uploadFile = await resolveUploadFileFor(d);
    const formData = new FormData();
    formData.append('investigationId', investigationId);
    formData.append('name', d.name.trim() || uploadFile.name);
    formData.append('description', d.description.trim());
    formData.append('type', k);
    if (k === 'executable' && d.simulatorHint) formData.append('simulatorHint', d.simulatorHint);
    formData.append('file', uploadFile);
    await uploadEvidence(formData);
  };

  const handleSubmit = async () => {
    if (!submitEnabled || submitting) return;
    setSubmitting(true);
    const attempted: ArtifactKind[] = [];
    try {
      for (const k of pendingKinds) {
        try {
          await submitKind(k);
          attempted.push(k);
          setRegistered((prev) => ({ ...prev, [k]: true }));
        } catch (error) {
          showStatus(
            'error',
            `${kindMeta[k].label} registration failed`,
            error instanceof Error ? error.message : 'Could not register evidence',
            8000
          );
          return;
        }
      }
      showStatus(
        'success',
        'Evidence registered',
        `${attempted.length} artifact${attempted.length === 1 ? '' : 's'} (${attempted
          .map((k) => kindMeta[k].label)
          .join(', ')}) registered under ${investigationId}.`,
        6000
      );
      handleClose();
      onUploaded?.();
    } finally {
      setSubmitting(false);
    }
  };

  const kindStatusDot = (k: ArtifactKind): string => {
    if (registered[k]) return 'bg-emerald-500';
    if (kindValid(k)) return 'bg-amber-500';
    return 'bg-[var(--border-default)]';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Register Evidence" size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)] mb-2">
            Artifact kind
            <span className="ml-2 text-xs text-[var(--text-tertiary)]">
              {pendingCount > 0 ? `${pendingCount}/3 to register` : 'All registered'}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            {KIND_ORDER.map((k) => {
              const meta = kindMeta[k];
              const Icon = meta.icon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => handleKindSwitch(k)}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all',
                    kind === k
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-600'
                      : 'border-[var(--border-default)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:bg-[var(--surface-container)]'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-2 right-2 w-1.5 h-1.5 rounded-full',
                      kindStatusDot(k),
                      registered[k] && 'shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                    )}
                    title={registered[k] ? 'Registered' : kindValid(k) ? 'Details ready' : 'Not filled'}
                  />
                  <Icon className="w-5 h-5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--text-tertiary)]">
            {kindMeta[kind].hint}
            {registered[kind] && ' — registered'}
          </p>
        </div>

        {kind !== 'executable' && (
          <Select
            label="Sample library (optional)"
            value={sampleId}
            onChange={handleSampleChange}
            placeholder="Custom artifact — no sample"
            options={samples.map((s) => ({ value: s.id, label: s.name }))}
            helperText={
              kind === 'document'
                ? 'Bundled demo document tuned for the static + AI analysis engine (file is fetched on submit).'
                : 'Curated indicator URLs tuned for the URL analysis engine.'
            }
            fullWidth
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {investigations.length === 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Investigation</span>
              {investigationsError ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] border border-rose-500/40 bg-rose-500/5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                  <span className="flex-1 text-xs text-rose-600">{investigationsError}</span>
                  <button
                    type="button"
                    onClick={retryInvestigations}
                    className="px-2 py-1 text-xs font-medium rounded-md border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="px-3 py-2 rounded-[10px] border border-[var(--border-default)] text-xs text-[var(--text-tertiary)]">
                  Loading investigations…
                </div>
              )}
            </div>
          ) : (
            <Select
              label="Investigation"
              value={investigationId}
              onChange={setInvestigationId}
              placeholder="Select investigation"
              options={investigations.map((inv) => ({
                value: inv.id,
                label: inv.title,
              }))}
              error={!investigationId && allPendingValid ? 'Required — select an investigation to enable registration' : undefined}
              fullWidth
            />
          )}

          {kind === 'url' ? (
            <Input
              label="Target URL"
              placeholder="https://example.com/payload"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              leftIcon={<Link2 className="w-4 h-4" />}
              disabled={!!selectedUrlSample}
              fullWidth
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--text-secondary)]">File</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!!selectedDocSample}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-[10px] border border-dashed text-sm transition-all',
                  file || selectedDocSample
                    ? 'border-amber-500/50 bg-amber-500/5 text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-amber-500/40',
                  selectedDocSample && 'cursor-default'
                )}
              >
                {file || selectedDocSample ? <FileCode className="w-4 h-4 text-amber-600" /> : <FolderInput className="w-4 h-4" />}
                <span className="truncate">
                  {selectedDocSample && !file
                    ? `${selectedDocSample.file} (sample library)`
                    : file
                      ? file.name
                      : 'Choose file…'}
                </span>
                {file && <span className="ml-auto text-xs text-[var(--text-tertiary)]">{formatSize(file.size)}</span>}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </div>
          )}
        </div>

        {kind === 'executable' && (
          <Select
            label="Preferred sample (optional)"
            value={simulatorHint}
            onChange={setSimulatorHint}
            placeholder="Let the system pick"
            options={simulators.map((s) => ({ value: s.id, label: s.display_name }))}
            helperText="Used to auto-select the sandbox simulator when this artifact is analyzed."
            fullWidth
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name"
            placeholder={kind === 'url' ? 'Indicator name' : 'Evidence name'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <Input
            label="Description"
            placeholder="Optional context…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
          />
        </div>

        <div className="flex items-end justify-between gap-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="space-y-1 min-w-0">
            <p className={cn('text-xs font-medium', blockerText ? 'text-amber-600' : 'text-emerald-600')}>
              {blockerText ?? 'Ready to register'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] font-mono">{readinessLine}</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!submitEnabled || submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {submitting
                ? 'Registering…'
                : pendingCount > 0
                  ? `Upload & Register (${pendingCount}/3)`
                  : 'Upload & Register'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default EvidenceUploadModal;