/**
 * Background Service API
 * Handles interactions with the background auto-reply service
 */

import axios from 'axios';
import api from './api';

interface BackgroundServicePreferences {
  background_enabled?: boolean;
  schedule_start_time?: string | null;
  schedule_end_time?: string | null;
  active_days?: string;
  max_daily_emails?: number;
  send_summary?: boolean;
  notify_important?: boolean;
  auto_pause_days?: number;
}

interface BackgroundServiceStatus {
  is_enabled: boolean;
  has_refresh_token: boolean;
  preferences: BackgroundServicePreferences;
  today_email_count: number;
}

interface BackgroundServiceLog {
  id: number;
  event_type: string;
  status: string;
  details: any;
  created_at: string;
}

/**
 * Background service API functions
 */
export const backgroundService = {
  /**
   * Get authentication URL for enabling background service
   * @param offlineAccess Whether to request offline access
   * @returns Promise with auth URL
   */
  async getAuthUrl(offlineAccess: boolean = true): Promise<string> {
    const response = await axios.get('/api/auth/google-auth-url', {
      params: { offline_access: offlineAccess }
    });
    return response.data.auth_url;
  },

  /**
   * Enable background service after OAuth flow
   * @returns Promise with result
   */
  async enableService(): Promise<any> {
    return api.post('/api/background-service/enable');
  },

  /**
   * Get background service status
   * @returns Promise with status
   */
  async getStatus(): Promise<{ data: BackgroundServiceStatus }> {
    return api.get('/api/background-service/status');
  },

  /**
   * Update background service preferences
   * @param preferences Preferences to update
   * @returns Promise with updated preferences
   */
  async updatePreferences(preferences: BackgroundServicePreferences): Promise<any> {
    return api.post('/api/background-service/preferences', preferences);
  },

  /**
   * Get background service preferences
   * @returns Promise with preferences
   */
  async getPreferences(): Promise<{ data: BackgroundServicePreferences }> {
    return api.get('/api/background-service/preferences');
  },

  /**
   * Pause background service
   * @returns Promise with result
   */
  async pauseService(): Promise<any> {
    return api.post('/api/background-service/pause');
  },

  /**
   * Resume background service
   * @returns Promise with result
   */
  async resumeService(): Promise<any> {
    return api.post('/api/background-service/resume');
  },

  /**
   * Get background service logs
   * @param limit Maximum number of logs to retrieve
   * @param offset Offset for pagination
   * @param eventType Optional event type filter
   * @returns Promise with logs
   */
  async getLogs(
    limit: number = 100,
    offset: number = 0,
    eventType?: string
  ): Promise<{ data: BackgroundServiceLog[] }> {
    return api.get('/api/background-service/logs', {
      params: { limit, offset, event_type: eventType }
    });
  }
};
