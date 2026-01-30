"use client";

import {
  Bot,
  Check,
  Copy,
  Loader2,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { deleteAgentApi, updateAgentApi } from "@/lib/api";
import { getAgent } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types";
import { ToolPicker } from "./tool-picker";

function ToolsSection({
  agent,
  canEdit,
  onAgentUpdated,
}: {
  agent: Agent;
  canEdit: boolean;
  onAgentUpdated?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedTools, setEditedTools] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTools = agent.allowed_tools && agent.allowed_tools.length > 0;

  const handleStart = () => {
    setEditedTools(agent.allowed_tools || []);
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateAgentApi(agent.id, { allowed_tools: editedTools });
      setEditing(false);
      onAgentUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setEditedTools([]);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Allowed Tools</h4>
        <ToolPicker
          disabled={saving}
          onSelectedToolsChange={setEditedTools}
          selectedTools={editedTools}
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={saving} onClick={handleSave} size="sm">
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Save
          </Button>
          <Button
            disabled={saving}
            onClick={handleCancel}
            size="sm"
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (hasTools) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Allowed Tools</h4>
          {canEdit && (
            <Button onClick={handleStart} size="sm" variant="ghost">
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          {agent.allowed_tools?.map((tool) => (
            <Badge className="font-mono text-xs" key={tool} variant="outline">
              {tool}
            </Badge>
          ))}
        </div>
      </div>
    );
  }

  if (canEdit) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">Allowed Tools</h4>
          <Button onClick={handleStart} size="sm" variant="ghost">
            <Settings className="mr-1 h-3 w-3" />
            Configure
          </Button>
        </div>
        <p className="text-muted-foreground text-sm">No tool restrictions</p>
      </div>
    );
  }

  return null;
}

interface AgentDetailDialogProps {
  agent: Agent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentDeleted?: () => void;
  onAgentUpdated?: () => void;
}

export function AgentDetailDialog({
  agent,
  open,
  onOpenChange,
  onAgentDeleted,
  onAgentUpdated,
}: AgentDetailDialogProps) {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!agent) {
    return null;
  }

  const displayInfo = getAgent(agent.id);
  const currentUsername = session?.user?.name || null;
  const isOwner = agent.owner !== null && agent.owner === currentUsername;
  const canEdit = !agent.is_system && isOwner;
  const canDelete = !agent.is_system && isOwner;
  const hasTools = agent.allowed_tools && agent.allowed_tools.length > 0;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(agent.system_prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAgentApi(agent.id);
      setConfirmingDelete(false);
      onOpenChange(false);
      onAgentDeleted?.();
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setConfirmingDelete(false);
        }
        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar>
              {displayInfo.avatar && (
                <AvatarImage alt={agent.name} src={displayInfo.avatar} />
              )}
              <AvatarFallback
                className={cn(
                  displayInfo.bgColor,
                  "text-white",
                  agent.is_system && "bg-muted-foreground",
                )}
              >
                {agent.is_system ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  agent.name[0].toUpperCase()
                )}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="capitalize">{agent.name}</DialogTitle>
              <DialogDescription>{agent.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Model: {agent.model}</Badge>
            {agent.is_system && <Badge variant="secondary">System</Badge>}
            {agent.owner && (
              <Badge variant="outline">Owner: {agent.owner}</Badge>
            )}
            {hasTools && (
              <Badge variant="outline">
                {agent.allowed_tools?.length} tools
              </Badge>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">System Prompt</h4>
              <Button onClick={handleCopy} size="sm" variant="ghost">
                {copied ? (
                  <Check className="mr-1 h-4 w-4" />
                ) : (
                  <Copy className="mr-1 h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <ScrollArea className="h-[300px] rounded-md border bg-muted/50 p-4">
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {agent.system_prompt}
              </pre>
            </ScrollArea>
          </div>

          <ToolsSection
            agent={agent}
            canEdit={canEdit}
            onAgentUpdated={onAgentUpdated}
          />

          {canDelete && (
            <div className="border-t pt-4">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    Delete this agent?
                  </span>
                  <Button
                    disabled={deleting}
                    onClick={handleDelete}
                    size="sm"
                    variant="destructive"
                  >
                    {deleting ? "Deleting..." : "Confirm"}
                  </Button>
                  <Button
                    disabled={deleting}
                    onClick={() => setConfirmingDelete(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  className="text-destructive"
                  onClick={() => setConfirmingDelete(true)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete Agent
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
