const { sanitizeCourse, courseInclude } = require('./courses.routes');
const { resolveCourseStatus } = require('../services/courseStatus.service');
const { generateCoursesDocx } = require('../services/documentGenerator.service');
const { generateCoursesPdf } = require('../services/pdfGenerator.service');

const MIME_TYPES = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
};

function slug(text) {
  return String(text || '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'export';
}

// "Belongs to department X" for filtering purposes: X owns the course OR X
// is one of its common-to departments — the same OR-join the Overview
// accordion's course listing uses. A single findMany with OR returns each
// course once (the owner matches both branches but is not duplicated).
function departmentScope(departmentId) {
  return {
    OR: [
      { department_id: departmentId },
      { common_departments: { some: { department_id: departmentId } } },
    ],
  };
}

// Resolves the department/semester/status/courseIds filter combination into
// an actual list of course rows (with their latest task for status), scoped
// by role. sub_admin is always pinned to their own department and to
// 'approved' status regardless of what the client sends — the same
// department-scoping and never-trust-the-client principles used everywhere
// else in this API. "Their own department" includes courses common to it,
// not only courses it strictly owns.
async function resolveCourses(prisma, user, filters) {
  const where = {};

  if (user.role === 'sub_admin') {
    Object.assign(where, departmentScope(user.departmentId));
  } else if (filters.departmentId && filters.departmentId !== 'all') {
    Object.assign(where, departmentScope(filters.departmentId));
  }

  if (filters.semester && filters.semester !== 'all') {
    where.semester = Number(filters.semester);
  }

  if (Array.isArray(filters.courseIds) && filters.courseIds.length) {
    where.id = { in: filters.courseIds };
  }

  const courses = await prisma.courses.findMany({
    where,
    include: {
      ...courseInclude,
      tasks: { orderBy: { created_at: 'desc' }, take: 1 },
      department: true,
    },
    orderBy: [{ department_id: 'asc' }, { semester: 'asc' }, { course_code: 'asc' }],
  });

  const requestedStatus = user.role === 'sub_admin' ? 'approved' : filters.status || 'approved';

  return courses
    .filter((course) => requestedStatus === 'all' || resolveCourseStatus(course.tasks[0]) === requestedStatus)
    .map((course) => ({ ...course, _status: resolveCourseStatus(course.tasks[0]) }));
}

function buildFileName({ departmentId, semester, courseIds, departments }) {
  const parts = [];

  if (Array.isArray(courseIds) && courseIds.length) {
    parts.push('Selected_Courses');
  } else {
    if (!departmentId || departmentId === 'all') parts.push('All_Departments');
    else parts.push(slug(departments.find((d) => d.id === departmentId)?.code || 'Department'));

    if (!semester || semester === 'all') parts.push('All_Semesters');
    else parts.push(`Semester${semester}`);
  }

  return parts.join('_');
}

async function downloadsRoutes(fastify, options) {
  // GET /api/downloads/courses — filter-population data for the Download
  // Center UI (department/semester dropdowns and the course checklist).
  fastify.get('/courses', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          departmentId: { type: 'string' },
          semester: { type: 'string' },
          status: { type: 'string', enum: ['approved', 'submitted', 'pending', 'rejected', 'all'] },
        },
      },
    },
    handler: async (request) => {
      const courses = await resolveCourses(fastify.prisma, request.user, request.query);
      return courses.map((c) => ({
        id: c.id,
        courseCode: c.course_code,
        courseTitle: c.course_title,
        departmentId: c.department_id,
        departmentCode: c.department?.code,
        semester: c.semester,
        status: c._status,
      }));
    },
  });

  // POST /api/downloads/export — generates and streams back the compiled
  // document. Supports every combination from the prompt: single course,
  // whole semester, whole department, cross-department single semester,
  // whole university, or an explicit courseIds selection.
  fastify.post('/export', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['format'],
        properties: {
          departmentId: { type: 'string' },
          semester: { type: 'string' },
          status: { type: 'string', enum: ['approved', 'submitted', 'pending', 'rejected', 'all'] },
          courseIds: { type: 'array', items: { type: 'string' } },
          format: { type: 'string', enum: ['docx', 'pdf'] },
        },
      },
    },
    handler: async (request, reply) => {
      const { departmentId, semester, status, courseIds, format } = request.body;

      const courses = await resolveCourses(fastify.prisma, request.user, { departmentId, semester, status, courseIds });
      if (courses.length === 0) {
        return reply.code(404).send({ message: 'No courses match the selected filters.' });
      }

      const departments = await fastify.prisma.departments.findMany();

      // When the export is scoped to one target department, every course —
      // owned or pulled in via common-to — must carry that department's name,
      // because buildSchemeBlocks() groups strictly by departmentName: a
      // shared-in course keeping its owner's name would split the scheme into
      // a second department block/table. Owned courses have the same name
      // either way. Only an unscoped top_admin export ("all departments")
      // falls back to each course's true owning department.
      const targetDepartmentId =
        request.user.role === 'sub_admin'
          ? request.user.departmentId
          : departmentId && departmentId !== 'all'
          ? departmentId
          : null;
      const targetDepartment = targetDepartmentId
        ? departments.find((d) => d.id === targetDepartmentId) || null
        : null;

      const sanitized = courses.map((c) => ({
        ...sanitizeCourse(c),
        departmentName: targetDepartment?.name || c.department?.name,
        // Cover page + scheme heading's "(Minimum No. of credits...)" line —
        // same target-vs-owner resolution as departmentName above.
        departmentMinCredits: targetDepartment ? targetDepartment.min_credits : c.department?.min_credits ?? null,
      }));

      // Header revision date: only meaningful when the export covers a single
      // department (one revision date covers a whole department's curriculum
      // book). Cross-department exports fall back to today's date.
      const departmentIds = [...new Set(courses.map((c) => c.department_id).filter(Boolean))];
      const revisionDate =
        departmentIds.length === 1
          ? courses.find((c) => c.department)?.department?.revision_date || null
          : null;

      const buffer =
        format === 'pdf' ? await generateCoursesPdf(sanitized) : await generateCoursesDocx(sanitized, { revisionDate });

      const fileName = `${buildFileName({ departmentId, semester, courseIds, departments })}.${format}`;

      await fastify.prisma.download_history.create({
        data: {
          user_id: request.user.id,
          role: request.user.role,
          department_id: request.user.role === 'sub_admin' ? request.user.departmentId : departmentId && departmentId !== 'all' ? departmentId : null,
          filters: { departmentId: departmentId || 'all', semester: semester || 'all', status: status || 'approved', courseIds: courseIds || [] },
          export_type: format,
          scope: Array.isArray(courseIds) && courseIds.length ? 'selected_courses' : 'filtered',
          file_name: fileName,
        },
      });

      reply
        .header('Content-Type', MIME_TYPES[format])
        .header('Content-Disposition', `attachment; filename="${fileName}"`)
        .send(buffer);
    },
  });

  // GET /api/downloads/history — top_admin only, per the prompt.
  fastify.get('/history', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    handler: async () => {
      const rows = await fastify.prisma.download_history.findMany({
        include: { users: true, departments: true },
        orderBy: { created_at: 'desc' },
        take: 200,
      });

      return rows.map((r) => ({
        id: r.id,
        user: r.users ? { id: r.users.id, name: r.users.name, email: r.users.email } : null,
        role: r.role,
        department: r.departments ? { id: r.departments.id, name: r.departments.name, code: r.departments.code } : null,
        filters: r.filters,
        exportType: r.export_type,
        scope: r.scope,
        fileName: r.file_name,
        createdAt: r.created_at,
      }));
    },
  });
}

module.exports = downloadsRoutes;
