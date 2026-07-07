import { useEffect, useRef, useState } from 'react';

// Searchable faculty combobox: closed state shows the selected member, click
// opens a panel with a filter box and one row per faculty member with their
// department alongside (the list may span departments, so it must always be
// clear who is from where). Shared by the Sub-Admin assign-task form and the
// Top Admin direct-assign fields on the Create Course form.
export default function FacultySelect({ faculty, value, onChange, placeholder = 'Select faculty' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const selected = faculty.find((f) => f.id === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? faculty.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.department?.code || '').toLowerCase().includes(q) ||
          (f.department?.name || '').toLowerCase().includes(q)
      )
    : faculty;

  function pick(f) {
    onChange(f.id);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {selected ? (
          <span className="text-slate-900">
            {selected.name}
            {selected.department && <span className="text-slate-400"> — {selected.department.code}</span>}
          </span>
        ) : (
          <span className="text-slate-400">{placeholder}</span>
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="p-2 border-b border-slate-100">
            <input
              ref={searchRef}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search by name or department…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400 italic">No matching faculty.</p>
            ) : (
              filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => pick(f)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 ${
                    f.id === value ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-slate-800">{f.name}</span>
                  <span className="text-xs text-slate-400 shrink-0">{f.department?.code || '—'}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
