#!/usr/bin/env tsx
import { Command } from 'commander';
import chalk from 'chalk';
import figlet from 'figlet';
import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, createWriteStream, openSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import * as readline from 'readline';

const IS_WIN = process.platform === 'win32';
const ROOT_DIR = resolve(import.meta.dirname ?? dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = join(ROOT_DIR, 'logs');
const PIDS_FILE = join(LOG_DIR, '.pids.json');

interface ServiceConfig {
  name: string;
  displayName: string;
  cwd: string;
  command: string;
  args: string[];
  healthUrl: string;
  healthMethod?: 'GET' | 'POST';
  healthBody?: string;
  healthHeaders?: Record<string, string>;
  env?: Record<string, string>;
  shell?: boolean;
  postStart?: () => Promise<void>;
}

interface PidEntry {
  name: string;
  pid: number;
  startedAt: string;
}

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const SERVICES: ServiceConfig[] = [
  {
    name: 'blockchain',
    displayName: 'Blockchain',
    cwd: 'blockchain',
    command: 'npx',
    args: ['hardhat', 'node'],
    healthUrl: 'http://127.0.0.1:8545',
    healthMethod: 'POST',
    healthBody: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    healthHeaders: { 'Content-Type': 'application/json' },
    postStart: async () => {
      const cwd = join(ROOT_DIR, 'blockchain');
      if (!existsSync(join(cwd, 'node_modules'))) {
        execSync('npm install --silent', { cwd, stdio: 'ignore' });
      }
      execSync('npx hardhat run scripts/deploy.ts --network localhost', { cwd, stdio: 'ignore' });
    },
  },
  {
    name: 'backend',
    displayName: 'Backend',
    cwd: 'backend',
    command: 'npm',
    args: ['run', 'dev'],
    healthUrl: 'http://localhost:3000/api/v1/operations/live',
  },
  {
    name: 'ollama',
    displayName: 'Ollama',
    cwd: '.',
    command: 'ollama',
    args: ['serve'],
    healthUrl: 'http://localhost:11434/api/tags',
  },
  {
    name: 'ai-service',
    displayName: 'AI Service',
    cwd: 'ai-service',
    command: IS_WIN
      ? join(ROOT_DIR, 'ai-service', '.venv', 'Scripts', 'python.exe')
      : join(ROOT_DIR, 'ai-service', '.venv', 'bin', 'python'),
    args: ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', '8000'],
    healthUrl: 'http://localhost:8000/health',
    env: {},
  },
  {
    name: 'sandbox',
    displayName: 'Sandbox Agent',
    cwd: 'sandbox-agent-v2',
    command: IS_WIN ? 'python' : 'python3',
    args: ['main.py'],
    healthUrl: 'http://127.0.0.1:8765/health',
  },
  {
    name: 'frontend',
    displayName: 'Frontend',
    cwd: 'frontend',
    command: 'npm',
    args: ['run', 'dev'],
    healthUrl: 'http://localhost:5173',
  },
];

function readPids(): PidEntry[] {
  try {
    return JSON.parse(readFileSync(PIDS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function savePids(entries: PidEntry[]): void {
  writeFileSync(PIDS_FILE, JSON.stringify(entries, null, 2));
}

function addPid(name: string, pid: number): void {
  const pids = readPids().filter((p) => p.name !== name);
  pids.push({ name, pid, startedAt: new Date().toISOString() });
  savePids(pids);
}

function getRunningNames(): string[] {
  const pids = readPids();
  const alive = pids.filter((p) => {
    try {
      process.kill(p.pid, 0);
      return true;
    } catch {
      return false;
    }
  });
  if (alive.length !== pids.length) savePids(alive);
  return alive.map((p) => p.name);
}

function healthCheck(service: ServiceConfig, timeout = 5000): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const url = new URL(service.healthUrl);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: service.healthMethod || 'GET',
      timeout,
      headers: service.healthHeaders || {},
    };

    const req = http.request(options, (res) => {
      resolvePromise(res.statusCode !== undefined && res.statusCode < 500);
    });

    req.on('error', () => resolvePromise(false));
    req.on('timeout', () => { req.destroy(); resolvePromise(false); });

    if (service.healthBody) req.write(service.healthBody);
    req.end();
  });
}

async function waitForHealth(service: ServiceConfig, label: string, maxWait = 30): Promise<boolean> {
  process.stdout.write(`  ${chalk.dim('Waiting for')} ${label}${chalk.dim('...')}`);
  for (let i = 0; i < maxWait; i++) {
    const ok = await healthCheck(service);
    if (ok) {
      process.stdout.write(` ${chalk.green('✓')}\n`);
      return true;
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write(` ${chalk.red('✗')}\n`);
  return false;
}

function timestamp(): string {
  const d = new Date();
  return d.toLocaleTimeString('en-US', { hour12: false });
}

function log(label: string, msg: string): void {
  console.log(`  ${chalk.dim(`[${timestamp()}]`)} ${chalk.cyan(label.padEnd(16))} ${msg}`);
}

function showBanner(): void {
  console.clear();
  console.log(chalk.hex('#00d4ff')(figlet.textSync('NyxTrace', { font: 'ANSI Shadow' })));
  console.log(chalk.gray('  AI-powered digital forensics platform'));
  console.log();
}

async function stopProcess(pid: number, label: string): Promise<void> {
  if (IS_WIN) {
    try {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
      log(label, chalk.green('stopped'));
      return;
    } catch {
      // PID already gone — fall through to the signal-based path
    }
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    return;
  }
  for (let i = 0; i < 20; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      log(label, chalk.green('stopped'));
      return;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  try {
    process.kill(pid, 'SIGKILL');
    log(label, chalk.yellow('force killed'));
  } catch {
    log(label, chalk.yellow('not running'));
  }
}

// ─── START ─────────────────────────────────────────────────────────────
async function startServices(skip: string[]): Promise<void> {
  showBanner();
  const running = getRunningNames();

  const toStart = SERVICES.filter(
    (s) => !skip.includes(s.name) && !running.includes(s.name)
  );
  const alreadyRunning = SERVICES.filter((s) => running.includes(s.name));

  if (alreadyRunning.length > 0) {
    console.log(chalk.yellow(`  ${alreadyRunning.length} service(s) already running (skipping):`));
    alreadyRunning.forEach((s) => console.log(`    ${chalk.green('●')} ${s.displayName}`));
    console.log();
  }

  if (toStart.length === 0) {
    console.log(chalk.green('  All services are already running.\n'));
    return;
  }

  for (const service of toStart) {
    log(service.displayName, chalk.dim('starting...'));

    const cwd = join(ROOT_DIR, service.cwd);
    const logFile = join(LOG_DIR, `${service.name}.log`);
    const logFd = openSync(logFile, 'a');

    const env: Record<string, string> = { ...process.env };
    if (service.env) Object.assign(env, service.env);
    if (service.name === 'ai-service') {
      const ollamaRunning = getRunningNames().includes('ollama');
      env.AI_LLM_ENABLED = ollamaRunning ? 'true' : 'false';
      env.AI_LLM_PRIMARY_PATH = ollamaRunning ? 'true' : 'false';
    }

    const child = spawn(service.command, service.args, {
      cwd,
      stdio: ['ignore', logFd, logFd],
      detached: true,
      env,
      shell: service.shell ?? true,
    });

    child.unref();
    addPid(service.name, child.pid!);

    const ready = await waitForHealth(service, service.displayName);
    if (ready) {
      log(service.displayName, chalk.green('ready'));
      if (service.postStart) {
        try {
          await service.postStart();
          log(service.displayName, chalk.dim('post-start hook completed'));
        } catch {
          log(service.displayName, chalk.yellow('post-start hook skipped'));
        }
      }
    } else {
      log(service.displayName, chalk.red('health check timed out'));
    }
    console.log();
  }

  printSummary();
}

function printSummary(): void {
  console.log(chalk.dim('  ─────────────────────────────────────────────'));
  const pids = readPids();
  for (const service of SERVICES) {
    const running = pids.some((p) => p.name === service.name);
    const status = running ? chalk.green('● Running') : chalk.red('○ Stopped');
    console.log(`  ${status}  ${chalk.bold(service.displayName.padEnd(16))} ${chalk.dim(service.healthUrl)}`);
  }
  console.log(chalk.dim('  ─────────────────────────────────────────────'));
  console.log();
}

// ─── CHECK ─────────────────────────────────────────────────────────────
async function checkServices(): Promise<void> {
  showBanner();
  console.log(chalk.bold('  Running health checks...\n'));

  let allOk = true;
  const pids = readPids();
  const runningNames = new Set(pids.map((p) => p.name));

  for (const service of SERVICES) {
    const pidEntry = pids.find((p) => p.name === service.name);

    process.stdout.write(`  ${chalk.bold(service.displayName.padEnd(16))} `);

    if (!runningNames.has(service.name)) {
      console.log(chalk.red('○ Not started'));
      allOk = false;
      continue;
    }

    const alive = await healthCheck(service);
    if (alive) {
      console.log(`${chalk.green('● Healthy')}    ${chalk.dim(`PID ${pidEntry!.pid}`)}`);
    } else {
      console.log(`${chalk.red('✗ Unhealthy')}  ${chalk.dim(`PID ${pidEntry!.pid}`)}`);
      allOk = false;
    }
  }

  console.log();
  if (allOk) {
    console.log(chalk.green('  All services are healthy.\n'));
  } else {
    console.log(chalk.yellow('  Some services need attention. Run start to fix.\n'));
  }
}

// ─── STOP ──────────────────────────────────────────────────────────────
async function stopServices(): Promise<void> {
  showBanner();
  const pids = readPids();

  if (pids.length === 0) {
    console.log(chalk.yellow('  No services are currently running.\n'));
    return;
  }

  console.log(chalk.bold('  Stopping all services...\n'));

  for (const entry of pids) {
    const service = SERVICES.find((s) => s.name === entry.name);
    const label = service?.displayName || entry.name;
    log(label, chalk.dim(`PID ${entry.pid}`));
    await stopProcess(entry.pid, label);
  }

  if (existsSync(PIDS_FILE)) unlinkSync(PIDS_FILE);
  console.log(chalk.green('\n  All services stopped.\n'));
}

// ─── INTERACTIVE MENU ──────────────────────────────────────────────────
function interactiveMenu(): void {
  showBanner();
  const pids = readPids();
  const runningCount = pids.length;

  console.log(`  ${chalk.bold('Services:')}  ${runningCount > 0 ? chalk.green(`${runningCount} running`) : chalk.red('none running')}`);
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  console.log(`  ${chalk.cyan('1.')}  Start all services`);
  console.log(`  ${chalk.cyan('2.')}  Check service health`);
  console.log(`  ${chalk.cyan('3.')}  Stop all services`);
  console.log(`  ${chalk.cyan('4.')}  Exit`);
  console.log();

  rl.question(chalk.dim('  Select option [1-4]: '), async (answer) => {
    rl.close();
    switch (answer.trim()) {
      case '1':
        await startServices([]);
        await pressAnyKey();
        interactiveMenu();
        break;
      case '2':
        await checkServices();
        await pressAnyKey();
        interactiveMenu();
        break;
      case '3':
        await stopServices();
        await pressAnyKey();
        interactiveMenu();
        break;
      case '4':
        console.log(chalk.dim('\n  Goodbye.\n'));
        process.exit(0);
      default:
        interactiveMenu();
    }
  });
}

function pressAnyKey(): Promise<void> {
  return new Promise((resolvePromise) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(chalk.dim('  Press Enter to continue...'), () => {
      rl.close();
      resolvePromise();
    });
  });
}

// ─── CLI ───────────────────────────────────────────────────────────────
const program = new Command();

program
  .name('nytx')
  .description('NyxTrace service orchestrator — start, check, and stop all services')
  .version('2.0.0');

program
  .command('start')
  .description('Start all NyxTrace services')
  .option('--skip <services>', 'Skip specific services (comma-separated, e.g. blockchain,sandbox)', '')
  .action(async (options) => {
    const skip = options.skip ? options.skip.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    await startServices(skip);
    if (process.stdout.isTTY) await pressAnyKey();
  });

program
  .command('check')
  .description('Check health of all services')
  .action(async () => {
    await checkServices();
    if (process.stdout.isTTY) await pressAnyKey();
  });

program
  .command('stop')
  .description('Stop all running services')
  .action(async () => {
    await stopServices();
    if (process.stdout.isTTY) await pressAnyKey();
  });

if (process.argv.length <= 2) {
  interactiveMenu();
} else {
  program.parse(process.argv);
}
