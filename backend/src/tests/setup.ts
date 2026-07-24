/**
 * Test Setup — call connectTestDb in beforeAll, disconnect in afterAll,
 * clear collections after each test. Import this in test suites.
 */

import { connectTestDb, disconnectTestDb, clearCollections } from './db';

beforeAll(async () => {
  await connectTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

afterEach(async () => {
  await clearCollections();
});
