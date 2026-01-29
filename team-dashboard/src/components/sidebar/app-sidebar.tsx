"use client";

import { Activity, Bot, MessageSquare, Wifi, WifiOff } from "lucide-react";
import Link from "next/link";

import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useWebSocket } from "@/hooks/use-websocket";
import { NavAdmin } from "./nav-admin";
import { NavChannels } from "./nav-channels";
import { NavDMs } from "./nav-dms";
import { NavUser } from "./nav-user";
import { SidebarSearch } from "./sidebar-search";

export function AppSidebar() {
  const { isConnected, activeAgents } = useWebSocket();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <div className="flex cursor-default items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold">Team Chat</span>
                  <span className="flex items-center gap-1 text-muted-foreground text-xs">
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
        <SidebarSearch />
      </SidebarHeader>

      <SidebarContent className="px-2">
        <NavChannels />
        <Separator className="my-2" />
        <NavDMs activeAgents={activeAgents} />
        <Separator className="my-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link className="flex items-center gap-2" href="/monitoring">
                <Activity className="h-4 w-4" />
                <span>Monitoring</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link className="flex items-center gap-2" href="/agents">
                <Bot className="h-4 w-4" />
                <span>Agents</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <Separator className="my-2" />
        <NavAdmin />
      </SidebarContent>

      <SidebarFooter className="p-4">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
