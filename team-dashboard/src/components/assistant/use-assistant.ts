"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AssistantState {
  messages: Message[];
  isLoading: boolean;
  streamingContent: string;
  sessionId: string | null;
}

const STORAGE_KEY = "assistant-conversation";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function loadFromStorage(): AssistantState {
  if (typeof window === "undefined") {
    return {
      messages: [],
      isLoading: false,
      streamingContent: "",
      sessionId: null,
    };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        messages: parsed.messages || [],
        isLoading: false,
        streamingContent: "",
        sessionId: parsed.sessionId || null,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return {
    messages: [],
    isLoading: false,
    streamingContent: "",
    sessionId: null,
  };
}

function saveToStorage(messages: Message[], sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, sessionId }));
  } catch {
    // Ignore storage errors
  }
}

export function useAssistant() {
  const [state, setState] = useState<AssistantState>(() => loadFromStorage());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Save to localStorage when messages or sessionId change
  useEffect(() => {
    saveToStorage(state.messages, state.sessionId);
  }, [state.messages, state.sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || state.isLoading) return;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content: content.trim(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
        isLoading: true,
        streamingContent: "",
      }));

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
            sessionId: state.sessionId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let newSessionId = state.sessionId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.sessionId) {
                  newSessionId = data.sessionId;
                }
                if (data.text) {
                  accumulatedContent += data.text;
                  setState((prev) => ({
                    ...prev,
                    streamingContent: accumulatedContent,
                  }));
                }
                if (data.error) {
                  throw new Error(data.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // Finalize the assistant message
        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: accumulatedContent,
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, assistantMessage],
          isLoading: false,
          streamingContent: "",
          sessionId: newSessionId,
        }));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Assistant error:", error);

        const errorMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        };

        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, errorMessage],
          isLoading: false,
          streamingContent: "",
        }));
      }
    },
    [state.isLoading, state.sessionId],
  );

  const clearConversation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      messages: [],
      isLoading: false,
      streamingContent: "",
      sessionId: null,
    });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        streamingContent: "",
      }));
    }
  }, []);

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    streamingContent: state.streamingContent,
    sendMessage,
    clearConversation,
    stopGeneration,
  };
}
