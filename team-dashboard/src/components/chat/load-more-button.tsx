"use client";

import { Button } from "@/components/ui/button";

interface LoadMoreButtonProps {
  olderCount: number;
  onClick: () => void;
}

export function LoadMoreButton({ olderCount, onClick }: LoadMoreButtonProps) {
  if (olderCount <= 0) return null;

  return (
    <div className="flex justify-center pb-4">
      <Button variant="outline" size="sm" onClick={onClick}>
        Load more ({olderCount} older {olderCount === 1 ? "message" : "messages"})
      </Button>
    </div>
  );
}
