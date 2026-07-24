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
process.env.OTP_DEV_MODE = 'true';
process.env.OTP_TOKEN_SECRET = process.env.OTP_TOKEN_SECRET || 'test-otp-secret';
