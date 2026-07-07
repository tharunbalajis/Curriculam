const { sanitizeCourse, courseInclude, replaceCourseChildren, courseChildSchema, computeTotalPeriods } = require('./courses.routes');
const { generateCoursesDocx } = require('../services/documentGenerator.service');
const emailService = require('../services/email.service');

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Creates an assigned task + sends the assignment email. Shared by the
// sub-admin POST / handler below and the top_admin direct-assign path in
// courses.routes.js (which requires it lazily to avoid a circular import).
// Callers do their own authorization; this only performs the write.
async function createAssignedTask(fastify, { course, faculty, departmentId, assignedById, deadline }) {
  const task = await fastify.prisma.tasks.create({
    data: {
      course_id: course.id,
      department_id: departmentId,
      assigned_to: faculty.id,
      assigned_by: assignedById,
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

  return task;
}

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
  // Note: commonTo is identity metadata (like course_code/course_title) set
  // by top_admin at course creation — faculty submissions never touch it.
  if (body.prerequisites !== undefined) data.prerequisites = body.prerequisites;

  // total periods are derived from the submitted units, never taken from the
  // client — same rule as the admin course routes.
  Object.assign(data, computeTotalPeriods(body));

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

// Reopens an approved task for further edits. 'reopened' behaves exactly like
// 'rejected' for edit access (faculty can edit + resubmit, and the resubmit
// lands back in Review Submissions) but carries distinct labeling, since
// nothing was wrong with the original work. Re-approval locks it again with
// no special-casing. The faculty member is notified by email so this never
// happens silently. Callers pass the task with course + assigned_to_user
// included and do their own authorization.
async function reopenTask(fastify, task, note) {
  const updated = await fastify.prisma.tasks.update({
    where: { id: task.id },
    data: { status: 'reopened', revision_notes: note || null, approved_at: null, approved_by: null },
  });

  if (task.assigned_to_user) {
    // sendReopenedEmail catches its own errors — a broken SMTP config never
    // blocks the reopen itself.
    await emailService.sendReopenedEmail({
      to: task.assigned_to_user.email,
      facultyName: task.assigned_to_user.name,
      courseCode: task.course.course_code,
      courseTitle: task.course.course_title,
      note: note || null,
      link: `${process.env.FRONTEND_URL}/task/${task.access_token}`,
    });
  }

  return updated;
}

const taskListInclude = {
  course: true,
  assigned_to_user: true,
  assigned_by_user: true,
};

const fillInclude = {
  course: { include: courseInclude },
  department: true,
};

// Shared by the token-based fill route (GET /token/:token) and the
// authenticated faculty route (GET /:id) — both a course-fill fetch resolves
// to the exact same response shape regardless of how the caller got there.
async function maybeStartProgress(prisma, task) {
  if (task.status !== 'assigned') return task;
  return prisma.tasks.update({
    where: { id: task.id },
    data: { status: 'in_progress' },
    include: fillInclude,
  });
}

function shapeFillResponse(task) {
  // Only approval locks the form — a submitted task stays editable so the
  // faculty member can fix mistakes and resubmit until the sub-admin decides.
  const readOnly = task.status === 'approved';
  return {
    taskId: task.id,
    status: task.status,
    deadline: task.deadline,
    revisionNotes: task.revision_notes,
    readOnly,
    department: { id: task.department.id, name: task.department.name },
    course: sanitizeCourse(task.course),
  };
}

// Generates and streams the one-course preview document for a task, using
// the same generator (and the department's fixed revision date) as the
// Download Center exports so the preview matches the final export exactly.
async function sendTaskPreviewDocx(reply, task) {
  const course = sanitizeCourse(task.course);
  const buffer = await generateCoursesDocx([course], {
    revisionDate: task.department?.revision_date || null,
  });
  return reply
    .header('Content-Type', DOCX_MIME)
    .header('Content-Disposition', `attachment; filename="${task.course.course_code}_preview.docx"`)
    .send(buffer);
}

// Shared by the token-based submit route (PUT /token/:token) and the
// authenticated faculty route (PUT /:id) — same update logic either way.
async function submitCourseForTask(prisma, task, body) {
  // course_code / course_title are intentionally never applied here, even if
  // present in the body — faculty cannot rename the course they were assigned.
  await prisma.courses.update({
    where: { id: task.course_id },
    data: buildScalarCourseData(body, { includeCodeAndTitle: false }),
  });
  await replaceCourseChildren(prisma, task.course_id, body);

  const updatedTask = await prisma.tasks.update({
    where: { id: task.id },
    data: { status: 'submitted', submitted_at: new Date() },
  });

  const [subAdmin, faculty] = await Promise.all([
    prisma.users.findFirst({ where: { department_id: task.department_id, role: 'sub_admin' } }),
    task.assigned_to ? prisma.users.findUnique({ where: { id: task.assigned_to } }) : null,
  ]);

  if (subAdmin) {
    // sendSubmissionEmail already catches its own errors internally (logs
    // and returns) so a missing/broken SMTP config never blocks a submission.
    await emailService.sendSubmissionEmail({
      to: subAdmin.email,
      facultyName: faculty?.name || 'Faculty',
      courseCode: task.course.course_code,
      link: `${process.env.FRONTEND_URL}/review/${task.access_token}`,
    });
  }

  const course = await prisma.courses.findUnique({ where: { id: task.course_id }, include: courseInclude });
  return { updatedTask, course };
}

const submitBodySchema = {
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
    prerequisites: { type: 'string' },
    ...courseChildSchema,
  },
  additionalProperties: true,
};

async function tasksRoutes(fastify, options) {
  // GET /api/tasks — sub_admin sees their department's tasks (unchanged);
  // faculty sees only tasks assigned to them.
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin', 'faculty'])],
    handler: async (request) => {
      const where =
        request.user.role === 'faculty'
          ? { assigned_to: request.user.id }
          : { department_id: request.user.departmentId };

      const tasks = await fastify.prisma.tasks.findMany({
        where,
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

      const course = await fastify.prisma.courses.findUnique({
        where: { id: courseId },
        include: { common_departments: true },
      });
      if (!course || course.department_id !== departmentId) {
        throw fastify.httpErrors.badRequest('Course does not belong to your department');
      }

      // A shared ("common to") course may be filled by faculty from any of
      // its common-to departments, not just the owning one. Unrelated
      // departments are still rejected.
      const allowedDepartmentIds = new Set([
        course.department_id,
        ...course.common_departments.map((cd) => cd.department_id),
      ]);
      const faculty = await fastify.prisma.users.findUnique({ where: { id: facultyUserId } });
      if (!faculty || faculty.role !== 'faculty' || !allowedDepartmentIds.has(faculty.department_id)) {
        throw fastify.httpErrors.badRequest(
          "Faculty member must belong to this course's department or one of its common-to departments"
        );
      }

      const task = await createAssignedTask(fastify, {
        course,
        faculty,
        departmentId,
        assignedById: request.user.id,
        deadline,
      });

      return reply.code(201).send(sanitizeTask(task));
    },
  });

  // GET /api/tasks/:id — authenticated fill fetch. top_admin: any task;
  // sub_admin: own department only; faculty: only their own assigned task.
  // This is the JWT-based counterpart to GET /token/:token below — same
  // response shape, same auto "assigned -> in_progress" transition.
  fastify.get('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin', 'faculty'])],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    handler: async (request) => {
      let task = await fastify.prisma.tasks.findUnique({
        where: { id: request.params.id },
        include: fillInclude,
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      if (request.user.role === 'faculty' && task.assigned_to !== request.user.id) {
        throw fastify.httpErrors.forbidden('This task is not assigned to you');
      }
      if (request.user.role === 'sub_admin' && task.department_id !== request.user.departmentId) {
        throw fastify.httpErrors.forbidden('This task does not belong to your department');
      }

      task = await maybeStartProgress(fastify.prisma, task);
      return shapeFillResponse(task);
    },
  });

  // PUT /api/tasks/:id — authenticated faculty submit path. Ownership is
  // checked against assigned_to regardless of role, mirroring exactly the
  // same update logic as the token-based PUT /token/:token below.
  fastify.put('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['faculty'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: submitBodySchema,
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { id: request.params.id },
        include: { course: true, department: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.assigned_to !== request.user.id) {
        throw fastify.httpErrors.forbidden('This task is not assigned to you');
      }
      // Resubmitting from 'submitted' is allowed (updates content and
      // refreshes submitted_at); only approval locks the submission.
      if (task.status === 'approved') {
        return reply.code(409).send({ message: 'This submission has been approved and can no longer be edited.' });
      }

      const { updatedTask, course } = await submitCourseForTask(fastify.prisma, task, request.body);
      return { ...sanitizeTask(updatedTask), course: sanitizeCourse(course) };
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

  // POST /api/tasks/:id/reopen — reopen an approved task for further edits.
  // Available to the owning department's sub_admin and to top_admin (who,
  // consistent with the rest of the app, has no department restriction).
  fastify.post('/:id/reopen', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin', 'top_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: { type: 'object', properties: { note: { type: ['string', 'null'] } } },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { id: request.params.id },
        include: { course: true, assigned_to_user: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (request.user.role === 'sub_admin' && task.department_id !== request.user.departmentId) {
        throw fastify.httpErrors.forbidden();
      }
      if (task.status !== 'approved') {
        return reply.code(409).send({ message: 'Only an approved task can be reopened.' });
      }
      const updated = await reopenTask(fastify, task, request.body?.note);
      return sanitizeTask(updated);
    },
  });

  // GET /api/tasks/:id/preview.docx — faculty-only preview of their own
  // task's current course content as a document, whatever its status (even
  // unsubmitted drafts). This is NOT the Download Center (which faculty
  // still cannot reach) — it is scoped to exactly one task the requester is
  // assigned to.
  fastify.get('/:id/preview.docx', {
    preHandler: [fastify.authenticate, fastify.authorize(['faculty'])],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { id: request.params.id },
        include: fillInclude,
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.assigned_to !== request.user.id) {
        throw fastify.httpErrors.forbidden('This task is not assigned to you');
      }
      return sendTaskPreviewDocx(reply, task);
    },
  });

  // ---- Public, token-authorized routes (emailed-link fill flow) ----

  // GET /api/tasks/token/:token/preview.docx — token-authorized counterpart
  // for the emailed-link fill page (/task/:token), same trust model as the
  // token-based GET/PUT above. Also used by the sub-admin review page
  // (/review/:token) to download the submission before deciding.
  fastify.get('/token/:token/preview.docx', {
    schema: { params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: fillInclude,
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      return sendTaskPreviewDocx(reply, task);
    },
  });

  fastify.get('/token/:token', {
    schema: { params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } } },
    handler: async (request) => {
      let task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: fillInclude,
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      task = await maybeStartProgress(fastify.prisma, task);
      return shapeFillResponse(task);
    },
  });

  fastify.put('/token/:token', {
    schema: {
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      body: submitBodySchema,
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: { course: true, department: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');

      // Same rule as the authenticated submit route: only approval locks it.
      if (task.status === 'approved') {
        return reply.code(409).send({ message: 'This submission has been approved and can no longer be edited.' });
      }

      const { updatedTask, course } = await submitCourseForTask(fastify.prisma, task, request.body);
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

  // Token counterpart of POST /:id/reopen, for the sub-admin review page
  // (/review/:token) — mirrors the token approve/reject routes above.
  fastify.post('/token/:token/reopen', {
    preHandler: [fastify.authenticate, fastify.authorize(['sub_admin'])],
    schema: {
      params: { type: 'object', required: ['token'], properties: { token: { type: 'string' } } },
      body: { type: 'object', properties: { note: { type: ['string', 'null'] } } },
    },
    handler: async (request, reply) => {
      const task = await fastify.prisma.tasks.findUnique({
        where: { access_token: request.params.token },
        include: { course: true, assigned_to_user: true },
      });
      if (!task) throw fastify.httpErrors.notFound('Task not found');
      if (task.department_id !== request.user.departmentId) throw fastify.httpErrors.forbidden();
      if (task.status !== 'approved') {
        return reply.code(409).send({ message: 'Only an approved task can be reopened.' });
      }
      const updated = await reopenTask(fastify, task, request.body?.note);
      return sanitizeTask(updated);
    },
  });
}

module.exports = tasksRoutes;
module.exports.createAssignedTask = createAssignedTask;
