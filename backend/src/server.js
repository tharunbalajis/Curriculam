const buildApp = require('./app');

async function start() {
  const app = await buildApp();

  try {
    const port = Number(app.config.PORT) || 5000;
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
