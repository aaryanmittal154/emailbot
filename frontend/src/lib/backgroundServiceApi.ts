import api from "./api";

/**
 * Get background service status
 * @returns Promise with service status information
 */
export const getBackgroundServiceStatus = async () => {
  return api.get("/api/background-service/status");
};

/**
 * Enable or control the background service
 * @param enabled Boolean indicating whether to enable the service
 * @returns Promise with enable result
 */
export const toggleBackgroundServiceControl = async (enabled: boolean) => {
  return api.post("/api/background-service/enable", {
    enabled: enabled,
    force_auth: true
  });
};

/**
 * Directly toggle the background service status
 * This will automatically handle both enabling and disabling based on current state
 */
export const toggleBackgroundService = () => {
  return api.post<{
    success: boolean;
    is_enabled: boolean;
    needs_auth?: boolean;
    message: string;
  }>("/api/background-service/toggle");
};

/**
 * Pause the background service
 * @returns Promise with pause result
 */
export const pauseBackgroundService = async () => {
  return api.post("/api/background-service/pause");
};

/**
 * Completely disable the background service and clean up all tokens
 * This ensures the service will stop processing emails immediately
 * @returns Promise with disable result
 */
export const disableBackgroundServiceCompletely = async () => {
  return api.post("/api/background-service/disable-completely");
};

/**
 * Resume the background service
 * @returns Promise with resume result
 */
export const resumeBackgroundService = async () => {
  return api.post("/api/background-service/resume");
};

/**
 * Update background service preferences
 * @param preferences Object containing service preferences to update
 * @returns Promise with the updated preferences
 */
export const updateBackgroundServicePreferences = async (preferences: {
  background_enabled?: boolean;
  schedule_start_time?: string;
  schedule_end_time?: string;
  active_days?: string;
  max_daily_emails?: number;
  send_summary?: boolean;
  notify_important?: boolean;
  auto_pause_days?: number;
}) => {
  return api.post("/api/background-service/preferences", preferences);
};

/**
 * Get current background service preferences
 * @returns Promise with the current preferences
 */
export const getBackgroundServicePreferences = async () => {
  return api.get("/api/background-service/preferences");
};

/**
 * Check the background service run log
 * @param limit Maximum number of log entries to retrieve
 * @returns Promise with service log data
 */
export const getBackgroundServiceLogs = async (limit: number = 10, offset: number = 0, eventType?: string) => {
  return api.get("/api/background-service/logs", { 
    params: { 
      limit,
      offset,
      event_type: eventType
    } 
  });
};

/**
 * Get OAuth URL for background service access
 * @returns Promise with the OAuth URL
 */
export const getBackgroundServiceOAuthUrl = async () => {
  return api.get("/api/background-service/auth-url");
};
