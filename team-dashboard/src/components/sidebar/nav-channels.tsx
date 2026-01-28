"use client";

import { Hash, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Channel {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
}

interface ChannelsResponse {
  channels: Channel[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NavChannels() {
  const pathname = usePathname();
  const { data, error, isLoading } = useSWR<ChannelsResponse>(
    "/api/backend/channels",
    fetcher,
    {
      refreshInterval: 30_000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  const channels = data?.channels ?? [];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        Channels
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarGroupAction asChild>
              <Link href="/channels/new">
                <Plus className="h-4 w-4" />
                <span className="sr-only">Create Channel</span>
              </Link>
            </SidebarGroupAction>
          </TooltipTrigger>
          <TooltipContent side="right">Create Channel</TooltipContent>
        </Tooltip>
      </SidebarGroupLabel>
      <SidebarMenu>
        {isLoading && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-muted-foreground">Loading...</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {error && (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span className="text-destructive text-sm">Failed to load</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {!(isLoading || error) &&
          channels.map((channel) => {
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
