"use client";

import { Camera, ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createAgentApi,
  fetchPresets,
  generateSystemPrompt,
  uploadAvatar,
} from "@/lib/api";
import type { ResolvedPreset } from "@/types";
import { ToolPicker } from "./tool-picker";

interface CreateAgentDialogProps {
  onAgentCreated: () => void;
}

const MODELS = [
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
];

const AGENT_NAME_REGEX = /^[a-z][a-z0-9-]*$/;

export function CreateAgentDialog({ onAgentCreated }: CreateAgentDialogProps) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preset data
  const { data: presets } = useSWR<ResolvedPreset[]>(
    open ? "presets" : null,
    fetchPresets
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const selectedPreset = presets?.find((p) => p.id === selectedPresetId);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("sonnet");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [toolsCustomized, setToolsCustomized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setName("");
    setDescription("");
    setModel("sonnet");
    setSystemPrompt("");
    setAvatarFile(null);
    setAvatarPreview(null);
    setAllowedTools([]);
    setSelectedPresetId(null);
    setToolsCustomized(false);
    setError(null);
  };

  const handlePresetChange = (presetId: string | null) => {
    setSelectedPresetId(presetId);
    setToolsCustomized(false);
    if (presetId && presets) {
      const preset = presets.find((p) => p.id === presetId);
      if (preset) {
        setModel(preset.model);
        setAllowedTools([...preset.tools]);
      }
    } else {
      setAllowedTools([]);
    }
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
      const cleanName = name.trim().toLowerCase();
      if (!AGENT_NAME_REGEX.test(cleanName)) {
        throw new Error(
          "Name must start with a letter and contain only lowercase letters, numbers, and hyphens"
        );
      }

      if (avatarFile) {
        await uploadAvatar(cleanName, avatarFile);
      }

      await createAgentApi({
        name: cleanName,
        description: description.trim(),
        model,
        system_prompt: systemPrompt.trim(),
        allowed_tools: allowedTools.length > 0 ? allowedTools : undefined,
        dispatchable: selectedPreset?.dispatchable,
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

  const formDisabled = isLoading || isGenerating;

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
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Define your agent&apos;s identity, prompt, and tool access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-destructive text-sm">
                {error}
              </p>
            )}

            {/* Avatar + Name row */}
            <div className="flex items-start gap-4">
              <button
                className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-muted-foreground/25 border-dashed transition-colors hover:border-muted-foreground/50"
                disabled={formDisabled}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {avatarPreview ? (
                  <Image
                    alt="Avatar preview"
                    className="h-full w-full object-cover"
                    height={64}
                    src={avatarPreview}
                    unoptimized
                    width={64}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center text-muted-foreground/50 group-hover:text-muted-foreground/75">
                    <Camera className="h-5 w-5" />
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
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  disabled={formDisabled}
                  id="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-agent"
                  required
                  value={name}
                />
                <p className="text-muted-foreground text-xs">
                  Lowercase letters, numbers, and hyphens only.
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                disabled={formDisabled}
                id="description"
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Researcher for decision theory and HCI"
                required
                value={description}
              />
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>Model</Label>
              <Select
                onValueChange={(val) => setModel(val as string)}
                value={model}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* System Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Button
                  disabled={!description.trim() || formDisabled}
                  onClick={handleGenerate}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="mr-1.5 h-3 w-3" />
                  )}
                  {isGenerating ? "Generating..." : "Generate"}
                </Button>
              </div>
              <Textarea
                className="min-h-[160px] font-mono text-sm"
                disabled={formDisabled}
                id="systemPrompt"
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                required
                value={systemPrompt}
              />
            </div>

            <Separator />

            {/* Tools */}
            <div className="space-y-3">
              <Label>Tools</Label>

              {/* Preset dropdown */}
              {presets && presets.length > 0 && (
                <div className="space-y-1.5">
                  <Select
                    onValueChange={(val) => {
                      const id = val as string;
                      handlePresetChange(id === "custom" ? null : id);
                    }}
                    value={selectedPresetId ?? "custom"}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a preset..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">
                        Custom (manual selection)
                      </SelectItem>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          <span className="capitalize">{preset.id}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            &mdash; {preset.tools.length} tools
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPreset && (
                    <p className="text-muted-foreground text-xs">
                      {selectedPreset.description}. Sets model to{" "}
                      <span className="font-medium">
                        {selectedPreset.model}
                      </span>
                      .
                    </p>
                  )}
                </div>
              )}

              {/* Tool customization */}
              {selectedPresetId ? (
                <Collapsible
                  onOpenChange={setToolsCustomized}
                  open={toolsCustomized}
                >
                  <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${toolsCustomized ? "rotate-180" : ""}`}
                    />
                    Customize tools ({allowedTools.length} selected)
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <ToolPicker
                      disabled={formDisabled}
                      onSelectedToolsChange={setAllowedTools}
                      presetTools={selectedPreset?.tools}
                      selectedTools={allowedTools}
                    />
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <ToolPicker
                  disabled={formDisabled}
                  onSelectedToolsChange={setAllowedTools}
                  selectedTools={allowedTools}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              disabled={formDisabled}
              onClick={() => setOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={formDisabled} type="submit">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
