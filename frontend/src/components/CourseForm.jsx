function computeCredits(lectureHours, tutorialHours, practicalHours) {
  const l = Number(lectureHours) || 0;
  const t = Number(tutorialHours) || 0;
  const p = Number(practicalHours) || 0;
  return l + t + p / 2;
}

function computeTotalMarks(caMarks, eseMarks) {
  const ca = Number(caMarks) || 0;
  const ese = Number(eseMarks) || 0;
  return ca + ese;
}

// Mirrors backend/src/services/periodsCalculator.js exactly. Periods are a
// pure display-derived value on top of `credits` — not new source data —
// so there's no API call for this; it's recomputed client-side from the
// same credits the LTPC fields already produce.
function calculatePeriods(credits, unitCount = 5) {
  const totalPeriods = Number(credits) * 15;
  const periodsPerUnit = Math.round(totalPeriods / unitCount);
  return { totalPeriods, periodsPerUnit };
}

const CATEGORIES = ['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'];
const PO_PSO_KEYS = ['PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10', 'PO11', 'PSO1', 'PSO2'];

function Field({ label, required = false, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

// Textbooks and references live in the same underlying `textbooks` array
// (the DB table distinguishes them with a `book_type` column — that's the
// given schema, not something worth adding a second table for) but they are
// always authored, numbered, and displayed as two fully separate lists so
// they never visually or logically merge.
function renumberBookEntries(items) {
  let textbookCount = 0;
  let referenceCount = 0;
  return items.map((item) => {
    if (item.bookType === 'reference') {
      referenceCount += 1;
      return { ...item, sequenceNumber: referenceCount };
    }
    textbookCount += 1;
    return { ...item, sequenceNumber: textbookCount };
  });
}

function BookEntryCard({ label, book, onUpdate, onRemove, readOnly }) {
  return (
    <div className="border border-slate-200 rounded-md p-4 space-y-3 bg-white shadow-sm animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
        {!readOnly && (
          <button type="button" className="text-sm text-red-600 hover:underline" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>
      <Field label="Author(s) (comma-separated)">
        <input
          className={inputClass}
          value={(book.authors || []).join(', ')}
          disabled={readOnly}
          onChange={(e) =>
            onUpdate({ authors: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })
          }
        />
      </Field>
      <Field label="Title" required>
        <input
          className={inputClass}
          value={book.title || ''}
          disabled={readOnly}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Field label="Edition">
          <input
            className={inputClass}
            value={book.edition || ''}
            disabled={readOnly}
            onChange={(e) => onUpdate({ edition: e.target.value })}
          />
        </Field>
        <Field label="Publisher">
          <input
            className={inputClass}
            value={book.publisher || ''}
            disabled={readOnly}
            onChange={(e) => onUpdate({ publisher: e.target.value })}
          />
        </Field>
        <Field label="Place">
          <input
            className={inputClass}
            value={book.place || ''}
            disabled={readOnly}
            onChange={(e) => onUpdate({ place: e.target.value })}
          />
        </Field>
        <Field label="Year">
          <input
            type="number"
            className={inputClass}
            value={book.year ?? ''}
            disabled={readOnly}
            onChange={(e) => onUpdate({ year: Number(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}

function BookEntrySection({ title, bookType, entries, onAdd, onUpdate, onRemove, readOnly, emptyLabel }) {
  const scrollable = entries.length > 3 ? 'max-h-[32rem] overflow-y-auto pr-1' : '';

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-800 uppercase tracking-wide">{title}</h3>
        {!readOnly && (
          <button type="button" className="text-sm text-blue-600 hover:underline" onClick={() => onAdd(bookType)}>
            + Add {bookType === 'reference' ? 'Reference' : 'Textbook'}
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400 italic">{emptyLabel}</p>
      ) : (
        <div className={`space-y-4 ${scrollable}`}>
          {entries.map((entry, i) => (
            <BookEntryCard
              key={entry._idx}
              label={`${bookType === 'reference' ? 'Reference' : 'Textbook'} ${i + 1}`}
              book={entry}
              readOnly={readOnly}
              onUpdate={(updates) => onUpdate(entry._idx, updates)}
              onRemove={() => onRemove(entry._idx)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function CourseForm({ course, onChange, disabledFields = [], readOnly = false }) {
  const isDisabled = (field) => readOnly || disabledFields.includes(field);

  function set(field, value) {
    onChange({ ...course, [field]: value });
  }

  function setArrayItem(field, index, updates) {
    const items = [...(course[field] || [])];
    items[index] = { ...items[index], ...updates };
    onChange({ ...course, [field]: items });
  }

  function addArrayItem(field, blank) {
    onChange({ ...course, [field]: [...(course[field] || []), blank] });
  }

  function removeArrayItem(field, index) {
    const items = [...(course[field] || [])];
    items.splice(index, 1);
    onChange({ ...course, [field]: items });
  }

  function addBookEntry(bookType) {
    const items = [
      ...(course.textbooks || []),
      { bookType, authors: [], title: '', edition: '', publisher: '', place: '', year: new Date().getFullYear() },
    ];
    onChange({ ...course, textbooks: renumberBookEntries(items) });
  }

  function updateBookEntry(idx, updates) {
    const items = [...(course.textbooks || [])];
    items[idx] = { ...items[idx], ...updates };
    onChange({ ...course, textbooks: renumberBookEntries(items) });
  }

  function removeBookEntry(idx) {
    const items = [...(course.textbooks || [])];
    items.splice(idx, 1);
    onChange({ ...course, textbooks: renumberBookEntries(items) });
  }

  const credits = computeCredits(course.lectureHours, course.tutorialHours, course.practicalHours);
  const totalMarks = computeTotalMarks(course.caMarks, course.eseMarks);
  const unitCount = course.syllabusUnits?.length || 5;
  const { totalPeriods, periodsPerUnit } = calculatePeriods(credits, unitCount);

  // Live-computed from the per-unit hour splits, same pattern as Credits and
  // Total Marks above — these are never typed in directly. Units saved before
  // the lecture/tutorial split only carry the legacy `hours` field, which
  // recorded the lecture figure.
  const totalLecturePeriods = (course.syllabusUnits || []).reduce(
    (sum, u) => sum + (Number(u.lectureHours ?? u.hours) || 0),
    0
  );
  const totalTutorialPeriods = (course.syllabusUnits || []).reduce(
    (sum, u) => sum + (Number(u.tutorialHours) || 0),
    0
  );

  const allBookEntries = (course.textbooks || []).map((t, idx) => ({ ...t, _idx: idx }));
  const textbookEntries = allBookEntries.filter((t) => t.bookType !== 'reference');
  const referenceEntries = allBookEntries.filter((t) => t.bookType === 'reference');

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Course Code">
          <input
            className={inputClass}
            value={course.courseCode || ''}
            disabled={isDisabled('courseCode')}
            onChange={(e) => set('courseCode', e.target.value)}
          />
        </Field>
        <Field label="Course Title">
          <input
            className={inputClass}
            value={course.courseTitle || ''}
            disabled={isDisabled('courseTitle')}
            onChange={(e) => set('courseTitle', e.target.value)}
          />
        </Field>
        <Field label="Academic Year">
          <input
            className={inputClass}
            value={course.academicYear || ''}
            disabled={isDisabled('academicYear')}
            onChange={(e) => set('academicYear', e.target.value)}
          />
        </Field>
        <Field label="Semester">
          <input
            type="number"
            min={1}
            max={8}
            className={inputClass}
            value={course.semester ?? ''}
            disabled={isDisabled('semester')}
            onChange={(e) => set('semester', Number(e.target.value))}
          />
        </Field>
        <Field label="Category">
          <select
            className={inputClass}
            value={course.category || ''}
            disabled={isDisabled('category')}
            onChange={(e) => set('category', e.target.value)}
          >
            <option value="">Select category</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Common To (departments)">
          {/* Identity metadata chosen by top_admin at creation via the
              department picker — always read-only here. Legacy courses that
              predate the picker fall back to their stored free text. */}
          <div className="w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm min-h-[2.4rem]">
            {(course.commonToDepartments || []).length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {course.commonToDepartments.map((d) => (
                  <span
                    key={d.id}
                    className="inline-flex items-center rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-xs text-blue-800"
                  >
                    {d.code}
                  </span>
                ))}
              </span>
            ) : course.commonTo ? (
              <span className="text-slate-700">{course.commonTo}</span>
            ) : (
              <span className="text-slate-400">Not common to any other department</span>
            )}
          </div>
        </Field>
      </section>

      <section>
        <Field label="Prerequisites">
          <textarea
            rows={2}
            className={inputClass}
            value={course.prerequisites || ''}
            disabled={isDisabled('prerequisites')}
            onChange={(e) => set('prerequisites', e.target.value)}
          />
        </Field>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-3">LTPC</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Field label="Lecture Hours">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={course.lectureHours ?? 0}
              disabled={isDisabled('lectureHours')}
              onChange={(e) => set('lectureHours', Number(e.target.value))}
            />
          </Field>
          <Field label="Tutorial Hours">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={course.tutorialHours ?? 0}
              disabled={isDisabled('tutorialHours')}
              onChange={(e) => set('tutorialHours', Number(e.target.value))}
            />
          </Field>
          <Field label="Practical Hours">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={course.practicalHours ?? 0}
              disabled={isDisabled('practicalHours')}
              onChange={(e) => set('practicalHours', Number(e.target.value))}
            />
          </Field>
          <Field label="Credits (computed)">
            <input className={inputClass} value={credits} disabled readOnly />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-3">Marks</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="CA Marks">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={course.caMarks ?? 0}
              disabled={isDisabled('caMarks')}
              onChange={(e) => set('caMarks', Number(e.target.value))}
            />
          </Field>
          <Field label="ESE Marks">
            <input
              type="number"
              min={0}
              className={inputClass}
              value={course.eseMarks ?? 0}
              disabled={isDisabled('eseMarks')}
              onChange={(e) => set('eseMarks', Number(e.target.value))}
            />
          </Field>
          <Field label="Total Marks (computed)">
            <input className={inputClass} value={totalMarks} disabled readOnly />
          </Field>
        </div>
      </section>

      <section>
        <Field label="Introduction">
          <textarea
            rows={3}
            className={inputClass}
            value={course.introduction || ''}
            disabled={isDisabled('introduction')}
            onChange={(e) => set('introduction', e.target.value)}
          />
        </Field>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Total Lecture Periods (computed from units)">
          <input className={inputClass} value={totalLecturePeriods} disabled readOnly />
        </Field>
        <Field label="Total Tutorial Periods (computed from units)">
          <input className={inputClass} value={totalTutorialPeriods} disabled readOnly />
        </Field>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-800">Syllabus Units</h3>
          {!readOnly && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() =>
                addArrayItem('syllabusUnits', {
                  unitNumber: (course.syllabusUnits?.length || 0) + 1,
                  unitTitle: '',
                  content: '',
                  lectureHours: 0,
                  tutorialHours: 0,
                })
              }
            >
              + Add unit
            </button>
          )}
        </div>
        <div className={`space-y-4 ${(course.syllabusUnits || []).length > 3 ? 'max-h-[32rem] overflow-y-auto pr-1' : ''}`}>
          {(course.syllabusUnits || []).map((unit, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-4 space-y-3 bg-white shadow-sm animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Field label="Unit #">
                  <input
                    type="number"
                    className={inputClass}
                    value={unit.unitNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { unitNumber: Number(e.target.value) })}
                  />
                </Field>
                <Field label={`Unit Title (≈${periodsPerUnit} periods)`}>
                  <input
                    className={inputClass}
                    placeholder="Just the topic name — no colon needed, it's added automatically"
                    title="Just the topic name — no colon needed, it's added automatically"
                    value={unit.unitTitle || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { unitTitle: e.target.value })}
                  />
                </Field>
                <Field label="Lecture Hrs">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={unit.lectureHours ?? unit.hours ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { lectureHours: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Tutorial Hrs">
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={unit.tutorialHours ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { tutorialHours: Number(e.target.value) })}
                  />
                </Field>
                {!readOnly && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeArrayItem('syllabusUnits', idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <Field label="Content" required>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={unit.content || ''}
                  disabled={readOnly}
                  onChange={(e) => setArrayItem('syllabusUnits', idx, { content: e.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Total Periods: <span className="font-medium text-slate-700">{totalPeriods}</span>
        </p>
      </section>

      <BookEntrySection
        title="Text Books"
        bookType="textbook"
        entries={textbookEntries}
        onAdd={addBookEntry}
        onUpdate={updateBookEntry}
        onRemove={removeBookEntry}
        readOnly={readOnly}
        emptyLabel="No textbooks added yet."
      />

      <BookEntrySection
        title="References"
        bookType="reference"
        entries={referenceEntries}
        onAdd={addBookEntry}
        onUpdate={updateBookEntry}
        onRemove={removeBookEntry}
        readOnly={readOnly}
        emptyLabel="No references added yet."
      />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-800">Course Outcomes</h3>
          {!readOnly && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() =>
                addArrayItem('courseOutcomes', {
                  coNumber: `CO${(course.courseOutcomes?.length || 0) + 1}`,
                  description: '',
                  bloomsLevel: '',
                  sequenceNumber: (course.courseOutcomes?.length || 0) + 1,
                })
              }
            >
              + Add outcome
            </button>
          )}
        </div>
        <div className={`space-y-4 ${(course.courseOutcomes || []).length > 3 ? 'max-h-[32rem] overflow-y-auto pr-1' : ''}`}>
          {(course.courseOutcomes || []).map((outcome, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-4 space-y-3 bg-white shadow-sm animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="CO Number">
                  <input
                    className={inputClass}
                    value={outcome.coNumber || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('courseOutcomes', idx, { coNumber: e.target.value })}
                  />
                </Field>
                <Field label="Bloom's Level">
                  <input
                    className={inputClass}
                    value={outcome.bloomsLevel || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('courseOutcomes', idx, { bloomsLevel: e.target.value })}
                  />
                </Field>
                <Field label="Sequence #">
                  <input
                    type="number"
                    className={inputClass}
                    value={outcome.sequenceNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('courseOutcomes', idx, { sequenceNumber: Number(e.target.value) })}
                  />
                </Field>
                {!readOnly && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeArrayItem('courseOutcomes', idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <Field label="Description" required>
                <textarea
                  rows={2}
                  className={inputClass}
                  value={outcome.description || ''}
                  disabled={readOnly}
                  onChange={(e) => setArrayItem('courseOutcomes', idx, { description: e.target.value })}
                />
              </Field>
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  PO / PSO Mapping (1-low, 2-medium, 3-high)
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {PO_PSO_KEYS.map((key) => (
                    <label key={key} className="block">
                      <span className="block text-xs text-slate-500 mb-0.5">{key}</span>
                      <select
                        className={inputClass}
                        value={outcome.poMapping?.[key] ?? ''}
                        disabled={readOnly}
                        onChange={(e) =>
                          setArrayItem('courseOutcomes', idx, {
                            poMapping: {
                              ...outcome.poMapping,
                              [key]: e.target.value ? Number(e.target.value) : null,
                            },
                          })
                        }
                      >
                        <option value="">-</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                      </select>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
