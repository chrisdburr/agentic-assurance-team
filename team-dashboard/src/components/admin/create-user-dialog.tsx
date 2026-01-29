"use client";

import { Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    username: string;
    email: string;
    password: string;
    is_admin: boolean;
  }) => Promise<void>;
}

export function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateUserDialogProps) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await onSubmit({
        username: username.trim(),
        email: email.trim(),
        password,
        is_admin: isAdmin,
      });
      // Reset form on success
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create user");
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
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>
            Add a new user to the system. They will be able to log in with these
            credentials.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                disabled={isLoading}
                id="username"
                onChange={(e) => setUsername(e.target.value)}
                placeholder="johndoe"
                required
                value={username}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                disabled={isLoading}
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                disabled={isLoading}
                id="password"
                minLength={8}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                required
                type="password"
                value={password}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                checked={isAdmin}
                className="h-4 w-4 rounded border-gray-300"
                disabled={isLoading}
                id="is_admin"
                onChange={(e) => setIsAdmin(e.target.checked)}
                type="checkbox"
              />
              <Label className="font-normal" htmlFor="is_admin">
                Grant admin privileges
              </Label>
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
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
