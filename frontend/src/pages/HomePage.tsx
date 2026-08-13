import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Cpu, Brain, Shield, FileText, ArrowRight, Fingerprint,
  AlertTriangle, Mail, Search, Activity, CheckCircle2,
} from 'lucide-react';
import { PageHeader } from '../layouts/PageContainer';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../design-system';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

const capabilities = [
  {
    icon: Cpu,
    title: 'Malware Sandboxing',
    description:
      'Suspicious files, URLs and documents are executed inside isolated VirtualBox environments. Every process, file and network action is captured in real time — without ever touching a real machine.',
    accent: 'text-amber-600 ',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Brain,
    title: 'AI Threat Analysis',
    description:
      'A purpose-built AI engine (Llama 3.2) classifies each sample, maps it to MITRE ATT&CK techniques, detects anomalies, scores severity and explains its verdict in plain language.',
    accent: 'text-violet-600 ',
    bg: 'bg-violet-500/10',
  },
  {
    icon: Shield,
    title: 'Blockchain-Verified Evidence',
    description:
      'Every evidence item is SHA-256 hashed and anchored to an Ethereum ledger. Any post-collection tampering is detected instantly — giving courts and investigators a verifiable chain of truth.',
    accent: 'text-emerald-600 ',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: FileText,
    title: 'Forensic Reports & Cases',
    description:
      'Automated forensic reports summarise what the malware did, why the AI classified it that way, and what evidence was collected — ready for case management and response.',
    accent: 'text-cyan-600 ',
    bg: 'bg-cyan-500/10',
  },
];

const story = [
  {
    icon: Mail,
    title: 'A suspicious email arrives',
    text: 'A victim receives an urgent email that looks like it came from their bank. It carries three artifacts: an .exe attachment, a URL link, and a document to open.',
  },
  {
    icon: AlertTriangle,
    title: 'The damage happens',
    text: 'The victim opens the attachment, clicks the link and views the document. Within hours their entire bank account is drained.',
  },
  {
    icon: Search,
    title: 'The forensics team takes over',
    text: 'The incident response team receives the three artifacts. They need to find out exactly what ran on the victim\u2019s machine — safely, without risking another infection.',
  },
  {
    icon: Cpu,
    title: 'NyxTrace examines each artifact',
    text: 'The .exe, URL and document are submitted to the sandbox. Each is executed in an isolated virtual machine while telemetry records every process, file and network activity.',
  },
  {
    icon: Brain,
    title: 'AI explains the threat',
    text: 'The AI engine classifies the malware, identifies the attack chain, scores the severity and states how confident it is — turning raw logs into a readable verdict.',
  },
  {
    icon: Shield,
    title: 'Evidence is locked in stone',
    text: 'All collected evidence is hashed and anchored to the blockchain. The team proves exactly what happened, when, and that nothing was altered — ready for the report and investigation.',
  },
];

const workflow = [
  { step: 'Submit the artifact', page: 'Sandbox', path: '/sandbox' },
  { step: 'Isolated execution', page: 'Sandbox', path: '/sandbox' },
  { step: 'Live telemetry capture', page: 'Telemetry', path: '/telemetry' },
  { step: 'AI classification & verdict', page: 'AI Analysis', path: '/ai-analysis' },
  { step: 'Evidence hashing & blockchain anchor', page: 'Evidence', path: '/evidence' },
  { step: 'Forensic report & investigation', page: 'Reports', path: '/reports' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="max-w-[1200px] mx-auto space-y-8 pb-8">
      <PageHeader
        title="Welcome to NyxTrace"
        subtitle="AI-powered cybercrime digital forensic platform"
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium bg-amber-500/15 text-amber-600  border border-amber-500/30">
            <Fingerprint className="w-3.5 h-3.5" />
            Blockchain-verified evidence
          </span>
        }
        actions={
          <Button variant="primary" size="md" onClick={() => navigate('/sandbox')} leftIcon={<ArrowRight className="w-4 h-4" />}>
            Open Sandbox
          </Button>
        }
      />

      {/* ─── What is NyxTrace ─── */}
      <motion.section variants={fadeUp}>
        <Card>
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]  tracking-tight">
              What is NyxTrace?
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]  max-w-3xl">
              NyxTrace is a complete digital forensics platform for investigating cybercrime. It takes
              suspicious files, URLs and documents, executes them safely inside isolated virtual machines,
              and uses AI to explain what they do — then cryptographically seals the evidence on a
              blockchain so it can stand up in a real investigation.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map(({ icon: Icon, title, description, accent, bg }) => (
                <div key={title} className="flex gap-3.5 p-4 rounded-xl bg-[var(--surface-container-lowest)]  border border-[var(--border-subtle)] ">
                  <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
                    <Icon className={cn('w-5 h-5', accent)} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] ">{title}</h3>
                    <p className="text-[13px] leading-relaxed mt-1 text-[var(--text-secondary)] ">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </motion.section>

      {/* ─── Use Case ─── */}
      <motion.section variants={fadeUp}>
        <Card variant="bordered">
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]  tracking-tight">
                A real-world scenario
              </h2>
              <p className="text-[14px] mt-1 text-[var(--text-secondary)] ">
                How a single phishing email leads to a full digital investigation — and how NyxTrace
                handles it from start to finish.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {story.map(({ icon: Icon, title, text }, i) => (
                <div
                  key={title}
                  className="relative p-4 rounded-xl bg-[var(--surface-container-lowest)]  border border-[var(--border-subtle)] "
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-[12px] font-semibold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <Icon className="w-4 h-4 text-[var(--text-secondary)] " />
                    <h3 className="text-[14px] font-semibold text-[var(--text-primary)] ">{title}</h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] ">{text}</p>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] ">
                <span className="font-semibold text-amber-600 ">The result:</span>{' '}
                The forensics team gets a complete, court-ready picture — what the malware did, how the
                AI classified it, which indicators to block, and blockchain-verified evidence that the
                findings were not tampered with. The victim's bank can be notified, the malicious URL
                can be taken down, and the attacker's infrastructure can be traced.
              </p>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* ─── Workflow ─── */}
      <motion.section variants={fadeUp}>
        <Card>
          <div className="space-y-5">
            <h2 className="font-display text-xl font-semibold text-[var(--text-primary)]  tracking-tight">
              The investigation workflow
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {workflow.map(({ step, page, path }, i) => (
                <button
                  key={step}
                  onClick={() => navigate(path)}
                  className="flex items-center gap-3 p-3.5 rounded-xl text-left border border-[var(--border-subtle)]  bg-[var(--surface-container-lowest)]  hover:border-amber-400  hover:bg-amber-500/5 transition-colors group"
                >
                  <span className="w-7 h-7 rounded-lg bg-[linear-gradient(135deg,#f59e0b,#b45309)] text-white text-[13px] font-semibold flex items-center justify-center flex-shrink-0 group-hover:opacity-90 transition-opacity">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)]  truncate">{step}</p>
                    <p className="text-[12px] text-amber-600  flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {page}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]  group-hover:text-amber-500 transition-colors flex-shrink-0" />
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button variant="primary" size="md" onClick={() => navigate('/ai-analysis')} leftIcon={<Brain className="w-4 h-4" />}>
                Analyze an Artifact
              </Button>
              <Button variant="outline" size="md" onClick={() => navigate('/evidence')} leftIcon={<Shield className="w-4 h-4" />}>
                Explore Evidence
              </Button>
              <Button variant="outline" size="md" onClick={() => navigate('/reports')} leftIcon={<FileText className="w-4 h-4" />}>
                View Reports
              </Button>
            </div>
          </div>
        </Card>
      </motion.section>

      {/* ─── Footer note ─── */}
      <motion.section variants={fadeUp}>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--surface-container-lowest)]  border border-[var(--border-subtle)] ">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] ">
            NyxTrace is built for researchers, educators and forensic professionals. All samples run in
            isolated virtual machines with synthetic data — nothing touches a real system, and every run
            is logged end-to-end for full transparency.
          </p>
        </div>
      </motion.section>
    </motion.div>
  );
}

export default HomePage;
