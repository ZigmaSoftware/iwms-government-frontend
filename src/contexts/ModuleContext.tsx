import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import type { ModuleType } from "@/types";

interface ModuleContextType {
  activeModule: ModuleType | null;
  setActiveModule: (module: ModuleType | null) => void;
  activeView: 'dashboard' | 'analytics' | 'drilldown' | 'map' | 'table';
  setActiveView: (view: 'dashboard' | 'analytics' | 'drilldown' | 'map' | 'table') => void;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [activeModule, setActiveModule] = useState<ModuleType | null>(null);
  const [activeView, setActiveView] = useState<'dashboard' | 'analytics' | 'drilldown' | 'map' | 'table'>('dashboard');

  return (
    <ModuleContext.Provider value={{ activeModule, setActiveModule, activeView, setActiveView }}>
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const context = useContext(ModuleContext);
  if (!context) throw new Error('useModule must be used within ModuleProvider');
  return context;
}
