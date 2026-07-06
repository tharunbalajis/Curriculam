export default function Sidebar({ navItems = [], activeItem, onNavClick }) {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
        <img src="/logo.png" alt="PSG iTech" className="h-9 w-9 object-contain shrink-0" />
        <span className="text-lg font-bold text-brand-900">CurriSync</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onNavClick(item.key)}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-left transition-colors ${
              activeItem === item.key
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
