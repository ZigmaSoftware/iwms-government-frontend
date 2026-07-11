import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { NotificationDialog } from "@/components/ui/notification-dialog";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ModuleProvider } from "@/contexts/ModuleContext";
import { UserProvider } from "@/contexts/UserContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { RolesProvider } from "@/contexts/RolesContext";
import { ProjectSelectorProvider } from "@/contexts/ProjectSelectorContext";
type Props = {
  children: ReactNode;
};

export function AppProviders({ children }: Props) {
  return (
    <RolesProvider>
      <ThemeProvider>
        <ModuleProvider>
          <UserProvider>
            <ProjectSelectorProvider>
              <PermissionProvider>
                <TooltipProvider>
                  <BrowserRouter>
                    {children}
                    <NotificationDialog />
                    <Toaster />
                    <Sonner />
                  </BrowserRouter>
                </TooltipProvider>
              </PermissionProvider>
            </ProjectSelectorProvider>
          </UserProvider>
        </ModuleProvider>
      </ThemeProvider>
    </RolesProvider>
  );
}
