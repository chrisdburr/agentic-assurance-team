"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiUser } from "@/lib/api";

interface EditUserDialogProps {
  user: ApiUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    userId: string,
    data: { email?: string; is_admin?: boolean }
  ) => Promise<void>;
  currentUserId?: string;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSubmit,
  currentUserId,
}: EditUserDialogProps) {
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrentUser = user?.id === currentUserId;

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setIsAdmin(user.is_admin);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const updates: { email?: string; is_admin?: boolean } = {};
      if (email.trim() !== user.email) {
        updates.email = email.trim();
      }
      if (isAdmin !== user.is_admin && !isCurrentUser) {
        updates.is_admin = isAdmin;
      }

      await onSubmit(user.id, updates);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update user details for {user?.username}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="space-y-2">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                className="bg-muted"
                disabled
                id="edit-username"
                value={user?.username || ""}
              />
              <p className="text-muted-foreground text-xs">
                Username cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                disabled={isLoading}
                id="edit-email"
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                value={email}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                checked={isAdmin}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isLoading || isCurrentUser}
                id="edit-is_admin"
                onChange={(e) => setIsAdmin(e.target.checked)}
                type="checkbox"
              />
              <Label className="font-normal" htmlFor="edit-is_admin">
                Admin privileges
              </Label>
              {isCurrentUser && (
                <span className="text-muted-foreground text-xs">
                  (Cannot modify your own admin status)
                </span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={isLoading}
              onClick={() => handleOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
