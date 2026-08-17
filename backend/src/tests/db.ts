/**
 * Test DB helper — connects to mongodb-memory-server instance
 * started by global-setup.js and cleans collections between tests.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

export async function connectTestDb(): Promise<void> {
  const configPath = path.join(__dirname, 'global-config.json');
  const { uri } = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  // Each jest worker connects to its own database so parallel test files
  // never wipe each other's collections mid-test.
  await mongoose.connect(uri, { dbName: `nyxtrace-test-${process.pid}` });
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
}

export async function clearCollections(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
