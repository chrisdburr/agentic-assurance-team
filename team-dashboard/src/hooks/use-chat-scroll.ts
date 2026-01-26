"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const NEAR_BOTTOM_THRESHOLD = 100;

interface UseChatScrollOptions {
  /** Current chat key (e.g., "dm:alice") for detecting route changes */
  chatKey: string;
  /** Number of messages - used to detect new messages */
  messageCount: number;
}

interface UseChatScrollReturn {
  /** Whether to show the scroll-to-top button */
  showScrollToTop: boolean;
  /** Scroll to the top of the chat */
  scrollToTop: () => void;
  /** Scroll to the bottom of the chat */
  scrollToBottom: () => void;
  /** Get the viewport element */
  getViewport: () => HTMLElement | null;
}

/**
 * Hook for managing chat scroll behavior:
 * - Auto-scroll to bottom on initial load and route change
 * - Only scroll on new messages if user is near bottom
 * - Track scroll position for scroll-to-top button visibility
 */
export function useChatScroll({
  chatKey,
  messageCount,
}: UseChatScrollOptions): UseChatScrollReturn {
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const isInitialLoadRef = useRef(true);
  const prevChatKeyRef = useRef(chatKey);
  const prevMessageCountRef = useRef(messageCount);

  const getViewport = useCallback((): HTMLElement | null => {
    return document.querySelector('[data-slot="scroll-area-viewport"]');
  }, []);

  const scrollToTop = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [getViewport]);

  const scrollToBottom = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    }
  }, [getViewport]);

  const isNearBottom = useCallback((): boolean => {
    const viewport = getViewport();
    if (!viewport) return true;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, [getViewport]);

  // Handle scroll position tracking for scroll-to-top button
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const handleScroll = () => {
      // Show scroll-to-top when scrolled down more than 200px
      setShowScrollToTop(viewport.scrollTop > 200);
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getViewport, chatKey]); // Re-attach on chat change

  // Handle route change - scroll to bottom
  useEffect(() => {
    if (chatKey !== prevChatKeyRef.current) {
      prevChatKeyRef.current = chatKey;
      isInitialLoadRef.current = true;
      setShowScrollToTop(false);

      // Delay to ensure content is rendered after route change
      setTimeout(() => {
        const viewport = getViewport();
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    }
  }, [chatKey, getViewport]);

  // Handle message changes
  useEffect(() => {
    // On initial load, scroll to bottom after content renders
    if (isInitialLoadRef.current && messageCount > 0) {
      isInitialLoadRef.current = false;
      prevMessageCountRef.current = messageCount;

      // Use setTimeout to ensure DOM has fully rendered
      setTimeout(() => {
        const viewport = getViewport();
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 50);
      return;
    }

    // On new messages, only scroll if near bottom
    if (messageCount > prevMessageCountRef.current) {
      if (isNearBottom()) {
        setTimeout(() => {
          const viewport = getViewport();
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }, 50);
      }
    }

    prevMessageCountRef.current = messageCount;
  }, [messageCount, getViewport, isNearBottom]);

  return {
    showScrollToTop,
    scrollToTop,
    scrollToBottom,
    getViewport,
  };
}
