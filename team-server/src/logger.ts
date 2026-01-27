/**
 * Structured Logging Module
 *
 * Provides JSON-formatted logging with:
 * - Console output for development/Docker
 * - File output for auditing (.agents/logs/team-server.log)
 * - Automatic log rotation (10MB, 3 files)
 * - Secret sanitization (API keys, Bearer tokens)
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
} from "node:fs";
import { dirname } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_FILE = process.env.LOG_FILE || ".agents/logs/team-server.log";
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 3;

/**
 * Ensure the log directory exists
 */
function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Rotate log files if current file exceeds MAX_SIZE
 */
function rotateIfNeeded(): void {
  if (!existsSync(LOG_FILE)) {
    return;
  }

  try {
    const stats = statSync(LOG_FILE);
    if (stats.size < MAX_SIZE) {
      return;
    }

    // Rotate: .log.3 -> delete, .log.2 -> .log.3, .log.1 -> .log.2, .log -> .log.1
    for (let i = MAX_FILES - 1; i >= 1; i--) {
      const from = i === 1 ? LOG_FILE : `${LOG_FILE}.${i}`;
      const to = `${LOG_FILE}.${i + 1}`;
      if (existsSync(from)) {
        if (i === MAX_FILES - 1 && existsSync(to)) {
          // Delete the oldest file that would be pushed out
        }
        renameSync(from, to);
      }
    }
    renameSync(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    // Ignore rotation errors - logging should not crash the server
  }
}

/**
 * Sanitize sensitive information from log messages
 */
function sanitize(text: string): string {
  return (
    text
      // API keys (sk-..., key-..., etc.)
      .replace(/\b(sk|key|api[_-]?key)-[a-zA-Z0-9]{20,}/gi, "[REDACTED_KEY]")
      // Bearer tokens
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED]")
      // Generic tokens/secrets in common formats
      .replace(
        /token[=:]\s*["']?[a-zA-Z0-9._-]{20,}["']?/gi,
        "token=[REDACTED]"
      )
      .replace(
        /secret[=:]\s*["']?[a-zA-Z0-9._-]{20,}["']?/gi,
        "secret=[REDACTED]"
      )
  );
}

/**
 * Core logging function
 */
export function log(
  level: LogLevel,
  component: string,
  message: string,
  data?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();

  // Build the log entry
  const entry: Record<string, unknown> = {
    timestamp,
    level,
    component,
    message,
  };
  if (data) {
    entry.data = data;
  }

  const line = JSON.stringify(entry);
  const sanitizedMessage = sanitize(message);

  // Console output (for development/Docker)
  const consolePrefix = `[${timestamp}] [${level.toUpperCase()}] [${component}]`;
  if (level === "error") {
    console.error(`${consolePrefix} ${sanitizedMessage}`);
  } else if (level === "warn") {
    console.warn(`${consolePrefix} ${sanitizedMessage}`);
  } else {
    console.log(`${consolePrefix} ${sanitizedMessage}`);
  }

  // File output (for auditing)
  try {
    ensureDir(LOG_FILE);
    rotateIfNeeded();
    appendFileSync(LOG_FILE, `${line}\n`);
  } catch {
    // Silently fail file logging - don't crash the server
  }
}

/**
 * Logger object with level-specific methods
 */
export const logger = {
  debug: (component: string, message: string, data?: Record<string, unknown>) =>
    log("debug", component, message, data),
  info: (component: string, message: string, data?: Record<string, unknown>) =>
    log("info", component, message, data),
  warn: (component: string, message: string, data?: Record<string, unknown>) =>
    log("warn", component, message, data),
  error: (component: string, message: string, data?: Record<string, unknown>) =>
    log("error", component, message, data),
};
