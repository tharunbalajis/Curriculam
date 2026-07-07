const {
  Document,
  Paragraph,
  TextRun,
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
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      noBorderCell('', { runOpts: { bold: true }, width: { size: 8, type: WidthType.PERCENTAGE } }),
      noBorderCell('At the end of the course, students will be able to:', {
        runOpts: { bold: true },
        width: { size: 72, type: WidthType.PERCENTAGE },
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
          noBorderCell(co.bloomsLevel || ''),
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
  const { totalLecturePeriods, totalTutorialPeriods, lectureHours, tutorialHours, practicalHours, credits } = course;

  if (lectureHours === 0 && tutorialHours === 0 && practicalHours > 0) {
    const totalPractical = totalLecturePeriods || Math.round(Number(credits) * 15) || 0;
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

  content.push(
    para(run(`${course.lectureHours ?? 0} ${course.tutorialHours ?? 0} ${course.practicalHours ?? 0} ${course.credits ?? ''}`, { bold: true }), {
      alignment: AlignmentType.RIGHT,
      spacing: { after: 160 },
    })
  );

  if (course.prerequisites) {
    content.push(
      para([run('Prerequisites: ', { bold: true }), run(course.prerequisites)], { spacing: { after: 120 } })
    );
  }

  if (course.introduction) {
    content.push(para(run(course.introduction), { spacing: { after: 120 } }));
  }

  for (const unit of course.syllabusUnits || []) {
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
    textbooks.forEach((t, i) => {
      content.push(para(run(`${i + 1}. ${t.formattedReference || ''}`), { spacing: { after: 40 } }));
    });
  }

  if (references.length) {
    content.push(para(run('REFERENCES', { bold: true }), { spacing: { before: 120, after: 80 } }));
    references.forEach((r, i) => {
      content.push(para(run(`${i + 1}. ${r.formattedReference || ''}`), { spacing: { after: 40 } }));
    });
  }

  if ((course.courseOutcomes || []).length) {
    content.push(para(run('COURSE OUTCOMES', { bold: true }), { spacing: { before: 160, after: 80 } }));
    content.push(buildCourseOutcomesTable(course.courseOutcomes));

    content.push(para(run('COs-POs & PSOs MAPPING', { bold: true }), { spacing: { before: 160, after: 80 } }));
    content.push(buildPoMappingTable(course.courseOutcomes));

    content.push(para(run('1-low, 2-medium, 3-high', { italics: true }), { spacing: { before: 80 } }));
  }

  return content;
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
// course starting on its own page.
async function generateCoursesDocx(courses, { revisionDate = null } = {}) {
  const children = [];

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
