import type { useResizableSidebar } from "./use-resizable-sidebar";
import { Sidebar } from "./Sidebar";
import { SidebarResizeHandle } from "./SidebarResizeHandle";
interface ShellSidebarProps {
  sidebar: ReturnType<typeof useResizableSidebar>;
  isCompact: boolean;
}
export function ShellSidebar({ sidebar, isCompact }: ShellSidebarProps) {
  return (
    <>
      <Sidebar collapsed={sidebar.collapsed} onToggle={sidebar.toggle} canToggle={!isCompact} />
      {!isCompact && (
        <SidebarResizeHandle
          width={sidebar.width}
          collapsed={sidebar.collapsed}
          onWidth={sidebar.resize}
          onToggle={sidebar.toggle}
          onReset={sidebar.reset}
        />
      )}
    </>
  );
}
