require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const SUB_ADMIN_PASSWORD = 'SubAdmin@123';
const FACULTY_PASSWORD = 'Faculty@123';
const TOP_ADMIN_PASSWORD = 'Admin@123';

// Curated, realistic sample courses per known department code. Any
// department code not listed here falls back to a generic pair of courses
// so the script works for departments beyond the original six.
const SAMPLE_COURSES = {
  CSE: [
    { suffix: '101', title: 'Programming for Problem Solving', L: 3, T: 0, P: 2, category: 'ES' },
    { suffix: '102', title: 'Data Structures and Algorithms', L: 3, T: 1, P: 2, category: 'PC' },
    { suffix: '103', title: 'Database Management Systems', L: 3, T: 0, P: 2, category: 'PC' },
  ],
  'AI&DS': [
    { suffix: '101', title: 'Foundations of Data Science', L: 3, T: 0, P: 2, category: 'ES' },
    { suffix: '102', title: 'Machine Learning Fundamentals', L: 3, T: 1, P: 2, category: 'PC' },
    { suffix: '103', title: 'Statistical Methods for AI', L: 3, T: 1, P: 0, category: 'PC' },
  ],
  MECH: [
    { suffix: '101', title: 'Engineering Thermodynamics', L: 3, T: 1, P: 0, category: 'ES' },
    { suffix: '102', title: 'Fluid Mechanics and Machinery', L: 3, T: 0, P: 2, category: 'PC' },
    { suffix: '103', title: 'Manufacturing Technology', L: 3, T: 0, P: 2, category: 'PC' },
  ],
  EEE: [
    { suffix: '101', title: 'Electrical Circuit Analysis', L: 3, T: 1, P: 2, category: 'ES' },
    { suffix: '102', title: 'Electrical Machines', L: 3, T: 0, P: 2, category: 'PC' },
    { suffix: '103', title: 'Power Systems Engineering', L: 3, T: 1, P: 0, category: 'PC' },
  ],
  ECE: [
    { suffix: '101', title: 'Electronic Devices and Circuits', L: 3, T: 0, P: 2, category: 'ES' },
    { suffix: '102', title: 'Digital Signal Processing', L: 3, T: 1, P: 2, category: 'PC' },
    { suffix: '103', title: 'Communication Systems', L: 3, T: 1, P: 0, category: 'PC' },
  ],
  CIVIL: [
    { suffix: '101', title: 'Strength of Materials', L: 3, T: 1, P: 0, category: 'ES' },
    { suffix: '102', title: 'Surveying and Geomatics', L: 2, T: 0, P: 2, category: 'PC' },
    { suffix: '103', title: 'Structural Analysis', L: 3, T: 1, P: 0, category: 'PC' },
  ],
};

function sanitizeForEmail(code) {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sanitizeForCourseCode(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function ensureUser({ name, email, password, role, departmentId }) {
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) return existing;

  const hashedPassword = await bcrypt.hash(password, 10);
  return prisma.users.create({
    data: { name, email, password: hashedPassword, role, department_id: departmentId },
  });
}

async function ensureCourse({ courseCode, courseTitle, departmentId, lecture, tutorial, practical, category }) {
  const existing = await prisma.courses.findUnique({ where: { course_code: courseCode } });
  if (existing) return existing;

  return prisma.courses.create({
    data: {
      course_code: courseCode,
      course_title: courseTitle,
      department_id: departmentId,
      semester: 1,
      lecture_hours: lecture,
      tutorial_hours: tutorial,
      practical_hours: practical,
      category,
    },
  });
}

async function main() {
  const createdAccounts = [];

  const topAdmin = await ensureUser({
    name: 'Top Administrator',
    email: 'admin@currisync.edu',
    password: TOP_ADMIN_PASSWORD,
    role: 'top_admin',
    departmentId: null,
  });
  createdAccounts.push({ role: 'top_admin', email: topAdmin.email, password: TOP_ADMIN_PASSWORD });

  const departments = await prisma.departments.findMany();

  if (departments.length === 0) {
    console.warn('No departments found — run schema.sql first (it seeds the departments table).');
  }

  for (const department of departments) {
    const emailCode = sanitizeForEmail(department.code);
    const courseCode = sanitizeForCourseCode(department.code);

    const subAdminEmail = `${emailCode}.admin@currisync.edu`;
    const subAdmin = await ensureUser({
      name: `${department.name} Sub-Admin`,
      email: subAdminEmail,
      password: SUB_ADMIN_PASSWORD,
      role: 'sub_admin',
      departmentId: department.id,
    });
    createdAccounts.push({ role: 'sub_admin', email: subAdmin.email, password: SUB_ADMIN_PASSWORD, department: department.code });

    for (const n of [1, 2]) {
      const facultyEmail = `${emailCode}.faculty${n}@currisync.edu`;
      const faculty = await ensureUser({
        name: `${department.name} Faculty ${n}`,
        email: facultyEmail,
        password: FACULTY_PASSWORD,
        role: 'faculty',
        departmentId: department.id,
      });
      createdAccounts.push({ role: 'faculty', email: faculty.email, password: FACULTY_PASSWORD, department: department.code });
    }

    const sampleCourses = SAMPLE_COURSES[department.code] || [
      { suffix: '101', title: `${department.name} Fundamentals I`, L: 3, T: 0, P: 2, category: 'ES' },
      { suffix: '102', title: `${department.name} Fundamentals II`, L: 3, T: 1, P: 0, category: 'PC' },
    ];

    for (const sample of sampleCourses) {
      await ensureCourse({
        courseCode: `${courseCode}${sample.suffix}`,
        courseTitle: sample.title,
        departmentId: department.id,
        lecture: sample.L,
        tutorial: sample.T,
        practical: sample.P,
        category: sample.category,
      });
    }
  }

  console.log('\nSeed complete. Login credentials:\n');
  console.table(createdAccounts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
