"use client";

import { useEffect, useRef } from "react";
import { CommandIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAssistantModal } from "./assistant-provider";
import { useAssistant } from "./use-assistant";
import { AssistantMessage, StreamingMessage } from "./assistant-message";
import { AssistantInput } from "./assistant-input";

export function AssistantModal() {
  const { isOpen, close } = useAssistantModal();
  const {
    messages,
    isLoading,
    streamingContent,
    sendMessage,
    clearConversation,
    stopGeneration,
  } = useAssistant();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const hasMessages = messages.length > 0 || streamingContent;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="sm:max-w-2xl h-[70vh] flex flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-semibold">
                AI Assistant
              </DialogTitle>
              <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <CommandIcon className="size-3" />K
              </kbd>
            </div>
            <div className="flex items-center gap-2">
              {hasMessages && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearConversation}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Trash2Icon className="size-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">
            Ask questions about Team Chat features and get help with the app
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6" ref={scrollRef}>
          <div className="py-4 space-y-4">
            {!hasMessages ? (
              <EmptyState />
            ) : (
              <>
                {messages.map((message) => (
                  <AssistantMessage key={message.id} message={message} />
                ))}
                {streamingContent && (
                  <StreamingMessage content={streamingContent} />
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="px-6 py-4 border-t flex-shrink-0">
          <AssistantInput
            onSend={sendMessage}
            onStop={stopGeneration}
            isLoading={isLoading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center text-muted-foreground">
      <div className="rounded-full bg-muted p-4 mb-4">
        <CommandIcon className="size-8" />
      </div>
      <h3 className="font-medium text-foreground mb-2">How can I help you?</h3>
      <p className="text-sm max-w-sm">
        Ask me about Team Chat features, how to create channels, manage agents,
        or draft system prompts for new team members.
      </p>
      <div className="mt-6 grid gap-2 text-xs">
        <SuggestionChip text="How do I create a new channel?" />
        <SuggestionChip text="What are the different agent types?" />
        <SuggestionChip text="Help me write a system prompt" />
      </div>
    </div>
  );
}

function SuggestionChip({ text }: { text: string }) {
  const { sendMessage } = useAssistant();

  return (
    <button
      onClick={() => sendMessage(text)}
      className="px-3 py-1.5 rounded-full border bg-background hover:bg-muted transition-colors text-left"
    >
      {text}
    </button>
  );
}
