import { useEffect, useRef, useState } from 'react';

// Closed dropdown button that opens a checkbox list of departments; selected
// departments show as removable chips on the closed field. Used for a
// course's "Common To" departments — optional, none selected means the
// course isn't common to anyone.
//
// `ownerId` (optional) marks one selected department as the course's owner —
// the one whose sub-admin manages assignment and review. The caller keeps
// selection order, so removing the owner chip naturally promotes the next
// selected department.
export default function DepartmentMultiSelect({ departments, selectedIds = [], onChange, disabled = false, ownerId = null }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Preserve the caller's selection order (selectedIds order), not the
  // departments list order — the first selection is the owner.
  const selected = selectedIds
    .map((id) => departments.find((d) => d.id === id))
    .filter(Boolean);

  function toggle(id) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-100 disabled:text-slate-500 min-h-[2.4rem]"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400">Not common to any other department</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {selected.map((d) => (
              <span
                key={d.id}
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                  d.id === ownerId
                    ? 'bg-amber-50 border border-amber-300 text-amber-900'
                    : 'bg-blue-50 border border-blue-200 text-blue-800'
                }`}
              >
                {d.id === ownerId && (
                  <span className="font-semibold" title="Owning department — its sub-admin manages assignment and review">
                    ★ Owner ·
                  </span>
                )}
                {d.code}
                {!disabled && (
                  <span
                    role="button"
                    className="text-blue-400 hover:text-blue-700 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(d.id);
                    }}
                  >
                    ×
                  </span>
                )}
              </span>
            ))}
          </span>
        )}
      </button>

      {open && !disabled && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg max-h-56 overflow-y-auto">
          {departments.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400 italic">No departments available.</p>
          ) : (
            departments.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={selectedIds.includes(d.id)}
                  onChange={() => toggle(d.id)}
                />
                <span className="text-slate-800">{d.name}</span>
                <span className="text-xs text-slate-400 ml-auto">{d.code}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
