"use client";

import { X } from "lucide-react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_TOOLS,
  selectAll,
  selectAllMcp,
  selectCore,
  TOOL_CATEGORIES,
} from "@/lib/tool-registry";

interface ToolPickerProps {
  selectedTools: string[];
  onSelectedToolsChange: (tools: string[]) => void;
  disabled?: boolean;
  presetTools?: string[];
}

export function ToolPicker({
  selectedTools,
  onSelectedToolsChange,
  disabled,
  presetTools,
}: ToolPickerProps) {
  const [open, setOpen] = useState(false);

  const selectedSet = new Set(selectedTools);

  function toggle(toolId: string) {
    if (selectedSet.has(toolId)) {
      onSelectedToolsChange(selectedTools.filter((t) => t !== toolId));
    } else {
      onSelectedToolsChange([...selectedTools, toolId]);
    }
  }

  function remove(toolId: string) {
    onSelectedToolsChange(selectedTools.filter((t) => t !== toolId));
  }

  const labelMap = new Map(ALL_TOOLS.map((t) => [t.id, t.label]));

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Button
          onClick={() => setOpen(!open)}
          size="sm"
          type="button"
          variant="outline"
        >
          {open ? "Hide tools" : "Select tools..."}
        </Button>
        {selectedTools.length > 0 && (
          <span className="flex items-center text-muted-foreground text-xs">
            {selectedTools.length} selected
          </span>
        )}
      </div>

      {open && (
        <div className="rounded-md border">
          <div className="flex gap-1 border-b p-2">
            <Button
              disabled={disabled}
              onClick={() => onSelectedToolsChange(selectAll())}
              size="sm"
              type="button"
              variant="ghost"
            >
              All
            </Button>
            <Button
              disabled={disabled}
              onClick={() => onSelectedToolsChange(selectCore())}
              size="sm"
              type="button"
              variant="ghost"
            >
              Core
            </Button>
            <Button
              disabled={disabled}
              onClick={() => onSelectedToolsChange(selectAllMcp())}
              size="sm"
              type="button"
              variant="ghost"
            >
              MCP
            </Button>
            {presetTools && presetTools.length > 0 && (
              <Button
                disabled={disabled}
                onClick={() => onSelectedToolsChange([...presetTools])}
                size="sm"
                type="button"
                variant="ghost"
              >
                Preset
              </Button>
            )}
            <Button
              disabled={disabled}
              onClick={() => onSelectedToolsChange([])}
              size="sm"
              type="button"
              variant="ghost"
            >
              Clear
            </Button>
          </div>
          <Accordion className="px-2" multiple>
            {TOOL_CATEGORIES.map((category) => {
              const selectedCount = category.tools.filter((t) => {
                return selectedSet.has(t.id);
              }).length;
              return (
                <AccordionItem key={category.name} value={category.name}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      {category.name}
                      {selectedCount > 0 && (
                        <Badge
                          className="px-1.5 py-0 text-[10px]"
                          variant="secondary"
                        >
                          {selectedCount}
                        </Badge>
                      )}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pb-1">
                      {category.tools.map((tool) => (
                        <label
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-accent"
                          htmlFor={`tool-${tool.id}`}
                          key={tool.id}
                        >
                          <Checkbox
                            checked={selectedSet.has(tool.id)}
                            disabled={disabled}
                            id={`tool-${tool.id}`}
                            onCheckedChange={() => toggle(tool.id)}
                          />
                          <span className="font-mono text-xs">
                            {tool.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {selectedTools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTools.map((toolId) => (
            <Badge
              className="cursor-pointer gap-1 font-mono text-xs"
              key={toolId}
              onClick={() => {
                if (!disabled) {
                  remove(toolId);
                }
              }}
              variant="secondary"
            >
              {labelMap.get(toolId) || toolId}
              {!disabled && <X className="h-3 w-3" />}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
