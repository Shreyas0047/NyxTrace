const { MongoMemoryServer } = require('mongodb-memory-server');
const fs = require('fs');
const path = require('path');

module.exports = async function globalSetup() {
  const mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  global.__MONGODB_SERVER__ = mongoServer;

  const configPath = path.join(__dirname, 'global-config.json');
  fs.writeFileSync(configPath, JSON.stringify({ uri }));
};
