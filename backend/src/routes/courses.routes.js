const { formatReference } = require('../services/referenceFormatter.service');

const courseInclude = {
  syllabus_units: { orderBy: { unit_number: 'asc' } },
  textbooks: { orderBy: { sequence_number: 'asc' } },
  course_outcomes: { orderBy: { sequence_number: 'asc' } },
};

function sanitizeCourse(course) {
  return {
    id: course.id,
    courseCode: course.course_code,
    courseTitle: course.course_title,
    departmentId: course.department_id,
    academicYear: course.academic_year,
    semester: course.semester,
    lectureHours: course.lecture_hours,
    tutorialHours: course.tutorial_hours,
    practicalHours: course.practical_hours,
    credits: course.credits,
    caMarks: course.ca_marks,
    eseMarks: course.ese_marks,
    totalMarks: course.total_marks,
    category: course.category,
    introduction: course.introduction,
    totalLecturePeriods: course.total_lecture_periods,
    totalTutorialPeriods: course.total_tutorial_periods,
    commonTo: course.common_to,
    prerequisites: course.prerequisites,
    syllabusUnits: (course.syllabus_units || []).map((u) => ({
      id: u.id,
      unitNumber: u.unit_number,
      unitTitle: u.unit_title,
      content: u.content,
      hours: u.hours,
    })),
    textbooks: (course.textbooks || []).map((t) => ({
      id: t.id,
      bookType: t.book_type,
      sequenceNumber: t.sequence_number,
      authors: t.authors,
      title: t.title,
      edition: t.edition,
      publisher: t.publisher,
      place: t.place,
      year: t.year,
      formattedReference: t.formatted_reference,
    })),
    courseOutcomes: (course.course_outcomes || []).map((o) => ({
      id: o.id,
      coNumber: o.co_number,
      description: o.description,
      bloomsLevel: o.blooms_level,
      sequenceNumber: o.sequence_number,
      poMapping: o.po_mapping,
    })),
    createdAt: course.created_at,
    updatedAt: course.updated_at,
  };
}

// Builds the scalar (non-nested) column update for a course row. `credits`
// and `total_marks` are DB-generated (STORED) columns and are never part of
// this payload — Postgres computes them from lecture/tutorial/practical
// hours and ca/ese marks on every write.
function buildScalarCourseData(body, { includeCodeAndTitle = true } = {}) {
  const data = {};

  if (includeCodeAndTitle) {
    if (body.courseCode !== undefined) data.course_code = body.courseCode;
    if (body.courseTitle !== undefined) data.course_title = body.courseTitle;
  }

  if (body.departmentId !== undefined) data.department_id = body.departmentId;
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
  if (body.commonTo !== undefined) data.common_to = body.commonTo;
  if (body.prerequisites !== undefined) data.prerequisites = body.prerequisites;

  return data;
}

// Replace-all-on-save for a course's child rows: syllabus units, textbooks
// (and references), and course outcomes. Used by both the admin course
// routes and the faculty token-based submission route.
async function replaceCourseChildren(prisma, courseId, body) {
  await prisma.syllabus_units.deleteMany({ where: { course_id: courseId } });
  await prisma.textbooks.deleteMany({ where: { course_id: courseId } });
  await prisma.course_outcomes.deleteMany({ where: { course_id: courseId } });

  if (Array.isArray(body.syllabusUnits) && body.syllabusUnits.length) {
    await prisma.syllabus_units.createMany({
      data: body.syllabusUnits.map((u) => ({
        course_id: courseId,
        unit_number: u.unitNumber,
        unit_title: u.unitTitle || null,
        content: u.content,
        hours: u.hours ?? null,
      })),
    });
  }

  if (Array.isArray(body.textbooks) && body.textbooks.length) {
    await prisma.textbooks.createMany({
      data: body.textbooks.map((t) => ({
        course_id: courseId,
        book_type: t.bookType,
        sequence_number: t.sequenceNumber,
        authors: t.authors,
        title: t.title,
        edition: t.edition || null,
        publisher: t.publisher,
        place: t.place || null,
        year: t.year,
        formatted_reference: formatReference({
          authors: t.authors,
          title: t.title,
          edition: t.edition,
          publisher: t.publisher,
          place: t.place,
          year: t.year,
        }),
      })),
    });
  }

  if (Array.isArray(body.courseOutcomes) && body.courseOutcomes.length) {
    await prisma.course_outcomes.createMany({
      data: body.courseOutcomes.map((o) => ({
        course_id: courseId,
        co_number: o.coNumber,
        description: o.description,
        blooms_level: o.bloomsLevel || null,
        sequence_number: o.sequenceNumber,
        po_mapping: o.poMapping || null,
      })),
    });
  }
}

const courseChildSchema = {
  syllabusUnits: {
    type: 'array',
    items: {
      type: 'object',
      required: ['unitNumber', 'content'],
      properties: {
        unitNumber: { type: 'integer' },
        unitTitle: { type: ['string', 'null'] },
        content: { type: 'string' },
        hours: { type: ['integer', 'null'] },
      },
    },
  },
  textbooks: {
    type: 'array',
    items: {
      type: 'object',
      required: ['bookType', 'sequenceNumber', 'authors', 'title', 'publisher', 'year'],
      properties: {
        bookType: { type: 'string', enum: ['textbook', 'reference'] },
        sequenceNumber: { type: 'integer' },
        authors: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        edition: { type: ['string', 'null'] },
        publisher: { type: 'string' },
        place: { type: ['string', 'null'] },
        year: { type: 'integer' },
      },
    },
  },
  courseOutcomes: {
    type: 'array',
    items: {
      type: 'object',
      required: ['coNumber', 'description', 'sequenceNumber'],
      properties: {
        coNumber: { type: 'string' },
        description: { type: 'string' },
        bloomsLevel: { type: ['string', 'null'] },
        sequenceNumber: { type: 'integer' },
        // Map of PO1..PO11 / PSO1..PSO2 -> 1|2|3 (or omitted/null for blank).
        // Left as a loose object rather than fully enumerated so the PO/PSO
        // count can change without a schema edit here.
        poMapping: { type: ['object', 'null'] },
      },
    },
  },
};

async function coursesRoutes(fastify, options) {
  fastify.get('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          departmentId: { type: 'string' },
          unassigned: { type: 'boolean' },
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

      if (request.query.unassigned) {
        where.tasks = { none: {} };
      }

      const courses = await fastify.prisma.courses.findMany({
        where,
        include: courseInclude,
        orderBy: { course_code: 'asc' },
      });
      return courses.map(sanitizeCourse);
    },
  });

  fastify.get('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin', 'sub_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request) => {
      const course = await fastify.prisma.courses.findUnique({
        where: { id: request.params.id },
        include: courseInclude,
      });
      if (!course) {
        throw fastify.httpErrors.notFound('Course not found');
      }
      if (request.user.role === 'sub_admin' && course.department_id !== request.user.departmentId) {
        throw fastify.httpErrors.forbidden('This course does not belong to your department');
      }
      return sanitizeCourse(course);
    },
  });

  fastify.post('/', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      body: {
        type: 'object',
        required: ['courseCode', 'courseTitle', 'departmentId', 'semester'],
        properties: {
          courseCode: { type: 'string', minLength: 1 },
          courseTitle: { type: 'string', minLength: 1 },
          departmentId: { type: 'string' },
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
          commonTo: { type: 'string' },
          prerequisites: { type: 'string' },
          ...courseChildSchema,
        },
      },
    },
    handler: async (request, reply) => {
      const existing = await fastify.prisma.courses.findUnique({ where: { course_code: request.body.courseCode } });
      if (existing) {
        return reply.code(409).send({ message: 'A course with this course code already exists.' });
      }

      const created = await fastify.prisma.courses.create({ data: buildScalarCourseData(request.body) });
      await replaceCourseChildren(fastify.prisma, created.id, request.body);

      const course = await fastify.prisma.courses.findUnique({ where: { id: created.id }, include: courseInclude });
      return reply.code(201).send(sanitizeCourse(course));
    },
  });

  fastify.put('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object',
        properties: {
          courseCode: { type: 'string', minLength: 1 },
          courseTitle: { type: 'string', minLength: 1 },
          departmentId: { type: 'string' },
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
          commonTo: { type: 'string' },
          prerequisites: { type: 'string' },
          ...courseChildSchema,
        },
      },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const existing = await fastify.prisma.courses.findUnique({ where: { id } });
      if (!existing) {
        throw fastify.httpErrors.notFound('Course not found');
      }

      await fastify.prisma.courses.update({ where: { id }, data: buildScalarCourseData(request.body) });
      await replaceCourseChildren(fastify.prisma, id, request.body);

      const course = await fastify.prisma.courses.findUnique({ where: { id }, include: courseInclude });
      return sanitizeCourse(course);
    },
  });

  fastify.delete('/:id', {
    preHandler: [fastify.authenticate, fastify.authorize(['top_admin'])],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
    },
    handler: async (request, reply) => {
      const { id } = request.params;
      const existing = await fastify.prisma.courses.findUnique({ where: { id } });
      if (!existing) {
        throw fastify.httpErrors.notFound('Course not found');
      }
      await fastify.prisma.courses.delete({ where: { id } });
      return reply.code(204).send();
    },
  });
}

module.exports = coursesRoutes;
module.exports.sanitizeCourse = sanitizeCourse;
module.exports.courseInclude = courseInclude;
module.exports.replaceCourseChildren = replaceCourseChildren;
module.exports.courseChildSchema = courseChildSchema;
