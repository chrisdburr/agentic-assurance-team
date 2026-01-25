"use client";

import { MessageSquare, LogOut, Wifi, WifiOff, Activity } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { NavChannels } from "./nav-channels";
import { NavDMs } from "./nav-dms";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/use-websocket";

export function AppSidebar() {
  const { data: session } = useSession();
  const { isConnected, activeAgents } = useWebSocket();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div className="flex items-center gap-2 cursor-default">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Team Chat</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    {isConnected ? (
                      <>
                        <Wifi className="h-3 w-3 text-green-500" />
                        Connected
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-red-500" />
                        Offline
                      </>
                    )}
                  </span>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavChannels />
        <Separator className="my-2" />
        <NavDMs activeAgents={activeAgents} />
        <Separator className="my-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/monitoring" className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                <span>Monitoring</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {session?.user?.name}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
