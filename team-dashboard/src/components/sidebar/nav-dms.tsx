"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AGENTS, getAgent } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface NavDMsProps {
  activeAgents?: string[];
  unreadCounts?: Record<string, number>;
}

export function NavDMs({ activeAgents = [], unreadCounts = {} }: NavDMsProps) {
  const pathname = usePathname();

  const agents = Object.values(AGENTS);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Direct Messages</SidebarGroupLabel>
      <SidebarMenu>
        {agents.map((agent) => {
          const href = `/dm/${agent.id}`;
          const isActive = pathname === href;
          const isOnline = activeAgents.includes(agent.id);
          const unread = unreadCounts[agent.id] || 0;

          return (
            <SidebarMenuItem key={agent.id}>
              <SidebarMenuButton asChild isActive={isActive}>
                <Link href={href} className="flex items-center gap-2">
                  <div className="relative">
                    <Avatar className="h-6 w-6">
                      {agent.avatar && <AvatarImage src={agent.avatar} alt={agent.name} />}
                      <AvatarFallback className={agent.bgColor}>
                        {agent.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
                    )}
                  </div>
                  <span className="flex-1">{agent.name}</span>
                  {unread > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                      {unread}
                    </Badge>
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
