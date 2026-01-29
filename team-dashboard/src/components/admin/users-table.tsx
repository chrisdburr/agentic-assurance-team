"use client";

import { Loader2, Pencil, Shield, ShieldOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiUser } from "@/lib/api";

interface UsersTableProps {
  users: ApiUser[];
  isLoading: boolean;
  currentUserId?: string;
  onEdit: (user: ApiUser) => void;
  onDelete: (user: ApiUser) => void;
}

export function UsersTable({
  users,
  isLoading,
  currentUserId,
  onEdit,
  onDelete,
}: UsersTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No users found.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <table className="w-full">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-sm">
              Username
            </th>
            <th className="px-4 py-3 text-left font-medium text-sm">Email</th>
            <th className="px-4 py-3 text-left font-medium text-sm">Role</th>
            <th className="px-4 py-3 text-left font-medium text-sm">Created</th>
            <th className="px-4 py-3 text-right font-medium text-sm">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-b last:border-0" key={user.id}>
              <td className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2">
                  {user.username}
                  {user.id === currentUserId && (
                    <Badge className="text-xs" variant="outline">
                      You
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground text-sm">
                {user.email}
              </td>
              <td className="px-4 py-3 text-sm">
                {user.is_admin ? (
                  <Badge className="gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                ) : (
                  <Badge className="gap-1" variant="secondary">
                    <ShieldOff className="h-3 w-3" />
                    User
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground text-sm">
                {new Date(user.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    onClick={() => onEdit(user)}
                    size="sm"
                    title="Edit user"
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    disabled={user.id === currentUserId}
                    onClick={() => onDelete(user)}
                    size="sm"
                    title={
                      user.id === currentUserId
                        ? "Cannot delete yourself"
                        : "Delete user"
                    }
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
