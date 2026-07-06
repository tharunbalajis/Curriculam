const Fastify = require('fastify');
const cors = require('@fastify/cors');
const sensible = require('@fastify/sensible');
const env = require('@fastify/env');

const prismaPlugin = require('./plugins/prisma');
const authPlugin = require('./plugins/auth');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const departmentsRoutes = require('./routes/departments.routes');
const coursesRoutes = require('./routes/courses.routes');
const tasksRoutes = require('./routes/tasks.routes');
const adminRoutes = require('./routes/admin.routes');
const downloadsRoutes = require('./routes/downloads.routes');

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL', 'JWT_SECRET', 'FRONTEND_URL'],
  properties: {
    DATABASE_URL: { type: 'string' },
    JWT_SECRET: { type: 'string' },
    FRONTEND_URL: { type: 'string', default: 'http://localhost:5173' },
    PORT: { type: 'string', default: '5000' },
    SMTP_HOST: { type: 'string' },
    SMTP_PORT: { type: 'string' },
    SMTP_USER: { type: 'string' },
    SMTP_PASS: { type: 'string' },
  },
};

async function buildApp(opts = {}) {
  const fastify = Fastify({ logger: true, ...opts });

  await fastify.register(env, { schema: envSchema, dotenv: true });
  await fastify.register(cors, { origin: fastify.config.FRONTEND_URL, credentials: true });
  await fastify.register(sensible);
  await fastify.register(prismaPlugin);
  await fastify.register(authPlugin);

  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(usersRoutes, { prefix: '/api/users' });
  await fastify.register(departmentsRoutes, { prefix: '/api/departments' });
  await fastify.register(coursesRoutes, { prefix: '/api/courses' });
  await fastify.register(tasksRoutes, { prefix: '/api/tasks' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });
  await fastify.register(downloadsRoutes, { prefix: '/api/downloads' });

  fastify.get('/health', async () => ({ status: 'ok' }));

  return fastify;
}

module.exports = buildApp;
