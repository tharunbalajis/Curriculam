const bcrypt = require('bcryptjs');

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.department_id,
    createdAt: user.created_at,
  };
}

async function usersRoutes(fastify, options) {
  // GET /api/users?departmentId=&role= — top_admin sees everything (optionally
  // filtered), sub_admin is always scoped to their own department regardless
  // of any departmentId sent in the query string.
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          departmentId: { type: 'string' },
          role: { type: 'string', enum: ['top_admin', 'sub_admin', 'faculty'] },
        },
      },
    },
    handler: async (request) => {
      const where = {};

      if (request.user.role === 'sub_admin') {
        where.department_id = request.user.departmentId;
      } else if (request.query.departmentId) {
        where.department_id = request.query.departmentId;
      }

      if (request.query.role) {
        where.role = request.query.role;
      }

      const users = await fastify.prisma.users.findMany({ where, orderBy: { name: 'asc' } });
      return users.map(sanitizeUser);
    },
  });

  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password', 'role', 'departmentId'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          role: { type: 'string', enum: ['sub_admin', 'faculty'] },
          departmentId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const { name, email, password, role, departmentId } = request.body;

      const department = await fastify.prisma.departments.findUnique({ where: { id: departmentId } });
      if (!department) {
        throw fastify.httpErrors.badRequest('Department not found');
      }

      if (role === 'faculty') {
        const facultyCount = await fastify.prisma.users.count({
          where: { department_id: departmentId, role: 'faculty' },
        });
        if (facultyCount >= 2) {
          return reply.code(409).send({ message: 'This department already has 2 faculty members.' });
        }
      }

      if (role === 'sub_admin') {
        const existingSubAdmin = await fastify.prisma.users.findFirst({
          where: { department_id: departmentId, role: 'sub_admin' },
        });
        if (existingSubAdmin) {
          return reply.code(409).send({ message: 'This department already has a sub-admin.' });
        }
      }

      const existing = await fastify.prisma.users.findUnique({ where: { email } });
      if (existing) {
        return reply.code(409).send({ message: 'A user with this email already exists.' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await fastify.prisma.users.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          department_id: departmentId,
        },
      });

      return reply.code(201).send(sanitizeUser(user));
    },
  });

  fastify.put('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const existingUser = await fastify.prisma.users.findUnique({ where: { id } });
      if (!existingUser) {
        throw fastify.httpErrors.notFound('User not found');
      }

      const data = {};
      if (request.body.name) data.name = request.body.name;
      if (request.body.email) data.email = request.body.email;
      if (request.body.password) data.password = await bcrypt.hash(request.body.password, 10);

      const user = await fastify.prisma.users.update({ where: { id }, data });
      return sanitizeUser(user);
    },
  });

  fastify.delete('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const existingUser = await fastify.prisma.users.findUnique({ where: { id } });
      if (!existingUser) {
        throw fastify.httpErrors.notFound('User not found');
      }
      await fastify.prisma.users.delete({ where: { id } });
      return reply.code(204).send();
    },
  });
}

module.exports = usersRoutes;
