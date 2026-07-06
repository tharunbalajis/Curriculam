const PDFDocument = require('pdfkit');

const FONT_SIZE = 10;
const PO_KEYS = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2'];

// cm -> points (1cm = 28.3465pt), matching the docx generator's twip-exact
// 1cm top/bottom, 2.54cm (1 inch) left/right margins.
const MARGIN = { top: 28, bottom: 28, left: 72, right: 72 };

function todayFormatted() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
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

function drawSimpleTable(doc, { headers, rows, columnWidths }) {
  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const widths = columnWidths || headers.map(() => usableWidth / headers.length);

  function drawRow(cells, opts = {}) {
    const y = doc.y;
    let x = startX;
    const heights = cells.map((cell, i) => doc.heightOfString(cell, { width: widths[i] - 8 }));
    const rowHeight = Math.max(...heights, 14) + 6;

    cells.forEach((cell, i) => {
      doc.rect(x, y, widths[i], rowHeight).stroke();
      doc.font(opts.bold ? 'Times-Bold' : 'Times-Roman').fontSize(FONT_SIZE);
      doc.text(cell, x + 4, y + 3, { width: widths[i] - 8, align: opts.align || 'left' });
      x += widths[i];
    });

    doc.y = y + rowHeight;
  }

  drawRow(headers, { bold: true });
  rows.forEach((r) => drawRow(r));
}

function renderCourse(doc, course, isFirst) {
  if (!isFirst) doc.addPage();

  doc.font('Times-Roman').fontSize(8).text(todayFormatted(), { align: 'right' });
  doc.moveDown(0.5);

  doc.font('Times-Bold').fontSize(FONT_SIZE);
  doc.text(`${course.courseCode} ${(course.courseTitle || '').toUpperCase()}`, { align: 'center' });

  if (course.commonTo) {
    doc.font('Times-Roman').fontSize(FONT_SIZE);
    doc.text(`(${course.commonTo})`, { align: 'center' });
  }

  doc.font('Times-Bold').fontSize(FONT_SIZE);
  doc.text(
    `${course.lectureHours ?? 0} ${course.tutorialHours ?? 0} ${course.practicalHours ?? 0} ${course.credits ?? ''}`,
    { align: 'right' }
  );
  doc.moveDown(0.5);

  doc.font('Times-Roman').fontSize(FONT_SIZE);

  if (course.prerequisites) {
    doc.font('Times-Bold').text('Prerequisites: ', { continued: true }).font('Times-Roman').text(course.prerequisites);
    doc.moveDown(0.3);
  }

  if (course.introduction) {
    doc.text(course.introduction);
    doc.moveDown(0.3);
  }

  for (const unit of course.syllabusUnits || []) {
    const heading = (unit.unitTitle || '').toUpperCase();
    const hoursText = unit.hours != null ? ` (${unit.hours})` : '';
    doc
      .font('Times-Bold')
      .text(`${heading}${heading ? ': ' : ''}`, { continued: true })
      .font('Times-Roman')
      .text(`${unit.content || ''}${hoursText}`);
    doc.moveDown(0.3);
  }

  const totalLine = totalPeriodsLine(course);
  if (totalLine) {
    doc.font('Times-Bold').text(totalLine, { align: 'right' });
    doc.moveDown(0.5);
  }

  const textbooks = (course.textbooks || []).filter((t) => t.bookType !== 'reference');
  const references = (course.textbooks || []).filter((t) => t.bookType === 'reference');

  if (textbooks.length) {
    doc.font('Times-Bold').text('TEXT BOOKS');
    doc.font('Times-Roman');
    textbooks.forEach((t, i) => doc.text(`${i + 1}. ${t.formattedReference || ''}`));
    doc.moveDown(0.3);
  }

  if (references.length) {
    doc.font('Times-Bold').text('REFERENCES');
    doc.font('Times-Roman');
    references.forEach((r, i) => doc.text(`${i + 1}. ${r.formattedReference || ''}`));
    doc.moveDown(0.3);
  }

  if ((course.courseOutcomes || []).length) {
    doc.moveDown(0.3);
    doc.font('Times-Bold').text('COURSE OUTCOMES');
    doc.moveDown(0.2);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    drawSimpleTable(doc, {
      headers: ['CO', 'At the end of the course, students will be able to:', "Bloom's Level"],
      rows: course.courseOutcomes.map((co) => [co.coNumber || '', co.description || '', co.bloomsLevel || '']),
      columnWidths: [usableWidth * 0.08, usableWidth * 0.72, usableWidth * 0.2],
    });

    doc.moveDown(0.5);
    doc.font('Times-Bold').text('COs-POs & PSOs MAPPING');
    doc.moveDown(0.2);

    const totals = Object.fromEntries(PO_KEYS.map((k) => [k, 0]));
    const mappingRows = course.courseOutcomes.map((co) => {
      const mapping = co.poMapping || {};
      return [
        co.coNumber || '',
        ...PO_KEYS.map((key) => {
          const value = mapping[key];
          if (typeof value === 'number' && value > 0) totals[key] += value;
          return value ? String(value) : '';
        }),
      ];
    });
    mappingRows.push(['', ...PO_KEYS.map((key) => (totals[key] > 0 ? String(totals[key]) : ''))]);

    const colWidth = usableWidth / (PO_KEYS.length + 1);
    drawSimpleTable(doc, {
      headers: ['CO', ...PO_KEYS],
      rows: mappingRows,
      columnWidths: Array(PO_KEYS.length + 1).fill(colWidth),
    });

    doc.moveDown(0.3);
    doc.font('Times-Italic').fontSize(8).text('1-low, 2-medium, 3-high');
  }
}

async function generateCoursesPdf(courses) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: MARGIN, bufferPages: true });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Times-Roman').fontSize(FONT_SIZE);

    courses.forEach((course, index) => renderCourse(doc, course, index === 0));

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Times-Roman').fontSize(8).text(`${i + 1}`, 0, doc.page.height - 40, { align: 'center' });
    }

    doc.end();
  });
}

module.exports = { generateCoursesPdf };
