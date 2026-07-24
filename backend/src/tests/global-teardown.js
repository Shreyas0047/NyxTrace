module.exports = async function globalTeardown() {
  if (global.__MONGODB_SERVER__) {
    await global.__MONGODB_SERVER__.stop();
  }
};
