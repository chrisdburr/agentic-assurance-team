"use client";

import { Search } from "lucide-react";

import { useAssistantModal } from "@/components/assistant/assistant-provider";
import { SidebarGroup, SidebarGroupContent } from "@/components/ui/sidebar";

export function SidebarSearch() {
  const { open } = useAssistantModal();

  return (
    <SidebarGroup className="py-0">
      <SidebarGroupContent>
        <button
          className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={open}
          type="button"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Ask AI...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
