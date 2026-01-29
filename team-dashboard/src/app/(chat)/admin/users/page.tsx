"use client";

import { Plus, RefreshCw, Shield } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { DeleteUserDialog } from "@/components/admin/delete-user-dialog";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { UsersTable } from "@/components/admin/users-table";
import { Button } from "@/components/ui/button";
import {
  type ApiUser,
  createUserApi,
  deleteUserApi,
  fetchUsers,
  updateUserApi,
} from "@/lib/api";

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleCreateUser = async (data: {
    username: string;
    email: string;
    password: string;
    is_admin: boolean;
  }) => {
    await createUserApi(data);
    await loadUsers();
  };

  const handleUpdateUser = async (
    userId: string,
    data: { email?: string; is_admin?: boolean }
  ) => {
    await updateUserApi(userId, data);
    await loadUsers();
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUserApi(userId);
    await loadUsers();
  };

  // Check if current user is admin (403 error will be shown if not)
  if (error === "Admin access required") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-center text-muted-foreground">
          You need administrator privileges to access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users and their permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadUsers}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {error && error !== "Admin access required" && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      <UsersTable
        users={users}
        isLoading={isLoading}
        currentUserId={session?.user?.id}
        onEdit={setEditUser}
        onDelete={setDeleteUser}
      />

      <CreateUserDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={handleCreateUser}
      />

      <EditUserDialog
        user={editUser}
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
        onSubmit={handleUpdateUser}
        currentUserId={session?.user?.id}
      />

      <DeleteUserDialog
        user={deleteUser}
        open={!!deleteUser}
        onOpenChange={(open) => !open && setDeleteUser(null)}
        onConfirm={handleDeleteUser}
      />
    </div>
  );
}
