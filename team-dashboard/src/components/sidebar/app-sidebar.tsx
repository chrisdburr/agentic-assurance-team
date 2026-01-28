"use client";

import {
  Activity,
  LogOut,
  MessageSquare,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { PasswordChangeDialog } from "@/components/settings/password-change-dialog";
import { Button } from "@/components/ui/button";
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
import { NavChannels } from "./nav-channels";
import { NavDMs } from "./nav-dms";

export function AppSidebar() {
  const { data: session } = useSession();
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
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            {session?.user?.name}
          </span>
          <div className="flex items-center gap-1">
            <PasswordChangeDialog
              trigger={
                <Button size="icon" variant="ghost">
                  <Settings className="h-4 w-4" />
                </Button>
              }
            />
            <Button
              onClick={() => signOut({ callbackUrl: "/login" })}
              size="icon"
              variant="ghost"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
