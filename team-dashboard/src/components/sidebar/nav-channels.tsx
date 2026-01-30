"use client";

import { ChevronRight, Hash, Loader2, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { ChannelManageDialog } from "@/components/channels/channel-manage-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
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

const STORAGE_KEY = "sidebar-channels-open";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NavChannels() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === "true" : true;
  });
  const { data, error, isLoading, mutate } = useSWR<ChannelsResponse>(
    "/api/backend/channels",
    fetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
    }
  );

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(open));
  }, [open]);

  const channels = data?.channels ?? [];

  return (
    <SidebarGroup>
      <Collapsible onOpenChange={(value) => setOpen(value)} open={open}>
        <SidebarGroupLabel>
          <CollapsibleTrigger className="flex flex-1 items-center gap-1">
            <ChevronRight className="h-3 w-3 transition-transform data-[open]:rotate-90" />
            Channels
          </CollapsibleTrigger>
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
        <CollapsibleContent>
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
                  <span className="text-destructive text-sm">
                    Failed to load
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {!(isLoading || error) &&
              channels.map((channel) => {
                const href = `/${channel.id}`;
                const isActive = pathname === href;
                const isSystemChannel = channel.owner_id === "system";
                const displayName =
                  channel.name.charAt(0).toUpperCase() + channel.name.slice(1);

                return (
                  <SidebarMenuItem key={channel.id}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={href}>
                        <Hash className="h-4 w-4" />
                        <span>{displayName}</span>
                      </Link>
                    </SidebarMenuButton>
                    {!isSystemChannel && (
                      <ChannelManageDialog
                        channel={channel}
                        onChannelDeleted={() => {
                          mutate();
                          if (pathname === `/${channel.id}`) {
                            router.push("/team");
                          }
                        }}
                        onMembersChanged={() => mutate()}
                        trigger={
                          <SidebarMenuAction>
                            <Settings className="h-4 w-4" />
                            <span className="sr-only">Manage channel</span>
                          </SidebarMenuAction>
                        }
                      />
                    )}
                  </SidebarMenuItem>
                );
              })}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}
