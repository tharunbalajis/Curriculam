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

const CATEGORIES = ['BS', 'HS', 'ES', 'PC', 'PE', 'OE', 'EEC', 'MC'];

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

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

  const credits = computeCredits(course.lectureHours, course.tutorialHours, course.practicalHours);
  const totalMarks = computeTotalMarks(course.caMarks, course.eseMarks);

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
        <Field label="Total Lecture Periods">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={course.totalLecturePeriods ?? ''}
            disabled={isDisabled('totalLecturePeriods')}
            onChange={(e) => set('totalLecturePeriods', Number(e.target.value))}
          />
        </Field>
        <Field label="Total Tutorial Periods">
          <input
            type="number"
            min={0}
            className={inputClass}
            value={course.totalTutorialPeriods ?? ''}
            disabled={isDisabled('totalTutorialPeriods')}
            onChange={(e) => set('totalTutorialPeriods', Number(e.target.value))}
          />
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
                  hours: 0,
                })
              }
            >
              + Add unit
            </button>
          )}
        </div>
        <div className="space-y-4">
          {(course.syllabusUnits || []).map((unit, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Unit #">
                  <input
                    type="number"
                    className={inputClass}
                    value={unit.unitNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { unitNumber: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Unit Title">
                  <input
                    className={inputClass}
                    value={unit.unitTitle || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { unitTitle: e.target.value })}
                  />
                </Field>
                <Field label="Hours">
                  <input
                    type="number"
                    className={inputClass}
                    value={unit.hours ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('syllabusUnits', idx, { hours: Number(e.target.value) })}
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
              <Field label="Content">
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
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-800">Textbooks &amp; References</h3>
          {!readOnly && (
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() =>
                addArrayItem('textbooks', {
                  bookType: 'textbook',
                  sequenceNumber: (course.textbooks?.length || 0) + 1,
                  authors: [],
                  title: '',
                  edition: '',
                  publisher: '',
                  place: '',
                  year: new Date().getFullYear(),
                })
              }
            >
              + Add textbook / reference
            </button>
          )}
        </div>
        <div className="space-y-4">
          {(course.textbooks || []).map((book, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Type">
                  <select
                    className={inputClass}
                    value={book.bookType || 'textbook'}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { bookType: e.target.value })}
                  >
                    <option value="textbook">Textbook</option>
                    <option value="reference">Reference</option>
                  </select>
                </Field>
                <Field label="Sequence #">
                  <input
                    type="number"
                    className={inputClass}
                    value={book.sequenceNumber ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { sequenceNumber: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Year">
                  <input
                    type="number"
                    className={inputClass}
                    value={book.year ?? ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { year: Number(e.target.value) })}
                  />
                </Field>
                {!readOnly && (
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="text-sm text-red-600 hover:underline"
                      onClick={() => removeArrayItem('textbooks', idx)}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <Field label="Authors (comma-separated)">
                <input
                  className={inputClass}
                  value={(book.authors || []).join(', ')}
                  disabled={readOnly}
                  onChange={(e) =>
                    setArrayItem('textbooks', idx, {
                      authors: e.target.value.split(',').map((a) => a.trim()).filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="Title">
                <input
                  className={inputClass}
                  value={book.title || ''}
                  disabled={readOnly}
                  onChange={(e) => setArrayItem('textbooks', idx, { title: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Edition">
                  <input
                    className={inputClass}
                    value={book.edition || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { edition: e.target.value })}
                  />
                </Field>
                <Field label="Publisher">
                  <input
                    className={inputClass}
                    value={book.publisher || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { publisher: e.target.value })}
                  />
                </Field>
                <Field label="Place">
                  <input
                    className={inputClass}
                    value={book.place || ''}
                    disabled={readOnly}
                    onChange={(e) => setArrayItem('textbooks', idx, { place: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

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
        <div className="space-y-4">
          {(course.courseOutcomes || []).map((outcome, idx) => (
            <div key={idx} className="border border-slate-200 rounded-md p-4 space-y-3">
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
              <Field label="Description">
                <textarea
                  rows={2}
                  className={inputClass}
                  value={outcome.description || ''}
                  disabled={readOnly}
                  onChange={(e) => setArrayItem('courseOutcomes', idx, { description: e.target.value })}
                />
              </Field>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
