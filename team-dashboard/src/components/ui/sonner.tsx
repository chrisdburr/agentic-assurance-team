"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "var(--accent)",
          "--success-text": "var(--accent-foreground)",
          "--success-border": "var(--accent)",
          "--error-bg": "var(--destructive)",
          "--error-text": "var(--destructive-foreground)",
          "--error-border": "var(--destructive)",
          "--warning-bg": "var(--secondary)",
          "--warning-text": "var(--secondary-foreground)",
          "--warning-border": "var(--secondary)",
          "--info-bg": "var(--muted)",
          "--info-text": "var(--foreground)",
          "--info-border": "var(--border)",
          "--border-radius": "var(--radius)",
          fontFamily: "var(--font-sans)",
          letterSpacing: "var(--tracking-normal)",
        } as React.CSSProperties
      }
      theme="dark"
      toastOptions={{
        classNames: {
          toast: "cn-toast shadow-lg",
          description: "whitespace-pre-line",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
