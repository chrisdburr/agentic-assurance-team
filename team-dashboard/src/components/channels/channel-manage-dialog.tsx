"use client";

import { Bot, Crown, Loader2, Plus, Trash2, UserIcon, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  addChannelMember,
  type ChannelMember,
  deleteChannel,
  fetchChannelMembers,
  removeChannelMember,
  transferChannelOwnership,
} from "@/lib/api";

interface Channel {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
}

interface ChannelManageDialogProps {
  channel: Channel;
  trigger: React.ReactNode;
  onChannelDeleted?: () => void;
  onMembersChanged?: () => void;
}

const AGENTS = ["alice", "bob", "charlie"];

export function ChannelManageDialog({
  channel,
  trigger,
  onChannelDeleted,
  onMembersChanged,
}: ChannelManageDialogProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUserId, setNewUserId] = useState("");

  // Confirmation states
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const currentUserId = session?.user?.id;
  const isOwner = channel.owner_id === currentUserId;

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchChannelMembers(channel.id);
      setMembers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setIsLoading(false);
    }
  }, [channel.id]);

  useEffect(() => {
    if (open) {
      loadMembers();
      setConfirmDelete(false);
      setConfirmTransfer(null);
    }
  }, [open, loadMembers]);

  const userMembers = members.filter((m) => m.member_type === "user");
  const agentMembers = members.filter((m) => m.member_type === "agent");
  const agentMemberIds = agentMembers.map((m) => m.member_id);
  const availableAgents = AGENTS.filter((a) => !agentMemberIds.includes(a));

  const handleAddAgent = async (agentId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await addChannelMember(channel.id, "agent", agentId);
      await loadMembers();
      onMembersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add agent");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserId.trim()) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await addChannelMember(channel.id, "user", newUserId.trim());
      setNewUserId("");
      await loadMembers();
      onMembersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (member: ChannelMember) => {
    setActionLoading(true);
    setError(null);
    try {
      await removeChannelMember(
        channel.id,
        member.member_type,
        member.member_id
      );
      await loadMembers();
      onMembersChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferOwnership = async (newOwnerId: string) => {
    setActionLoading(true);
    setError(null);
    try {
      await transferChannelOwnership(channel.id, newOwnerId);
      setConfirmTransfer(null);
      setOpen(false);
      onMembersChanged?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to transfer ownership"
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteChannel = async () => {
    setActionLoading(true);
    setError(null);
    try {
      await deleteChannel(channel.id);
      setOpen(false);
      onChannelDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete channel");
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (member: ChannelMember) => {
    if (member.role === "owner") {
      return (
        <Badge className="gap-1" variant="default">
          <Crown className="h-3 w-3" />
          Owner
        </Badge>
      );
    }
    if (member.role === "admin") {
      return <Badge variant="secondary">Admin</Badge>;
    }
    return null;
  };

  const canRemoveMember = (member: ChannelMember) => {
    // Cannot remove the owner
    if (member.role === "owner") {
      return false;
    }
    // Cannot remove yourself
    if (member.member_type === "user" && member.member_id === currentUserId) {
      return false;
    }
    return true;
  };

  const canTransferTo = (member: ChannelMember) => {
    // Can only transfer to other users, not agents
    if (member.member_type !== "user") {
      return false;
    }
    // Cannot transfer to self
    if (member.member_id === currentUserId) {
      return false;
    }
    return isOwner;
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage #{channel.name}</DialogTitle>
          <DialogDescription>
            Add or remove members from this channel.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {error && <p className="text-destructive text-sm">{error}</p>}

              {/* Users Section */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-medium text-sm">
                  <UserIcon className="h-4 w-4" />
                  Users ({userMembers.length})
                </h4>
                <div className="space-y-2">
                  {userMembers.map((member) => (
                    <div
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                      key={`${member.member_type}-${member.member_id}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{member.member_id}</span>
                        {getRoleBadge(member)}
                      </div>
                      <div className="flex items-center gap-1">
                        {canTransferTo(member) && (
                          <Button
                            disabled={actionLoading}
                            onClick={() => setConfirmTransfer(member.member_id)}
                            size="sm"
                            title="Transfer ownership"
                            variant="ghost"
                          >
                            <Crown className="h-4 w-4" />
                          </Button>
                        )}
                        {canRemoveMember(member) && (
                          <Button
                            disabled={actionLoading}
                            onClick={() => handleRemoveMember(member)}
                            size="sm"
                            title="Remove member"
                            variant="ghost"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add User */}
                <div className="flex gap-2">
                  <Input
                    disabled={actionLoading}
                    onChange={(e) => setNewUserId(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddUser();
                      }
                    }}
                    placeholder="Enter user ID"
                    value={newUserId}
                  />
                  <Button
                    disabled={actionLoading || !newUserId.trim()}
                    onClick={handleAddUser}
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Agents Section */}
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-medium text-sm">
                  <Bot className="h-4 w-4" />
                  Agents ({agentMembers.length})
                </h4>
                <div className="space-y-2">
                  {agentMembers.map((member) => (
                    <div
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                      key={`${member.member_type}-${member.member_id}`}
                    >
                      <span className="text-sm capitalize">
                        {member.member_id}
                      </span>
                      <Button
                        disabled={actionLoading}
                        onClick={() => handleRemoveMember(member)}
                        size="sm"
                        title="Remove agent"
                        variant="ghost"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Quick Add Agents */}
                {availableAgents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableAgents.map((agent) => (
                      <Button
                        disabled={actionLoading}
                        key={agent}
                        onClick={() => handleAddAgent(agent)}
                        size="sm"
                        variant="outline"
                      >
                        <Plus className="mr-1 h-3 w-3" />
                        {agent}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              {isOwner && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="font-medium text-destructive text-sm">
                      Danger Zone
                    </h4>
                    <Button
                      disabled={actionLoading}
                      onClick={() => setConfirmDelete(true)}
                      variant="destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Channel
                    </Button>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Transfer Ownership Confirmation */}
        {confirmTransfer && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/95 p-6">
            <div className="space-y-4 text-center">
              <h4 className="font-semibold">Transfer Ownership</h4>
              <p className="text-muted-foreground text-sm">
                Are you sure you want to transfer ownership of #{channel.name}{" "}
                to <strong>{confirmTransfer}</strong>? You will become an admin.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  disabled={actionLoading}
                  onClick={() => setConfirmTransfer(null)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={actionLoading}
                  onClick={() => handleTransferOwnership(confirmTransfer)}
                >
                  {actionLoading ? "Transferring..." : "Transfer"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {confirmDelete && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/95 p-6">
            <div className="space-y-4 text-center">
              <h4 className="font-semibold text-destructive">Delete Channel</h4>
              <p className="text-muted-foreground text-sm">
                Are you sure you want to delete #{channel.name}? This action
                cannot be undone.
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  disabled={actionLoading}
                  onClick={() => setConfirmDelete(false)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  disabled={actionLoading}
                  onClick={handleDeleteChannel}
                  variant="destructive"
                >
                  {actionLoading ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
