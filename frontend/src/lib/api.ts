import axios from "axios";

// API endpoint base URL
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://emailbot-k8s7.onrender.com";

// Set up axios instance
const api = axios.create({
  baseURL: BASE_URL,
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Email-related API calls
export const getEmails = async (params = {}) => {
  return api.get("/api/emails", { params });
};

export const getThread = async (threadId) => {
  return api.get(`/api/emails/thread/${threadId}`);
};

export const syncEmails = async () => {
  return api.post("/api/emails/sync");
};

export const searchEmails = async (query) => {
  return api.post("/api/emails/semantic-search", { query });
};

export const indexEmails = async (maxThreads = 100) => {
  return api.post("/api/emails/semantic-index", { max_threads: maxThreads });
};

// Auto-reply API calls
export const triggerAutoReply = async (maxResults = 20, useHtml = false) => {
  return api.post("/api/auto-reply/check-new-emails-sync", {
    max_results: maxResults,
    use_html: useHtml,
  });
};

export const getAutoReplyConfig = async () => {
  return api.get("/api/auto-reply/config");
};

export const updateAutoReplyConfig = async (config) => {
  return api.post("/api/auto-reply/config", config);
};

export const getAutoReplyStatus = async () => {
  return api.get("/api/auto-reply/status");
};

/**
 * Get the current Gmail rate limit status
 * @returns Promise with the rate limit status
 */
export const getGmailRateLimitStatus = async () => {
  return api.get("/api/auto-reply/rate-limit-status");
};

/**
 * Get the Gmail vacation responder settings
 * @returns Promise with the vacation settings
 */
export const getGmailVacationSettings = async () => {
  return api.get("/api/auto-reply/gmail-vacation-settings");
};

/**
 * Enable Gmail's built-in vacation auto-responder
 * @param params Configuration for the Gmail vacation responder
 * @returns Promise with the result of enabling the vacation responder
 */
export const enableGmailVacationResponder = async (params: {
  response_subject: string;
  response_body_html: string;
  restrict_to_domain?: boolean;
  restrict_to_contacts?: boolean;
  start_time?: string;
  end_time?: string;
}) => {
  return api.post("/api/auto-reply/enable-gmail-vacation-responder", params);
};

/**
 * Disable Gmail's built-in vacation auto-responder
 * @returns Promise with the result of disabling the vacation responder
 */
export const disableGmailVacationResponder = async () => {
  return api.post("/api/auto-reply/disable-gmail-vacation-responder");
};

/**
 * Reset the Gmail rate limits
 * @returns Promise with the reset result
 */
export const resetGmailRateLimits = async () => {
  return api.post("/api/auto-reply/reset-rate-limits");
};

export const updateGmailVacationSettings = async (
  enabled,
  subject,
  message,
  startTime,
  endTime
) => {
  return api.post("/api/auto-reply/vacation-settings", {
    enabled,
    subject,
    message,
    start_time: startTime,
    end_time: endTime,
  });
};

// Label-related API calls
export const initializeDefaultLabels = async () => {
  return api.post("/api/labels/initialize");
};

export const getLabelCategories = async () => {
  return api.get("/api/labels/categories");
};

export const getLabels = async () => {
  return api.get("/api/labels");
};

export const getLabelsByCategory = async (categoryId) => {
  return api.get(`/api/labels/category/${categoryId}`);
};

export const createLabel = async (labelData) => {
  return api.post("/api/labels", labelData);
};

export const updateLabel = async (labelId, labelData) => {
  return api.put(`/api/labels/${labelId}`, labelData);
};

export const deleteLabel = async (labelId) => {
  return api.delete(`/api/labels/${labelId}`);
};

export const getThreadLabels = async (threadId) => {
  return api.get(`/api/labels/thread/${threadId}`);
};

export const addLabelToThread = async (
  threadId,
  labelId,
  confidence = 0,
  isConfirmed = false
) => {
  return api.post("/api/labels/thread", {
    thread_id: threadId,
    label_id: labelId,
    confidence,
    is_confirmed: isConfirmed,
  });
};

export const removeLabelFromThread = async (threadId, labelId) => {
  return api.delete(`/api/labels/thread/${threadId}/label/${labelId}`);
};

export const confirmThreadLabel = async (threadId, labelId) => {
  return api.post(`/api/labels/thread/${threadId}/confirm/${labelId}`);
};

export const suggestLabelsForThread = async (threadId, maxSuggestions = 3) => {
  return api.post("/api/labels/suggest", {
    thread_id: threadId,
    max_suggestions: maxSuggestions,
  });
};

export const addLabelFeedback = async (
  threadId,
  suggestedLabelId,
  correctLabelId = null,
  feedbackText = null
) => {
  return api.post("/api/labels/feedback", {
    thread_id: threadId,
    suggested_label_id: suggestedLabelId,
    correct_label_id: correctLabelId,
    feedback_text: feedbackText,
  });
};

// New functions for the labeled emails
export const getEmailsByLabel = async (
  labelName: string,
  page = 1,
  maxResults = 20
) => {
  return api.get(`/api/emails/labeled/${labelName}`, {
    params: { page, max_results: maxResults },
  });
};

export const classifyThread = async (threadId: string) => {
  return api.post("/api/labels/classify-thread", { thread_id: threadId });
};

/**
 * Get threads similar to a specific thread, filtered by a target label
 * @param threadId The ID of the thread to find similar threads for
 * @param targetLabel The label to filter results by (e.g., "Job Posting", "Candidate")
 * @param topK Number of similar threads to return
 * @returns Promise with similar threads
 */
export const getSimilarThreads = async (
  threadId: string,
  targetLabel: string,
  topK: number = 5
) => {
  return api.get("/api/emails/similar", {
    params: {
      thread_id: threadId,
      target_label: targetLabel,
      top_k: topK,
    },
  });
};

// Analytics API calls
export const getEmailSummary = async (count: number = 50) => {
  return api.get("/api/analytics/summary", {
    params: { count },
  });
};

export const getWeeklyDigest = async () => {
  return api.get("/api/analytics/weekly");
};

export const getPopularTopics = async (timeframe: string = "week") => {
  return api.get("/api/analytics/topics", {
    params: { timeframe },
  });
};

export const getEmailSentiment = async (timeframe: string = "month") => {
  return api.get("/api/analytics/sentiment", {
    params: { timeframe },
  });
};

export const getEmailTimePatterns = async () => {
  return api.get("/api/analytics/patterns");
};

export const naturalLanguageSearch = async (
  query: string,
  page: number = 1,
  pageSize: number = 20
) => {
  return api.get("/api/search", {
    params: {
      q: query,
      page,
      page_size: pageSize,
    },
  });
};

export const getSearchSuggestions = async (query: string) => {
  return api.get("/api/search/suggest", {
    params: { q: query },
  });
};

export default api;
