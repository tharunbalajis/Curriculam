const { sanitizeCourse, courseInclude, replaceCourseChildren, courseChildSchema } = require('./courses.routes');
const emailService = require('../services/email.service');

function buildScalarCourseData(body, { includeCodeAndTitle = true } = {}) {
  const data = {};

  if (includeCodeAndTitle) {
    if (body.courseCode !== undefined) data.course_code = body.courseCode;
    if (body.courseTitle !== undefined) data.course_title = body.courseTitle;
  }

  if (body.academicYear !== undefined) data.academic_year = body.academicYear;
  if (body.semester !== undefined) data.semester = body.semester;
  if (body.lectureHours !== undefined) data.lecture_hours = body.lectureHours;
  if (body.tutorialHours !== undefined) data.tutorial_hours = body.tutorialHours;
  if (body.practicalHours !== undefined) data.practical_hours = body.practicalHours;
  if (body.caMarks !== undefined) data.ca_marks = body.caMarks;
  if (body.eseMarks !== undefined) data.ese_marks = body.eseMarks;
  if (body.category !== undefined) data.category = body.category;
  if (body.introduction !== undefined) data.introduction = body.introduction;
  if (body.totalLecturePeriods !== undefined) data.total_lecture_periods = body.totalLecturePeriods;
  if (body.totalTutorialPeriods !== undefined) data.total_tutorial_periods = body.totalTutorialPeriods;

  return data;
}

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
    updatedAt: task.updated_at,
    courseId: task.course_id,
    departmentId: task.department_id,
    course: task.course ? sanitizeCourse(task.course) : undefined,
    department: task.department ? { id: task.department.id, name: task.department.name, code: task.department.code } : undefined,
    faculty: task.assigned_to_user
      ? { id: task.assigned_to_user.id, name: task.assigned_to_user.name, email: task.assigned_to_user.email }
      : undefined,
    assignedBy: task.assigned_by_user
      ? { id: task.assigned_by_user.id, name: task.assigned_by_user.name, email: task.assigned_by_user.email }
      : undefined,
  };
}

async function approveTask(prisma, task, approvedByName) {
  return prisma.tasks.update({
    where: { id: task.id },
    data: { status: 'approved', approved_at: new Date(), approved_by: approvedByName },
  });
}

async function rejectTask(prisma, task, revisionNotes) {
  return prisma.tasks.update({
    where: { id: task.id },
    data: { status: 'rejected', revision_notes: revisionNotes },
  });
}

const taskListInclude = {
  course: true,
  assigned_to_user: true,
  assigned_by_user: true,
};

async function tasksRoutes(fastify, options) {
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    handler: async (request) => {
      const tasks = await fastify.prisma.tasks.findMany({
        where: { department_id: request.user.departmentId },
        include: taskListInclude,
        orderBy: { created_at: 'desc' },
      });
      return tasks.map(sanitizeTask);
    },
  });

  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['courseId', 'facultyUserId', 'deadline'],
        properties: {
          courseId: { type: 'string' },
          facultyUserId: { type: 'string' },
          deadline: { type: 'string', format: 'date' },
        },
      },
    },
    handler: async (request, reply) => {
      const { courseId, facultyUserId, deadline } = request.body;
      const departmentId = request.user.departmentId;

      const course = await fastify.prisma.courses.findUnique({ where: { id: courseId } });
      if (!course || course.department_id !== departmentId) {
        throw fastify.httpErrors.badRequest('Course does not belong to your department');
      }

      const faculty = await fastify.prisma.users.findUnique({ where: { id: facultyUserId } });
      if (!faculty || faculty.role !== 'faculty' || faculty.department_id !== departmentId) {
        throw fastify.httpErrors.badRequest('Faculty member does not belong to your department');
      }

      const task = await fastify.prisma.tasks.create({
        data: {
          course_id: courseId,
          department_id: departmentId,
          assigned_to: facultyUserId,
          assigned_by: request.user.id,
          status: 'assigned',
          deadline: new Date(deadline),
        },
      });

      try {
        await emailService.sendAssignmentEmail({
          to: faculty.email,
          facultyName: faculty.name,
          courseCode: course.course_code,
          courseTitle: course.course_title,
          deadline,
          link: `${process.env.FRONTEND_URL}/task/${task.access_token}`,
        });
      } catch (err) {
        fastify.log.error({ err }, 'Failed to send assignment email');
      }

      return reply.code(201).send(sanitizeTask(task));
    },
  });

  fastify.post('/:id/approve', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { id: request.params.id } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();
      if (task.status !== 'submitted') {
        return reply.code(409).send({ message: 'Task is not awaiting approval' });
      }
      const updated = await approveTask(fastify.prisma, task, request.user.name);
      return sanitizeTask(updated);
    },
  });

  fastify.post('/:id/reject', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', required: ['revisionNotes'], properties: { revisionNotes: { type: 'string', minLength: 1 } } },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { id: request.params.id } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();
      if (task.status !== 'submitted') {
        return reply.code(409).send({ message: 'Task is not awaiting approval' });
      }
      const updated = await rejectTask(fastify.prisma, task, request.body.revisionNotes);
      return sanitizeTask(updated);
    },
  });

  // ---- Public, token-authorized routes (faculty fill flow) ----

  fastify.get('/token/:token', {
    schema: { params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } },
    handler: async (request) => {
      let task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: { course: { include: courseInclude }, department: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      if (task.status === 'assigned') {
        task = await fastify.prisma.tasks.update({
          where: { id: task.id },
          data: { status: 'in_progress' },
          include: { course: { include: courseInclude }, department: true },
        });
      }

      const readOnly = task.status === 'submitted' || task.status === 'approved';

      return {
        taskId: task.id,
        status: task.status,
        deadline: task.deadline,
        revisionNotes: task.revision_notes,
        readOnly,
        department: { id: task.department.id, name: task.department.name },
        course: sanitizeCourse(task.course),
      };
    },
  });

  fastify.put('/token/:token', {
    schema: {
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          academicYear: { type: 'string' },
          semester: { type: 'integer', minimum: 1, maximum: 8 },
          lectureHours: { type: 'integer', minimum: 0 },
          tutorialHours: { type: 'integer', minimum: 0 },
          practicalHours: { type: 'integer', minimum: 0 },
          caMarks: { type: 'integer', minimum: 0 },
          eseMarks: { type: 'integer', minimum: 0 },
          category: { type: 'string', enum: ['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'] },
          introduction: { type: 'string' },
          totalLecturePeriods: { type: 'integer' },
          totalTutorialPeriods: { type: 'integer' },
          ...courseChildSchema,
        },
        additionalProperties: true,
      },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: { course: true, department: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      if (task.status === 'submitted' || task.status === 'approved') {
        return reply.code(409).send({ message: 'This submission is read-only and can no longer be edited.' });
      }

      // course_code / course_title are intentionally never applied here, even
      // if present in the body — faculty cannot rename the course they were assigned.
      await fastify.prisma.courses.update({
        where: { id: task.course_id },
        data: buildScalarCourseData(request.body, { includeCodeAndTitle: false }),
      });
      await replaceCourseChildren(fastify.prisma, task.course_id, request.body);

      const updatedTask = await fastify.prisma.tasks.update({
        where: { id: task.id },
        data: { status: 'submitted', submitted_at: new Date() },
      });

      const subAdmin = await fastify.prisma.users.findFirst({
        where: { department_id: task.department_id, role: 'sub_admin' },
      });

      if (subAdmin) {
        try {
          await emailService.sendSubmissionEmail({
            to: subAdmin.email,
            facultyName: request.body.facultyName || 'Faculty',
            courseCode: task.course.course_code,
            link: `${process.env.FRONTEND_URL}/review/${task.access_token}`,
          });
        } catch (err) {
          fastify.log.error({ err }, 'Failed to send submission email');
        }
      }

      const course = await fastify.prisma.courses.findUnique({ where: { id: task.course_id }, include: courseInclude });
      return { ...sanitizeTask(updatedTask), course: sanitizeCourse(course) };
    },
  });

  // ---- Sub-admin review flow, reached via the emailed token but authorized by JWT ----

  fastify.get('/token/:token/review', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: { params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } },
    handler: async (request) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: { course: { include: courseInclude }, assigned_to_user: true, department: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();

      return sanitizeTask(task);
    },
  });

  fastify.post('/token/:token/approve', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: { params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { access_token: request.params.token } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();
      if (task.status !== 'submitted') {
        return reply.code(409).send({ message: 'Task is not awaiting approval' });
      }
      const updated = await approveTask(fastify.prisma, task, request.user.name);
      return sanitizeTask(updated);
    },
  });

  fastify.post('/token/:token/reject', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: {
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      body: { type: 'object', required: ['revisionNotes'], properties: { revisionNotes: { type: 'string', minLength: 1 } } },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({ where: { access_token: request.params.token } });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();
      if (task.status !== 'submitted') {
        return reply.code(409).send({ message: 'Task is not awaiting approval' });
      }
      const updated = await rejectTask(fastify.prisma, task, request.body.revisionNotes);
      return sanitizeTask(updated);
    },
  });
}

module.exports = tasksRoutes;
