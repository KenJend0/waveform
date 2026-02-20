/**
 * Client-side rate limiting helper
 * Prevents excessive auth attempts to protect against brute force
 */

const ATTEMPT_STORAGE_KEY = "auth_attempts";
const MAX_ATTEMPTS = 5;
const WINDOW_TIME_MS = 15 * 60 * 1000; // 15 minutes

interface AttemptRecord {
  timestamp: number;
  action: string;
}

export function canAttemptAuth(action: "login" | "signup" | "reset"): { allowed: boolean; remainingTime: number } {
  try {
    const stored = localStorage.getItem(ATTEMPT_STORAGE_KEY);
    const attempts: AttemptRecord[] = stored ? JSON.parse(stored) : [];
    
    const now = Date.now();
    const actionAttempts = attempts.filter(
      (a) => a.action === action && now - a.timestamp < WINDOW_TIME_MS
    );

    if (actionAttempts.length >= MAX_ATTEMPTS) {
      const oldestAttempt = actionAttempts[0];
      const remainingTime = WINDOW_TIME_MS - (now - oldestAttempt.timestamp);
      return {
        allowed: false,
        remainingTime: Math.ceil(remainingTime / 1000), // Return seconds
      };
    }

    // Clean old attempts
    const validAttempts = attempts.filter((a) => now - a.timestamp < WINDOW_TIME_MS);
    validAttempts.push({ timestamp: now, action });
    localStorage.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(validAttempts));

    return { allowed: true, remainingTime: 0 };
  } catch (err) {
    console.warn("Rate limiting error:", err);
    return { allowed: true, remainingTime: 0 }; // Allow on error
  }
}

export function resetAttempts() {
  try {
    localStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to reset attempts:", err);
  }
}
