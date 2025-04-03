/**
 * Utilities for handling email-related functionality
 */

// Key for storing the last email check timestamp in localStorage
const LAST_EMAIL_CHECK_KEY = "emailbot_last_check_timestamp";

/**
 * Get the last timestamp when emails were checked
 * @returns ISO format timestamp string or null if never checked
 */
export const getLastEmailCheckTimestamp = (): string | null => {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_EMAIL_CHECK_KEY);
};

/**
 * Save the current timestamp as the last email check time
 * @param timestamp Optional specific timestamp to save (defaults to current time)
 */
export const saveLastEmailCheckTimestamp = (timestamp?: string): void => {
  if (typeof localStorage === "undefined") return;
  const timeToSave = timestamp || new Date().toISOString();
  localStorage.setItem(LAST_EMAIL_CHECK_KEY, timeToSave);
};

/**
 * Format a timestamp for display
 * @param timestamp ISO format timestamp string
 * @returns Formatted time string (e.g., "5 minutes ago", "Just now")
 */
export const formatTimeSince = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600)
    return `${Math.floor(diffSec / 60)} minute${
      Math.floor(diffSec / 60) === 1 ? "" : "s"
    } ago`;
  if (diffSec < 86400)
    return `${Math.floor(diffSec / 3600)} hour${
      Math.floor(diffSec / 3600) === 1 ? "" : "s"
    } ago`;
  return `${Math.floor(diffSec / 86400)} day${
    Math.floor(diffSec / 86400) === 1 ? "" : "s"
  } ago`;
};
