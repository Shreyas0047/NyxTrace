import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../components/PublicLayout';

const features = [
  {
    title: 'Sandbox Analysis',
    description: 'Isolated VirtualBox environments for safe malware behavior simulation. Six educational simulators with real-time telemetry streaming.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Blockchain Evidence',
    description: 'Immutable evidence verification and chain of custody using blockchain technology. Every artifact timestamped and tamper-proof.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Forensic Analytics',
    description: 'MITRE ATT&CK mapping, behavioral analytics, and AI-powered threat classification for deep investigation insights.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Threat Intelligence',
    description: 'Real-time threat data aggregation and correlation across multiple intelligence feeds with actionable alerts.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Chain of Custody',
    description: 'Complete audit trail from evidence collection through analysis to courtroom presentation. Every handoff recorded.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    title: 'Live Telemetry',
    description: 'Real-time WebSocket streaming of sandbox events, system metrics, and forensic artifacts as they are generated.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
      </svg>
    ),
  },
];

const architectureSteps = [
  { label: 'Frontend', desc: 'React + TypeScript' },
  { label: 'Backend API', desc: 'Express.js + MongoDB' },
  { label: 'Sandbox Runtime', desc: 'FastAPI Python Agent' },
  { label: 'VirtualBox VM', desc: 'Windows 11 Sandbox' },
  { label: 'Blockchain', desc: 'Evidence Verification' },
];

export function DiscoverPage() {
  return (
    <PublicLayout>
      <div className="w-full max-w-4xl mt-[150px] mb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-20"
        >
          <div className="text-center space-y-4">
            <h1 className="text-[3rem] font-bold tracking-tight text-white">Discover NyxTrace</h1>
            <p className="text-xl text-white/50 font-light max-w-2xl mx-auto leading-relaxed">
              A comprehensive digital forensics platform combining sandbox analysis, blockchain
              verification, and AI-powered threat intelligence.
            </p>
          </div>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-white text-center">Key Features</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {features.map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.4 }}
                  className="border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white/80 group-hover:border-white/20 transition-all mb-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-white font-semibold mb-2 text-sm">{feature.title}</h3>
                  <p className="text-white/40 text-xs leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-2xl font-semibold text-white text-center">Architecture</h2>
            <div className="flex flex-col items-center gap-2">
              {architectureSteps.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.4 }}
                  className="flex items-center gap-4"
                >
                  <div className="flex items-center gap-3 border border-white/10 rounded-xl px-5 py-3 min-w-[280px] justify-between hover:border-white/20 transition-colors">
                    <span className="text-white/30 text-xs font-mono">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-white font-medium text-sm">{step.label}</span>
                    <span className="text-white/40 text-xs">{step.desc}</span>
                  </div>
                  {i < architectureSteps.length - 1 && (
                    <div className="hidden md:block text-white/10">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>

          <section className="text-center space-y-6 pb-8">
            <h2 className="text-2xl font-semibold text-white">Ready to Investigate?</h2>
            <p className="text-base text-white/50 max-w-md mx-auto">
              Sign in to your account or create a new identity to start exploring the platform.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                to="/login"
                className="px-8 py-3 rounded-full bg-white text-black font-medium hover:bg-white/90 transition-colors text-sm"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-8 py-3 rounded-full border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-all text-sm"
              >
                Create Account
              </Link>
            </div>
          </section>
        </motion.div>
      </div>
    </PublicLayout>
  );
}

export default DiscoverPage;
