/**
 * Background Service API
 * Handles interactions with the background auto-reply service
 */

import axios from "axios";
import api from "./api";

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
