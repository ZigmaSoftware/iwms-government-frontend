import { Trash2, UserCheck, Package, Scale, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useModule } from "@/contexts/ModuleContext";
import type { ModuleType } from "@/types";
import { useTranslation } from "react-i18next";

export function QuickModuleSlider() {
  const { t } = useTranslation();
  const { setActiveModule, setActiveView } = useModule();

  const quickModules = [
    { id: 'collection' as ModuleType, name: t("dashboard.home.quick_module_d2d"), icon: Trash2, color: '#43A047' },
    { id: 'attendance' as ModuleType, name: t("dashboard.home.quick_module_attendance"), icon: UserCheck, color: '#00ACC1' },
    { id: 'asset' as ModuleType, name: t("dashboard.home.quick_module_asset"), icon: Package, color: '#5E35B1' },
    { id: 'weighbridge' as ModuleType, name: t("dashboard.home.quick_module_weighbridge"), icon: Scale, color: '#8E24AA' },
  ];

  const handleQuickAccess = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    setActiveView('dashboard');
  };

  return (
    <div className="mb-3">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
        {quickModules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              onClick={() => handleQuickAccess(module.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                'hover:shadow-md transition-all duration-300',
                'backdrop-blur-sm bg-opacity-90'
              )}
              style={{ borderLeftColor: module.color, borderLeftWidth: '3px' }}
            >
              <div
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: `${module.color}20`, color: module.color }}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {module.name}
              </span>
              <ChevronRight className="w-3 h-3 text-gray-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
