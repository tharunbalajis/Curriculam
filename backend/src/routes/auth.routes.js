const bcrypt = require('bcryptjs');

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.department_id,
  };
}

async function authRoutes(fastify, options) {
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
                departmentId: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { email, password } = request.body;

      const user = await fastify.prisma.users.findUnique({ where: { email } });
      if (!user) {
        throw fastify.httpErrors.unauthorized('Invalid credentials');
      }

      const passwordMatches = await bcrypt.compare(password, user.password);
      if (!passwordMatches) {
        throw fastify.httpErrors.unauthorized('Invalid credentials');
      }

      const token = fastify.jwt.sign(
        { id: user.id, role: user.role, departmentId: user.department_id, name: user.name },
        { expiresIn: '7d' }
      );

      return { token, user: sanitizeUser(user) };
    },
  });

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
    handler: async (request, reply) => {
      const user = await fastify.prisma.users.findUnique({ where: { id: request.user.id } });
      if (!user) {
        throw fastify.httpErrors.notFound('User not found');
      }
      return sanitizeUser(user);
    },
  });
}

module.exports = authRoutes;
