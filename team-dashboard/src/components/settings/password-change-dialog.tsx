"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { changePassword } from "@/lib/api";

interface PasswordChangeDialogProps {
  trigger: React.ReactNode;
}

export function PasswordChangeDialog({ trigger }: PasswordChangeDialogProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    }
  };

  const validateForm = (): string | null => {
    if (!(currentPassword && newPassword && confirmPassword)) {
      return "All fields are required";
    }
    if (newPassword.length < 8) {
      return "New password must be at least 8 characters";
    }
    if (newPassword !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    const userId = session?.user?.id;
    if (!userId) {
      setError("User session not found");
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(userId, currentPassword, newPassword);
      setSuccess(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new password.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="current-password">
              Current Password
            </label>
            <Input
              disabled={isLoading}
              id="current-password"
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              type="password"
              value={currentPassword}
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="new-password">
              New Password
            </label>
            <Input
              disabled={isLoading}
              id="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              type="password"
              value={newPassword}
            />
          </div>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="confirm-password">
              Confirm New Password
            </label>
            <Input
              disabled={isLoading}
              id="confirm-password"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              type="password"
              value={confirmPassword}
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          {success && (
            <p className="text-green-600 text-sm">
              Password changed successfully!
            </p>
          )}

          <DialogFooter>
            <Button
              disabled={isLoading}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isLoading} type="submit">
              {isLoading ? "Changing..." : "Change Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
