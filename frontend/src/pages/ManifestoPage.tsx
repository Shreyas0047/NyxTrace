import { motion } from 'framer-motion';
import { PublicLayout } from '../components/PublicLayout';

const team = [
  { name: 'Shreyas Gowda' },
  { name: 'Shreeshail Ramesh Kapse' },
];

const ethics = [
  'Educational use only — not offensive security tooling',
  'VM-only execution with marker validation',
  'Synthetic data only — no real PII or sensitive data',
  'Runtime limits and safe directory restrictions',
  'Automatic rollback on completion or failure',
  'Localhost-only networking',
  'Full transparency and chain of custody',
];

const principles = [
  { title: 'Security First', description: 'Defense in depth at every layer — from sandbox isolation to blockchain verification.' },
  { title: 'Transparency', description: 'Every action logged, every artifact chained, every result reproducible.' },
  { title: 'Reproducibility', description: 'Deterministic sandbox environments with clean-snapshot restoration.' },
  { title: 'Education Over Exploitation', description: 'Built for researchers and educators, not for offense.' },
];

export function ManifestoPage() {
  return (
    <PublicLayout>
      <div className="w-full max-w-3xl mt-[150px] mb-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="space-y-20"
        >
          <div className="text-center space-y-4">
            <h1 className="text-[3rem] font-bold tracking-tight text-white">Manifesto</h1>
            <p className="text-xl text-white/50 font-light max-w-xl mx-auto leading-relaxed">
              Philosophy, ethics, and principles behind the NyxTrace platform.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Mission</h2>
            <p className="text-base text-white/60 leading-relaxed">
              NyxTrace is an AI-powered cybercrime digital forensics platform with blockchain evidence
              verification. It provides educational malware behavior simulation and forensic analysis in
              controlled VirtualBox sandbox environments. Our mission is to equip researchers, educators,
              and cybersecurity professionals with the tools they need to understand malware tactics,
              techniques, and procedures — without crossing the line into offensive security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Ethics Pledge</h2>
            <div className="grid gap-3">
              {ethics.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 text-emerald-400 text-lg font-bold">✓</span>
                  <span className="text-white/60 text-base">{item}</span>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-white">Engineering Principles</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {principles.map((p, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
                >
                  <h3 className="text-white font-semibold mb-2">{p.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{p.description}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="space-y-6 text-center">
            <h2 className="text-2xl font-semibold text-white">Team</h2>
            <div className="flex flex-wrap justify-center gap-6">
              {team.map((member, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * i, duration: 0.4 }}
                  className="border border-white/10 rounded-2xl px-8 py-5 hover:border-white/20 transition-colors min-w-[200px]"
                >
                  <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-white/60 text-sm font-mono">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <p className="text-white font-medium text-sm">{member.name}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <div className="text-center pt-8 border-t border-white/5">
            <p className="text-white/30 text-xs">NyxTrace — Educational Digital Forensics Platform</p>
          </div>
        </motion.div>
      </div>
    </PublicLayout>
  );
}

export default ManifestoPage;
