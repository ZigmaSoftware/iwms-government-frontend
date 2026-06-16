import AppHeader from "@/layouts/admin/components/AppHeader";
import AppSidebar from "@/layouts/admin/components/AppSidebar";
import AdminBreadcrumb from "@/layouts/admin/components/AdminBreadcrumb";
import Backdrop from "@/layouts/admin/components/Backdrop";
import { SidebarProvider, useSidebar } from "@/contexts/SideBarContext";
import type { AdminLayoutProps } from "@/types/roles";

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </SidebarProvider>
  );
}

function AdminLayoutShell({ children }: AdminLayoutProps) {
  const { isExpanded, isMobileOpen } = useSidebar();

  const desktopPadding =
    isExpanded || isMobileOpen ? "lg:pl-[306px]" : "lg:pl-[96px]";

  return (
    <div
      className="admin-shell relative min-h-screen text-(--admin-text)"
      style={{
        background: "var(--admin-surface)",
        ["--admin-header-h" as any]: "85px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-20 -top-40 h-80 w-80 rounded-full bg-(--admin-primarySoft) blur-[140px]" />
        <div className="absolute -left-20 bottom-[-200px] h-[280px] w-[280px] rounded-full bg-(--admin-accentSoft) blur-[140px]" />
      </div>
      <AppHeader />
      <AppSidebar />
      <Backdrop />
      <main
        className={`pt-[calc(var(--admin-header-h)+1.5rem)] -mt-24 transition-all duration-300 ${desktopPadding}`}
      >
        <div className="min-h-[calc(100vh-4rem)] px-3 py-6 lg:px-6 lg:py-8">
          <div className="mx-auto flex max-w-9xl flex-col gap-5">
            <div className="w-full rounded-[28px] border border-(--admin-border) bg-(--admin-surfaceAlt)/95 px-4 py-5 shadow-(--admin-cardShadow) backdrop-blur">
              <AdminBreadcrumb />
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
