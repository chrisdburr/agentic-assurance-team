"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function NavAdmin() {
  const { data: session } = useSession();

  // Only show admin section if user is an admin
  if (!session?.user?.is_admin) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild>
          <Link className="flex items-center gap-2" href="/admin/users">
            <Users className="h-4 w-4" />
            <span>Users</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
