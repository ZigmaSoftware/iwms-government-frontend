import { ArrowLeft } from 'lucide-react';
import { useModule } from '../../contexts/ModuleContext';
import { cn } from '../../lib/utils';

interface ModuleHeaderProps {
  title: string;
  icon: React.ReactNode;
  color: string;
}

export function ModuleHeader({ title, icon, color }: ModuleHeaderProps) {
  const { setActiveModule, activeView, setActiveView } = useModule();

  const views = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'map', label: 'Map' },
    { id: 'table', label: 'Table' },
  ] as const;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveModule(null)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          </div>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg inline-flex">
        {views.map((view) => (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-all',
              activeView === view.id
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}
