import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { WebSocketProvider } from "@/components/providers/websocket-provider";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebSocketProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          <main className="flex flex-1 flex-col overflow-hidden">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  );
}
