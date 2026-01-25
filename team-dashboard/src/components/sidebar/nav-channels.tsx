"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { CHANNELS } from "@/lib/constants";

export function NavChannels() {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Channels</SidebarGroupLabel>
      <SidebarMenu>
        {CHANNELS.map((channel) => {
          const href = `/${channel.id}`;
          const isActive = pathname === href;

          return (
            <SidebarMenuItem key={channel.id}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link href={href}>
                  <Hash className="h-4 w-4" />
                  <span>{channel.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
