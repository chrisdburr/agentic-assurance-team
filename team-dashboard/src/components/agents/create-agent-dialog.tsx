"use client";

import { Loader2, Plus } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createAgentApi } from "@/lib/api";

interface CreateAgentDialogProps {
  onAgentCreated: () => void;
}

const MODELS = [
  { value: "sonnet", label: "Sonnet (Default)" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
];

const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

export function CreateAgentDialog({ onAgentCreated }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("sonnet");
  const [systemPrompt, setSystemPrompt] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setModel("sonnet");
    setSystemPrompt("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Validate name format
      const cleanName = name.trim().toLowerCase();
      if (!AGENT_NAME_REGEX.test(cleanName)) {
        throw new Error(
          "Name must start with a letter and contain only lowercase letters, numbers, and hyphens"
        );
      }

      await createAgentApi({
        name: cleanName,
        description: description.trim(),
        model,
        system_prompt: systemPrompt.trim(),
      });

      resetForm();
      setOpen(false);
      onAgentCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          resetForm();
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Agent
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Create a custom agent with its own system prompt and capabilities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && <p className="text-destructive text-sm">{error}</p>}

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                disabled={isLoading}
                id="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="my-agent"
                required
                value={name}
              />
              <p className="text-muted-foreground text-xs">
                Lowercase letters, numbers, and hyphens only. Must start with a
                letter.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                disabled={isLoading}
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A helpful assistant for..."
                required
                value={description}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                disabled={isLoading}
                id="model"
                onChange={(e) => setModel(e.target.value)}
                value={model}
              >
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                className="min-h-[200px] font-mono text-sm"
                disabled={isLoading}
                id="systemPrompt"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                required
                value={systemPrompt}
              />
            </div>
          </div>

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
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
