import type { DisplayMessage } from "@/types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface FilteredMessages {
  recent: DisplayMessage[];
  older: DisplayMessage[];
}

/**
 * Split messages into recent (last 7 days) and older groups.
 * Messages are expected to be sorted by timestamp ascending.
 */
export function filterRecentMessages(messages: DisplayMessage[]): FilteredMessages {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

  const recent: DisplayMessage[] = [];
  const older: DisplayMessage[] = [];

  for (const message of messages) {
    if (new Date(message.timestamp) >= cutoff) {
      recent.push(message);
    } else {
      older.push(message);
    }
  }

  return { recent, older };
}
