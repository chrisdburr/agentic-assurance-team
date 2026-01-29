"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiUser } from "@/lib/api";

interface DeleteUserDialogProps {
  user: ApiUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (userId: string) => Promise<void>;
}

export function DeleteUserDialog({
  user,
  open,
  onOpenChange,
  onConfirm,
}: DeleteUserDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!user) {
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      await onConfirm(user.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete user");
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
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete User
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the user{" "}
            <strong>{user?.username}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {error && <p className="text-destructive text-sm">{error}</p>}

          {user && (
            <div className="rounded-md border bg-muted/50 p-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Username:</dt>
                  <dd className="font-medium">{user.username}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Email:</dt>
                  <dd className="font-medium">{user.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Role:</dt>
                  <dd className="font-medium">
                    {user.is_admin ? "Admin" : "User"}
                  </dd>
                </div>
              </dl>
            </div>
          )}
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
          <Button
            disabled={isLoading}
            onClick={handleConfirm}
            variant="destructive"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
