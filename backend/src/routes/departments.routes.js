function sanitizeDepartment(department) {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    // DATE column -> plain YYYY-MM-DD string so clients never deal with
    // timezone-shifted midnight timestamps.
    revisionDate: department.revision_date ? department.revision_date.toISOString().slice(0, 10) : null,
    minCredits: department.min_credits ?? null,
    createdAt: department.created_at,
  };
}

async function departmentsRoutes(fastify, options) {
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    handler: async () => {
      const departments = await fastify.prisma.departments.findMany({ orderBy: { name: 'asc' } });
      return departments.map(sanitizeDepartment);
    },
  });

  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'code'],
        properties: {
          name: { type: 'string', minLength: 1 },
          code: { type: 'string', minLength: 1, maxLength: 10 },
        },
      },
    },
    handler: async (request, reply) => {
      const { name, code } = request.body;

      const existing = await fastify.prisma.departments.findUnique({ where: { code } });
      if (existing) {
        return reply.code(409).send({ message: 'A department with this code already exists.' });
      }

      const department = await fastify.prisma.departments.create({ data: { name, code } });
      return reply.code(201).send(sanitizeDepartment(department));
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
          code: { type: 'string', minLength: 1, maxLength: 10 },
          revisionDate: { type: ['string', 'null'], pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          minCredits: { type: ['integer', 'null'], minimum: 0 },
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const existingDepartment = await fastify.prisma.departments.findUnique({ where: { id } });
      if (!existingDepartment) {
        throw fastify.httpErrors.notFound('Department not found');
      }

      const data = {};
      if (request.body.name) data.name = request.body.name;
      if (request.body.code) data.code = request.body.code;
      if (request.body.revisionDate !== undefined) {
        data.revision_date = request.body.revisionDate ? new Date(`${request.body.revisionDate}T00:00:00Z`) : null;
      }
      if (request.body.minCredits !== undefined) {
        data.min_credits = request.body.minCredits;
      }

      const department = await fastify.prisma.departments.update({ where: { id }, data });
      return sanitizeDepartment(department);
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
      const existingDepartment = await fastify.prisma.departments.findUnique({ where: { id } });
      if (!existingDepartment) {
        throw fastify.httpErrors.notFound('Department not found');
      }
      await fastify.prisma.departments.delete({ where: { id } });
      return reply.code(204).send();
    },
  });
}

module.exports = departmentsRoutes;
