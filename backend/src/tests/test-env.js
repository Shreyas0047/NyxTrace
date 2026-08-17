/**
 * Jest setupFile — runs before every test suite in the same worker process.
 * Sets env vars so config module sees test values.
 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'global-config.json');
if (fs.existsSync(configPath)) {
  const { uri } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  if (uri) {
    process.env.MONGODB_URI = uri;
  }
}

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret';
process.env.NODE_ENV = 'test';
process.env.BLOCKCHAIN_ENABLED = 'false';
process.env.AI_SERVICE_ENABLED = 'false';
// Deterministic upload policy — overrides any local .env value.
process.env.ALLOWED_FILE_TYPES = '.json,.zip,.pdf,.log,.txt,.png,.jpg,.jpeg,.docx,.doc,.exe,.bin,.dll,.scr,.msi,.apk,.ps1,.vbs,.js,.py,.bat,.cmd,.csv,.eml,.msg,.pcap,.pcapng,.evtx,.reg,.dmp,.gz,.tar,.7z,.rar,.iso';
// Point AI calls at an unreachable port so LLM enhancement fails fast
// (ECONNREFUSED) instead of hitting a live local AI service in dev.
process.env.AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:1';
process.env.OTP_DEV_MODE = 'true';
process.env.OTP_TOKEN_SECRET = process.env.OTP_TOKEN_SECRET || 'test-otp-secret';

// Isolate test file storage away from the real uploads directory so test
// cleanup can never delete live demo/dev evidence files.
process.env.EVIDENCE_PATH = path.join(__dirname, '.test-uploads', 'evidence');
process.env.REPORTS_PATH = path.join(__dirname, '.test-uploads', 'reports');
process.env.SANDBOX_LOGS_PATH = path.join(__dirname, '.test-uploads', 'sandbox-logs');

// Ensure storage directories exist before multer/service code writes to them.
for (const dir of [process.env.EVIDENCE_PATH, process.env.REPORTS_PATH, process.env.SANDBOX_LOGS_PATH]) {
  if (dir) fs.mkdirSync(dir, { recursive: true });
}
