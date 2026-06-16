import {
  LayoutDashboard,
  Trash2,
  Truck,
  Users,
  Scale,
  Droplet,
  MapPin,
  MessageSquare,
  UserCheck,
  Package,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useModule } from "@/contexts/ModuleContext";
import type { ModuleType } from "@/types";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const modules = [
  { id: 'collection' as ModuleType, name: 'Collection', icon: Trash2, color: '#43A047' },
  { id: 'd2d' as ModuleType, name: 'D2D Logistics', icon: Truck, color: '#1E88E5' },
  { id: 'resource' as ModuleType, name: 'Resource Mgmt', icon: Users, color: '#FB8C00' },
  { id: 'weighbridge' as ModuleType, name: 'Weighbridge', icon: Scale, color: '#8E24AA' },
  { id: 'waste' as ModuleType, name: 'Waste Mgmt', color: '#43A047', icon: Droplet },
  { id: 'landfill' as ModuleType, name: 'Landfill', icon: MapPin, color: '#6D4C41' },
  { id: 'grievance' as ModuleType, name: 'Grievances', icon: MessageSquare, color: '#E53935' },
  { id: 'attendance' as ModuleType, name: 'Attendance', icon: UserCheck, color: '#00ACC1' },
  { id: 'asset' as ModuleType, name: 'Asset Mgmt', icon: Package, color: '#5E35B1' },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { activeModule, setActiveModule, setActiveView } = useModule();

  const handleModuleClick = (moduleId: ModuleType) => {
    setActiveModule(moduleId);
    setActiveView('dashboard');
    onClose();
  };

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed top-14 left-0 bottom-0 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40',
          'transition-transform duration-300 overflow-y-auto',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4 lg:hidden">
            <h2 className="font-semibold text-gray-900 dark:text-white">Menu</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => {
              setActiveModule(null);
              setActiveView('dashboard');
              onClose();
            }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-2 transition-all',
              !activeModule
                ? 'bg-gradient-to-r from-green-500 to-blue-600 text-white shadow-md'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
            )}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="font-medium">Home Dashboard</span>
          </button>

          <div className="space-y-1 mt-6">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-3 mb-2">
              Modules
            </h3>
            {modules.map((module) => {
              const Icon = module.icon;
              const isActive = activeModule === module.id;

              return (
                <button
                  key={module.id}
                  onClick={() => handleModuleClick(module.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                    isActive
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <div
                    className="p-1.5 rounded-lg"
                    style={{ backgroundColor: `${module.color}20`, color: module.color }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm">{module.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
