"use client";

import { cn } from "@/lib/utils";
import { HEALTH_STATUS } from "@/lib/constants";
import type { HealthStatus } from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthIndicatorProps {
  status: HealthStatus;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function HealthIndicator({
  status,
  size = "md",
  showLabel = false,
  className,
}: HealthIndicatorProps) {
  const config = HEALTH_STATUS[status];

  const sizeClasses = {
    sm: "h-2 w-2",
    md: "h-3 w-3",
    lg: "h-4 w-4",
  };

  const dot = (
    <span
      className={cn(
        "inline-block rounded-full",
        config.bgColor,
        sizeClasses[size],
        // Add pulse animation for yellow (busy) status
        status === "yellow" && "animate-pulse",
        className
      )}
    />
  );

  if (showLabel) {
    return (
      <div className="flex items-center gap-2">
        {dot}
        <span className={cn("text-sm", config.textColor)}>{config.label}</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{dot}</TooltipTrigger>
      <TooltipContent>
        <p>{config.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
