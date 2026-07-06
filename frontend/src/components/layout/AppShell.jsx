import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ title, navItems, activeItem, onNavClick, children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar navItems={navItems} activeItem={activeItem} onNavClick={onNavClick} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} />
        <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
