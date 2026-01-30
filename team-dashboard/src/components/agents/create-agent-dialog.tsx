"use client";

import { Camera, Loader2, Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
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
import { createAgentApi, generateSystemPrompt, uploadAvatar } from "@/lib/api";
import { ToolPicker } from "./tool-picker";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("sonnet");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setModel("sonnet");
    setSystemPrompt("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setAllowedTools([]);
    setError(null);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);

    try {
      const result = await generateSystemPrompt({
        name: name.trim() || undefined,
        description: description.trim(),
        model: model || undefined,
      });
      setSystemPrompt(result.system_prompt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate system prompt"
      );
    } finally {
      setIsGenerating(false);
    }
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

      // Upload avatar first if provided
      if (avatarFile) {
        await uploadAvatar(cleanName, avatarFile);
      }

      await createAgentApi({
        name: cleanName,
        description: description.trim(),
        model,
        system_prompt: systemPrompt.trim(),
        allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
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

            <div className="flex justify-center">
              <button
                className="group relative h-20 w-20 overflow-hidden rounded-full border-2 border-muted-foreground/25 border-dashed transition-colors hover:border-muted-foreground/50"
                disabled={isLoading || isGenerating}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {avatarPreview ? (
                  <Image
                    alt="Avatar preview"
                    className="h-full w-full object-cover"
                    height={80}
                    src={avatarPreview}
                    unoptimized
                    width={80}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground/75">
                    <Camera className="h-6 w-6" />
                    <span className="mt-1 text-[10px]">Avatar</span>
                  </div>
                )}
              </button>
              <input
                accept="image/*"
                className="hidden"
                onChange={handleAvatarSelect}
                ref={fileInputRef}
                type="file"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                disabled={isLoading || isGenerating}
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
                disabled={isLoading || isGenerating}
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
                disabled={isLoading || isGenerating}
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
              <Label>Allowed Tools</Label>
              <ToolPicker
                disabled={isLoading || isGenerating}
                onSelectedToolsChange={setAllowedTools}
                selectedTools={allowedTools}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Button
                  disabled={!description.trim() || isGenerating || isLoading}
                  onClick={handleGenerate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-3 w-3" />
                  )}
                  {isGenerating ? "Generating..." : "Generate"}
                </Button>
              </div>
              <Textarea
                className="min-h-[200px] font-mono text-sm"
                disabled={isLoading || isGenerating}
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
              disabled={isLoading || isGenerating}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={isLoading || isGenerating} type="submit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
