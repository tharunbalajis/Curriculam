const emailService = require('../services/email.service');
const { resolveCourseStatus } = require('../services/courseStatus.service');

function sanitizeTask(task) {
  return {
    id: task.id,
    status: task.status,
    deadline: task.deadline,
    accessToken: task.access_token,
    revisionNotes: task.revision_notes,
    submittedAt: task.submitted_at,
    approvedAt: task.approved_at,
    approvedBy: task.approved_by,
    createdAt: task.created_at,
    courseId: task.course_id,
    departmentId: task.department_id,
    course: task.course ? { id: task.course.id, courseCode: task.course.course_code, courseTitle: task.course.course_title } : undefined,
    department: task.department ? { id: task.department.id, name: task.department.name, code: task.department.code } : undefined,
    faculty: task.assigned_to_user
      ? { id: task.assigned_to_user.id, name: task.assigned_to_user.name, email: task.assigned_to_user.email }
      : undefined,
  };
}

async function adminRoutes(fastify, options) {
  fastify.get('/dashboard', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    handler: async () => {
      const departments = await fastify.prisma.departments.findMany({
        include: { courses: true, tasks: true },
        orderBy: { name: 'asc' },
      });

      return departments.map((department) => {
        const hasTasks = department.tasks.length > 0;
        const allApproved = hasTasks && department.tasks.every((t) => t.status === 'approved');
        return {
          id: department.id,
          name: department.name,
          code: department.code,
          totalCourses: department.courses.length,
          status: allApproved ? 'green' : 'red',
        };
      });
    },
  });

  // GET /api/admin/departments/:id/courses — semester-by-semester breakdown
  // for the dashboard accordion. A course's displayed status collapses the
  // 'assigned'/'in_progress' task states into 'pending' (no task at all is
  // also 'pending') since the dashboard only distinguishes the four states
  // the prompt asked for: pending / submitted / approved / rejected.
  fastify.get('/departments/:id/courses', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    handler: async (request) => {
      const department = await fastify.prisma.departments.findUnique({ where: { id: request.params.id } });
      if (!department) throw fastify.httpErrors.notFound('Department not found');

      const courses = await fastify.prisma.courses.findMany({
        where: { department_id: request.params.id },
        include: {
          tasks: { include: { assigned_to_user: true }, orderBy: { created_at: 'desc' }, take: 1 },
        },
        orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
      });

      const semesters = Array.from({ length: 8 }, (_, i) => ({ semester: i + 1, courses: [] }));

      for (const course of courses) {
        const semesterIndex = (course.semester || 1) - 1;
        if (semesterIndex < 0 || semesterIndex > 7) continue;

        const latestTask = course.tasks[0];

        semesters[semesterIndex].courses.push({
          id: course.id,
          courseCode: course.course_code,
          courseTitle: course.course_title,
          faculty: latestTask?.assigned_to_user?.name || null,
          status: resolveCourseStatus(latestTask),
        });
      }

      return {
        department: { id: department.id, name: department.name, code: department.code },
        semesters,
      };
    },
  });

  fastify.get('/tasks', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      querystring: {
        type: 'object',
        properties: { departmentId: { type: 'string' }, status: { type: 'string' } },
      },
    },
    handler: async (request) => {
      const where = {};
      if (request.query.departmentId) where.department_id = request.query.departmentId;
      if (request.query.status) where.status = request.query.status;

      const tasks = await fastify.prisma.tasks.findMany({
        where,
        include: { course: true, department: true, assigned_to_user: true },
        orderBy: { created_at: 'desc' },
      });
      return tasks.map(sanitizeTask);
    },
  });

  fastify.post('/tasks/:id/reassign', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['facultyUserId', 'deadline'],
        properties: {
          facultyUserId: { type: 'string' },
          deadline: { type: 'string', format: 'date' },
        },
      },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { id: request.params.id },
        include: { course: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      const faculty = await fastify.prisma.users.findUnique({ where: { id: request.body.facultyUserId } });
      if (!faculty || faculty.role !== 'faculty' || faculty.department_id !== task.department_id) {
        throw fastify.httpErrors.badRequest('Faculty member does not belong to this task\'s department');
      }

      const updated = await fastify.prisma.tasks.update({
        where: { id: task.id },
        data: {
          assigned_to: faculty.id,
          assigned_by: request.user.id,
          deadline: new Date(request.body.deadline),
          status: 'assigned',
          revision_notes: null,
          submitted_at: null,
          approved_at: null,
          approved_by: null,
        },
      });

      try {
        await emailService.sendAssignmentEmail({
          to: faculty.email,
          facultyName: faculty.name,
          courseCode: task.course.course_code,
          courseTitle: task.course.course_title,
          deadline: request.body.deadline,
          link: `${process.env.FRONTEND_URL}/task/${updated.access_token}`,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to send reassignment email');
      }

      return sanitizeTask({ ...updated, course: task.course });
    },
  });

  fastify.post('/tasks/:id/approve', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    handler: async (request) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { id: request.params.id } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      const updated = await fastify.prisma.tasks.update({
        where: { id: task.id },
        data: { status: 'approved', approved_at: new Date(), approved_by: request.user.name },
      });
      return sanitizeTask(updated);
    },
  });

  fastify.post('/tasks/:id/reject', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['revisionNotes'], properties: { revisionNotes: { type: 'string', minLength: 1 } } },
    },
    handler: async (request) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { id: request.params.id } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      const updated = await fastify.prisma.tasks.update({
        where: { id: task.id },
        data: { status: 'rejected', revision_notes: request.body.revisionNotes },
      });
      return sanitizeTask(updated);
    },
  });
}

module.exports = adminRoutes;
