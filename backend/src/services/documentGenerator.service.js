const fs = require('fs');
const path = require('path');
const {
  Document,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  Packer,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  TabStopType,
  TabStopPosition,
  WidthType,
  VerticalAlign,
  BorderStyle,
} = require('docx');

const FONT = 'Times New Roman';
const SIZE = 20; // half-points -> 10pt, per the master template's own spec
const PO_KEYS = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2'];

// 1cm top/bottom, 2.54cm (1 inch) left/right — exact values from the
// university's own annotated formatting spec, in twips (1cm = 566.929twip).
const MARGIN = { top: 567, bottom: 567, left: 1440, right: 1440 };

function run(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: SIZE, ...opts });
}

function para(children, opts = {}) {
  return new Paragraph({ children: Array.isArray(children) ? children : [children], ...opts });
}

function todayFormatted() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// DATE columns come back as UTC-midnight Date objects — format with UTC
// getters so the printed day can't shift across timezones.
function dateFormatted(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function noBorderCell(text, opts = {}) {
  return new TableCell({
    children: [para(run(text, opts.runOpts), { alignment: opts.alignment })],
    width: opts.width,
    // Optional merges for the scheme table's two-row header ("Hours / Week" /
    // "Maximum Marks" span 3 sub-columns; label cells span both header rows).
    columnSpan: opts.columnSpan,
    rowSpan: opts.rowSpan,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
  });
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 2, color: '000000' };
const TABLE_BORDERS = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
  insideHorizontal: THIN_BORDER,
  insideVertical: THIN_BORDER,
}

function buildCourseOutcomesTable(courseOutcomes) {
  // Header matches the reference: the intro sentence spans the CO-number and
  // description columns (regular weight, left-aligned — the default), with
  // only "Bloom's Level" bold in its own cell.
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      noBorderCell('At the end of the course, students will be able to:', {
        columnSpan: 2,
        width: { size: 80, type: WidthType.PERCENTAGE },
      }),
      noBorderCell("Bloom's Level", { runOpts: { bold: true }, width: { size: 20, type: WidthType.PERCENTAGE } }),
    ],
  });

  const rows = courseOutcomes.map(
    (co) =>
      new TableRow({
        children: [
          noBorderCell(co.coNumber || '', { runOpts: { bold: true } }),
          noBorderCell(co.description || ''),
          noBorderCell(co.bloomsLevel || '', { runOpts: { bold: true }, alignment: AlignmentType.CENTER }),
        ],
      })
  );

  return new Table({ rows: [headerRow, ...rows], width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS });
}

function buildPoMappingTable(courseOutcomes) {
  const headerCells = ['CO', ...PO_KEYS].map((label) =>
    noBorderCell(label, { runOpts: { bold: true } })
  );
  const headerRow = new TableRow({ tableHeader: true, children: headerCells });

  const totals = Object.fromEntries(PO_KEYS.map((k) => [k, 0]));

  const rows = courseOutcomes.map((co) => {
    const mapping = co.poMapping || {};
    const cells = [noBorderCell(co.coNumber || '', { runOpts: { bold: true } })];
    for (const key of PO_KEYS) {
      const value = mapping[key];
      if (typeof value === 'number' && value > 0) totals[key] += value;
      cells.push(noBorderCell(value ? String(value) : '', { alignment: AlignmentType.CENTER }));
    }
    return new TableRow({ children: cells });
  });

  const totalsRow = new TableRow({
    children: [
      noBorderCell('', {}),
      ...PO_KEYS.map((key) =>
        noBorderCell(totals[key] > 0 ? String(totals[key]) : '', {
          runOpts: { bold: true },
          alignment: AlignmentType.CENTER,
        })
      ),
    ],
  });

  return new Table({ rows: [headerRow, ...rows, totalsRow], width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS });
}

function rightTabParagraph(runsBeforeTab, tailText, opts = {}) {
  return para([...runsBeforeTab, new TextRun({ text: '\t', font: FONT, size: SIZE }), run(tailText, { bold: true })], {
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    spacing: { after: 160 },
    ...opts,
  });
}

// One numbered TEXT BOOKS / REFERENCES line with the book title in italics,
// matching the master. formattedReference always wraps the title as
// `'Title'.` (see referenceFormatter.service.js's formatReference) — split
// around that exact substring rather than re-deriving the citation. The
// quotes and trailing period stay inside the italic run, per the master's
// styling. Falls back to today's single plain run when the title is missing
// or can't be located (legacy rows) — never throws.
function referenceParagraph(entry, index) {
  const formatted = entry.formattedReference || '';
  const quotedTitle = entry.title ? `'${entry.title}'.` : '';
  const at = quotedTitle ? formatted.indexOf(quotedTitle) : -1;
  const opts = { spacing: { after: 40 } };

  if (at === -1) {
    return para(run(`${index + 1}. ${formatted}`), opts);
  }

  return para(
    [
      run(`${index + 1}. ${formatted.slice(0, at)}`),
      run(quotedTitle, { italics: true }),
      run(formatted.slice(at + quotedTitle.length)),
    ],
    opts
  );
}

// Builds the "(Common to ...)" line text from the course's linked common-to
// departments (source of truth since the course_common_departments join
// table). Falls back to the legacy free-text common_to value for courses
// saved before the join table existed.
function commonToText(course) {
  const codes = (course.commonToDepartments || []).map((d) => d.code || d.name).filter(Boolean);
  if (codes.length === 0) return course.commonTo || '';
  if (codes.length === 1) return `Common to ${codes[0]}`;
  return `Common to ${codes.slice(0, -1).join(', ')} and ${codes[codes.length - 1]}`;
}

// Per-unit hours label matching the master exactly: "(9+3)" for a
// lecture+tutorial unit, "(9)" when there are no tutorial hours (e.g. a
// lab-only unit). Units saved before the lecture/tutorial split only carry
// the legacy `hours` field — treated as the lecture figure.
function unitHoursLabel(unit) {
  const lectureHours = unit.lectureHours ?? unit.hours;
  if (lectureHours == null) return '';
  const tutorialHours = unit.tutorialHours ?? 0;
  return tutorialHours > 0 ? `(${lectureHours}+${tutorialHours})` : `(${lectureHours})`;
}

function totalPeriodsLine(course) {
  const { totalLecturePeriods, totalTutorialPeriods, lectureHours, tutorialHours, practicalHours } = course;

  if (lectureHours === 0 && tutorialHours === 0 && practicalHours > 0) {
    // Fallback from practicalHours, NOT credits — credits already halves
    // practical hours, so credits * 15 would print half the real figure.
    const totalPractical = totalLecturePeriods || Math.round(Number(practicalHours) * 15) || 0;
    return `Total P: ${totalPractical} periods`;
  }

  if (totalLecturePeriods) {
    if (totalTutorialPeriods) {
      return `Total L: ${totalLecturePeriods} + T: ${totalTutorialPeriods} = ${totalLecturePeriods + totalTutorialPeriods} periods`;
    }
    return `Total L: ${totalLecturePeriods} periods`;
  }

  return '';
}

// Builds the full content (paragraphs/tables) for a single course, matching
// the master template's page layout. Does not include the page break —
// callers insert that between courses so the last course in a document
// doesn't end with a dangling blank page.
function buildCourseContent(course) {
  const content = [];

  content.push(
    para(run(`${course.courseCode} ${(course.courseTitle || '').toUpperCase()}`, { bold: true }), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    })
  );

  const commonLine = commonToText(course);
  if (commonLine) {
    content.push(
      para(run(`(${commonLine})`, { bold: true }), { alignment: AlignmentType.CENTER, spacing: { after: 60 } })
    );
  }

  // Descriptive mandatory course (Induction Programme / Activity Point
  // Programme style): category MC with no hours at all. The master prints
  // nothing but the title, the (Common to ...) line, and the description
  // paragraph — no LTPC line, no marks, no units, no book lists, no CO
  // tables. Graded mandatory courses (nonzero lecture/tutorial) fall
  // through to the normal unit-wise layout below.
  const isDescriptiveMandatory =
    course.category === 'MC' &&
    !(Number(course.lectureHours) || 0) &&
    !(Number(course.tutorialHours) || 0) &&
    !(Number(course.practicalHours) || 0);
  if (isDescriptiveMandatory) {
    if (course.introduction) {
      content.push(para(run(course.introduction), { spacing: { after: 120 } }));
    }
    return content;
  }

  // Experiment-list practicals (25CS111 style): the introduction column
  // holds one experiment per line, rendered exactly as typed (faculty write
  // their own numbering — no added bullet or dash); there are no
  // prerequisites or syllabus units in this shape.
  const isExperimentList = course.practicalFormat === 'experiment_list';

  content.push(
    para(run(`${course.lectureHours ?? 0} ${course.tutorialHours ?? 0} ${course.practicalHours ?? 0} ${course.credits ?? ''}`, { bold: true }), {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 160 },
    })
  );

  if (course.prerequisites && !isExperimentList) {
    content.push(
      para([run('Prerequisites: ', { bold: true }), run(course.prerequisites)], { spacing: { after: 120 } })
    );
  }

  if (course.introduction) {
    if (isExperimentList) {
      // Tight single-spaced list, same { after: 40 } the TEXT BOOKS /
      // REFERENCES entries use — one-line items, unlike the paragraph-length
      // syllabus units that get the larger 160 gap.
      for (const line of course.introduction.split(/\r?\n/)) {
        const experiment = line.trim();
        if (!experiment) continue;
        content.push(para(run(experiment), { spacing: { after: 40 } }));
      }
    } else {
      content.push(para(run(course.introduction), { spacing: { after: 120 } }));
    }
  }

  for (const unit of isExperimentList ? [] : course.syllabusUnits || []) {
    // Strip any trailing colon/whitespace the author typed — the ": " below
    // is always appended here, so a typed colon would double up.
    const heading = (unit.unitTitle || '').replace(/[:\s]+$/, '').toUpperCase();
    const leadRuns = [run(`${heading}${heading ? ': ' : ''}`, { bold: true }), run(unit.content || '')];
    content.push(
      rightTabParagraph(leadRuns, unitHoursLabel(unit), { alignment: AlignmentType.JUSTIFIED })
    );
  }

  const totalLine = totalPeriodsLine(course);
  if (totalLine) {
    content.push(para(run(totalLine, { bold: true }), { alignment: AlignmentType.RIGHT, spacing: { after: 200 } }));
  }

  const textbooks = (course.textbooks || []).filter((t) => t.bookType !== 'reference');
  const references = (course.textbooks || []).filter((t) => t.bookType === 'reference');

  if (textbooks.length) {
    content.push(para(run('TEXT BOOKS', { bold: true }), { spacing: { before: 120, after: 80 } }));
    textbooks.forEach((t, i) => content.push(referenceParagraph(t, i)));
  }

  if (references.length) {
    content.push(para(run('REFERENCES', { bold: true }), { spacing: { before: 120, after: 80 } }));
    references.forEach((r, i) => content.push(referenceParagraph(r, i)));
  }

  if ((course.courseOutcomes || []).length) {
    content.push(para(run('COURSE OUTCOMES', { bold: true }), { spacing: { before: 160, after: 80 } }));
    content.push(buildCourseOutcomesTable(course.courseOutcomes));

    content.push(para(run('COs-POs & PSOs MAPPING', { bold: true }), { spacing: { before: 160, after: 80 } }));
    content.push(buildPoMappingTable(course.courseOutcomes));

    content.push(para(run('1-low, 2-medium, 3-high', { bold: true }), { spacing: { before: 80 } }));
  }

  return content;
}

// ---------------------------------------------------------------------------
// Cover / title page (master doc page 1).
// ---------------------------------------------------------------------------

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'psg_logo.png');
let cachedLogo;

// Loaded lazily and cached so a missing asset degrades to a logo-less cover
// page instead of breaking every export at require time.
function loadLogo() {
  if (cachedLogo === undefined) {
    try {
      cachedLogo = fs.readFileSync(LOGO_PATH);
    } catch {
      cachedLogo = null;
    }
  }
  return cachedLogo;
}

// The opening cover page: institute identity, logo, regulations line, book
// title, and the department the book is for. Ends with the page break that
// separates it from the scheme tables. minCredits renders its line only when
// set — omitted entirely otherwise, never a placeholder or zero.
function buildCoverPage(departmentName, minCredits) {
  const children = [
    para(run('PSG INSTITUTE OF TECHNOLOGY AND APPLIED RESEARCH', { bold: true, size: 32 }), {
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 120 },
    }),
    para(run('COIMBATORE – 641 062', { size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
    para(run('(Autonomous college affiliated to Anna University)', { size: 24 }), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
  ];

  const logo = loadLogo();
  if (logo) {
    children.push(
      para(
        new ImageRun({
          type: 'png',
          data: logo,
          // ~0.95in x 1.17in at 96dpi (the asset's native size).
          transformation: { width: 91, height: 112 },
        }),
        { alignment: AlignmentType.CENTER, spacing: { after: 480 } }
      )
    );
  }

  children.push(
    para(run('2025 Regulations', { bold: true, size: 28 }), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    }),
    // TODO: derive this line from the semesters actually present in the
    // export — hardcoded for now to match the current curriculum book title.
    para(run('Scheme of Assessment and Syllabi for First, Second, Third and Fourth Semesters', { bold: true, size: 28 }), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
    para(run('for', { size: 24 }), { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    para(run(`B.E. ${departmentName}`, { bold: true, size: 32 }), {
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
    })
  );

  if (minCredits != null) {
    children.push(
      para(run(`(Minimum No. of credits to be earned: ${minCredits})`, { size: 24 }), {
        alignment: AlignmentType.CENTER,
      })
    );
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  return children;
}

// ---------------------------------------------------------------------------
// Semester-wise "scheme of examination" tables (master doc page 2): one block
// per department, one table per semester, printed before the syllabus pages.
// ---------------------------------------------------------------------------

const ROMAN_SEMESTERS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function romanSemester(semester) {
  return ROMAN_SEMESTERS[semester - 1] || String(semester);
}

// Numeric scheme-table cell value: null/undefined renders as '-' (e.g. a
// mandatory course with no marks), everything else via Number so Prisma
// Decimals like 4.00 print as "4".
function schemeNumber(value) {
  return value === null || value === undefined ? '-' : String(Number(value));
}

// Splits one semester's courses into the master's three labeled sub-sections.
// category 'MC' wins over the hours-based bucketing; PRACTICALS is lab-only
// (no lecture/tutorial hours); THEORY is everything else — including mixed
// lecture+practical courses, so no course is ever silently dropped.
function schemeSections(semesterCourses) {
  const sections = [
    { label: 'THEORY', courses: [] },
    { label: 'PRACTICALS', courses: [] },
    { label: 'MANDATORY COURSES', courses: [] },
  ];

  for (const course of semesterCourses) {
    const lecture = Number(course.lectureHours) || 0;
    const tutorial = Number(course.tutorialHours) || 0;
    const practical = Number(course.practicalHours) || 0;

    if (course.category === 'MC') sections[2].courses.push(course);
    else if (lecture === 0 && tutorial === 0 && practical > 0) sections[1].courses.push(course);
    else sections[0].courses.push(course);
  }

  return sections.filter((s) => s.courses.length > 0);
}

// Column widths (percent) for the 11 physical columns:
// S.No | Code | Title | L | T | P | Credits | CA | ESE | Total | CAT
const SCHEME_WIDTHS = [6, 12, 30, 6, 6, 6, 7, 7, 7, 7, 6];
const SCHEME_COLUMNS = 11;

function schemeWidth(index) {
  return { size: SCHEME_WIDTHS[index], type: WidthType.PERCENTAGE };
}

// One SEPARATE table per semester, matching the reference document: each
// semester repeats its own two-row column header, followed by a full-width
// left-aligned "SEMESTER <roman>" row inside the table, then the
// section-label/course rows and the totals row.
function buildSemesterSchemeTable(semester, semesterCourses) {
  const bold = { runOpts: { bold: true }, alignment: AlignmentType.CENTER };
  // Semester and section label rows are LEFT-aligned in the reference —
  // only header cells and numeric totals stay centered.
  const labelRow = { runOpts: { bold: true }, alignment: AlignmentType.LEFT };

  // Two-row header: label cells span both rows; "Hours / Week" and
  // "Maximum Marks" span their 3 sub-columns on row one, with the sub-column
  // labels on row two.
  const headerRowOne = new TableRow({
    tableHeader: true,
    children: [
      noBorderCell('S. No.', { ...bold, rowSpan: 2, width: schemeWidth(0) }),
      noBorderCell('Course Code', { ...bold, rowSpan: 2, width: schemeWidth(1) }),
      noBorderCell('Course Title', { ...bold, rowSpan: 2, width: schemeWidth(2) }),
      noBorderCell('Hours / Week', { ...bold, columnSpan: 3 }),
      noBorderCell('Credits', { ...bold, rowSpan: 2, width: schemeWidth(6) }),
      noBorderCell('Maximum Marks', { ...bold, columnSpan: 3 }),
      noBorderCell('CAT', { ...bold, rowSpan: 2, width: schemeWidth(10) }),
    ],
  });
  const headerRowTwo = new TableRow({
    tableHeader: true,
    children: [
      noBorderCell('Lecture', { ...bold, width: schemeWidth(3) }),
      noBorderCell('Tutorial', { ...bold, width: schemeWidth(4) }),
      noBorderCell('Practical', { ...bold, width: schemeWidth(5) }),
      noBorderCell('CA', { ...bold, width: schemeWidth(7) }),
      noBorderCell('ESE', { ...bold, width: schemeWidth(8) }),
      noBorderCell('Total', { ...bold, width: schemeWidth(9) }),
    ],
  });

  const rows = [
    headerRowOne,
    headerRowTwo,
    new TableRow({
      children: [noBorderCell(`SEMESTER ${romanSemester(semester)}`, { ...labelRow, columnSpan: SCHEME_COLUMNS })],
    }),
  ];
  const totals = { lecture: 0, tutorial: 0, practical: 0, credits: 0, ca: 0, ese: 0, total: 0 };

  for (const section of schemeSections(semesterCourses)) {
    rows.push(
      new TableRow({
        children: [noBorderCell(section.label, { ...labelRow, columnSpan: SCHEME_COLUMNS })],
      })
    );

    section.courses.forEach((course, i) => {
      totals.lecture += Number(course.lectureHours) || 0;
      totals.tutorial += Number(course.tutorialHours) || 0;
      totals.practical += Number(course.practicalHours) || 0;
      totals.credits += Number(course.credits) || 0;
      totals.ca += Number(course.caMarks) || 0;
      totals.ese += Number(course.eseMarks) || 0;
      totals.total += Number(course.totalMarks) || 0;

      rows.push(
        new TableRow({
          children: [
            // S. No. restarts at 1 within each section, like the master.
            noBorderCell(String(i + 1), { alignment: AlignmentType.CENTER, width: schemeWidth(0) }),
            noBorderCell(course.courseCode || '', { alignment: AlignmentType.CENTER, width: schemeWidth(1) }),
            noBorderCell(course.courseTitle || '', { width: schemeWidth(2) }),
            noBorderCell(schemeNumber(course.lectureHours), { alignment: AlignmentType.CENTER, width: schemeWidth(3) }),
            noBorderCell(schemeNumber(course.tutorialHours), { alignment: AlignmentType.CENTER, width: schemeWidth(4) }),
            noBorderCell(schemeNumber(course.practicalHours), { alignment: AlignmentType.CENTER, width: schemeWidth(5) }),
            noBorderCell(schemeNumber(course.credits), { alignment: AlignmentType.CENTER, width: schemeWidth(6) }),
            noBorderCell(schemeNumber(course.caMarks), { alignment: AlignmentType.CENTER, width: schemeWidth(7) }),
            noBorderCell(schemeNumber(course.eseMarks), { alignment: AlignmentType.CENTER, width: schemeWidth(8) }),
            noBorderCell(schemeNumber(course.totalMarks), { alignment: AlignmentType.CENTER, width: schemeWidth(9) }),
            noBorderCell(course.category || '', { alignment: AlignmentType.CENTER, width: schemeWidth(10) }),
          ],
        })
      );
    });
  }

  const totalPeriods = totals.lecture + totals.tutorial + totals.practical;
  rows.push(
    new TableRow({
      children: [
        noBorderCell(`Total ${totalPeriods} periods`, { ...bold, columnSpan: 3 }),
        noBorderCell(String(totals.lecture), bold),
        noBorderCell(String(totals.tutorial), bold),
        noBorderCell(String(totals.practical), bold),
        noBorderCell(String(Number(totals.credits.toFixed(2))), bold),
        noBorderCell(String(totals.ca), bold),
        noBorderCell(String(totals.ese), bold),
        noBorderCell(String(totals.total), bold),
        noBorderCell('', {}),
      ],
    })
  );

  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE }, borders: TABLE_BORDERS });
}

// One block per department (title + one scheme table per semester), each
// department starting on a new page. Courses with no semester are excluded
// from the tables (they still get their normal syllabus page).
function buildSchemeBlocks(courses) {
  const withSemester = courses.filter((c) => c.semester != null);
  if (withSemester.length === 0) return [];

  // Group by department preserving the input order (already sorted
  // department, semester, course_code by the caller — don't re-sort).
  const departmentOrder = [];
  const byDepartment = new Map();
  for (const course of withSemester) {
    const key = course.departmentName || '';
    if (!byDepartment.has(key)) {
      byDepartment.set(key, []);
      departmentOrder.push(key);
    }
    byDepartment.get(key).push(course);
  }

  const children = [];
  departmentOrder.forEach((departmentName, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

    const departmentCourses = byDepartment.get(departmentName);

    children.push(
      para(run(`B.E. ${departmentName.toUpperCase()}`.trim(), { bold: true }), {
        alignment: AlignmentType.CENTER,
        spacing: { after: 160 },
      })
    );

    // "(Minimum No. of credits to be earned: N)" — from departments.min_credits,
    // carried per course as departmentMinCredits; omitted entirely when unset.
    const minCredits = departmentCourses[0]?.departmentMinCredits;
    if (minCredits != null) {
      children.push(
        para(run(`(Minimum No. of credits to be earned: ${minCredits})`), {
          alignment: AlignmentType.CENTER,
          spacing: { after: 160 },
        })
      );
    }
    // One separate table per semester, each with its own repeated header —
    // the "SEMESTER X" label is a row inside its table, not a paragraph.
    const semesterOrder = [...new Set(departmentCourses.map((c) => c.semester))];
    for (const semester of semesterOrder) {
      children.push(buildSemesterSchemeTable(semester, departmentCourses.filter((c) => c.semester === semester)));
      // Tables can't carry spacing themselves — a small spacer keeps
      // consecutive semester tables from visually colliding.
      children.push(para(run(''), { spacing: { after: 160 } }));
    }
  });

  return children;
}

// The master's header shows the fixed curriculum revision date (e.g.
// 23.03.2026), not the export date — today's date is only a fallback for
// departments that haven't set one yet.
function buildHeader(revisionDate) {
  const dateText = revisionDate ? dateFormatted(new Date(revisionDate)) : todayFormatted();
  return new Header({
    children: [para(run(dateText, { size: 16 }), { alignment: AlignmentType.RIGHT })],
  });
}

function buildFooter() {
  return new Footer({
    children: [
      para([run('', { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16 })], {
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

// Public entry point: one or many courses -> a single .docx Buffer, each
// course starting on its own page. When includeSemesterSummary is true (the
// default, used by the Download Center exports) the document opens with the
// semester-wise scheme tables; single-course task previews pass false since
// one course out of context isn't a curriculum book.
async function generateCoursesDocx(courses, { revisionDate = null, includeSemesterSummary = true } = {}) {
  const children = [];

  if (includeSemesterSummary) {
    // Cover page for the department the book is for (the first department in
    // the already-sorted input — the only one on scoped exports). Skipped, like
    // the scheme tables, on single-course task previews.
    if (courses[0]?.departmentName) {
      children.push(...buildCoverPage(courses[0].departmentName, courses[0].departmentMinCredits ?? null));
    }

    const schemeBlocks = buildSchemeBlocks(courses);
    if (schemeBlocks.length) {
      children.push(...schemeBlocks);
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  courses.forEach((course, index) => {
    if (index > 0) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...buildCourseContent(course));
  });

  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: MARGIN } },
        headers: { default: buildHeader(revisionDate) },
        footers: { default: buildFooter() },
        children,
      },
    ],
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } },
      },
    },
  });

  return Packer.toBuffer(doc);
}

module.exports = { generateCoursesDocx, buildCourseContent, totalPeriodsLine };
