import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Account lockout configuration
const LOCKOUT_THRESHOLD = 5; // Failed attempts before lockout
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minute window for tracking attempts

// In-memory lockout tracker
// Key: "username:ip", Value: { attempts: number[], lockedUntil?: number }
interface LockoutEntry {
  attempts: number[]; // Timestamps of failed attempts
  lockedUntil?: number; // Timestamp when lockout expires
}

const lockoutTracker = new Map<string, LockoutEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up stale entries every minute

function getLockoutKey(username: string, ip: string): string {
  return `${username}:${ip}`;
}

/**
 * Periodically clean up stale entries to prevent memory leaks.
 * Called on each auth attempt; runs actual cleanup at most once per minute.
 */
function cleanupStaleEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;

  const cutoff = now - Math.max(LOCKOUT_DURATION_MS, ATTEMPT_WINDOW_MS);
  for (const [key, entry] of lockoutTracker.entries()) {
    // Remove if lockout expired and no recent attempts
    const hasExpiredLockout = !entry.lockedUntil || entry.lockedUntil < now;
    const hasNoRecentAttempts =
      entry.attempts.length === 0 || entry.attempts.every((ts) => ts < cutoff);

    if (hasExpiredLockout && hasNoRecentAttempts) {
      lockoutTracker.delete(key);
    }
  }
}

function getClientIP(request?: Request): string {
  if (!request) {
    return "unknown";
  }

  // Only trust CF-Connecting-IP if request came through Cloudflare (CF-Ray header present)
  // This prevents IP spoofing if someone bypasses Cloudflare
  const cfRay = request.headers.get("cf-ray");
  if (cfRay) {
    const cfIP = request.headers.get("cf-connecting-ip");
    if (cfIP) {
      return cfIP;
    }
  }

  // Fallback: use a generic identifier to still provide some protection
  // Don't trust X-Forwarded-For without CF-Ray as it can be spoofed
  return "direct";
}

function isAccountLocked(key: string): boolean {
  const entry = lockoutTracker.get(key);
  if (!entry?.lockedUntil) {
    return false;
  }

  if (Date.now() < entry.lockedUntil) {
    return true;
  }

  // Lockout expired, clear it
  lockoutTracker.delete(key);
  return false;
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const entry = lockoutTracker.get(key) || { attempts: [] };

  // Clean up old attempts outside the window
  entry.attempts = entry.attempts.filter((ts) => now - ts < ATTEMPT_WINDOW_MS);

  // Add this attempt
  entry.attempts.push(now);

  // Check if we've hit the threshold
  if (entry.attempts.length >= LOCKOUT_THRESHOLD) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    console.log(
      `[AUTH] Account locked: ${key} for ${LOCKOUT_DURATION_MS / 1000}s after ${entry.attempts.length} failed attempts`
    );
  }

  lockoutTracker.set(key, entry);
}

function clearFailedAttempts(key: string): void {
  lockoutTracker.delete(key);
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  basePath: "/auth",
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize(credentials, request) {
        // Periodically clean up stale lockout entries to prevent memory leaks
        cleanupStaleEntries();

        const username = process.env.AUTH_USERNAME || "admin";
        const password = process.env.AUTH_PASSWORD || "admin";
        const providedUsername = credentials?.username as string;
        const ip = getClientIP(request);
        const lockoutKey = getLockoutKey(providedUsername || "unknown", ip);

        // Check if account is locked
        if (isAccountLocked(lockoutKey)) {
          const entry = lockoutTracker.get(lockoutKey);
          const remainingSeconds = entry?.lockedUntil
            ? Math.ceil((entry.lockedUntil - Date.now()) / 1000)
            : 0;
          console.log(
            `[AUTH] Blocked login attempt for locked account: ${providedUsername} from ${ip} (${remainingSeconds}s remaining)`
          );
          return null;
        }

        if (
          credentials?.username === username &&
          credentials?.password === password
        ) {
          // Successful login - clear any failed attempts
          clearFailedAttempts(lockoutKey);
          console.log(
            `[AUTH] Successful login: ${providedUsername} from ${ip}`
          );
          return {
            id: "1",
            name: credentials.username as string,
            email: `${credentials.username}@team.local`,
          };
        }

        // Failed login - record the attempt
        console.log(
          `[AUTH] Failed login attempt: ${providedUsername} from ${ip}`
        );
        recordFailedAttempt(lockoutKey);
        return null;
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/team", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      return true;
    },
  },
};
