import axios from "axios";

// API endpoint base URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

console.log(`Using API URL: ${BASE_URL}`);

// Set up axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // Add timeout to prevent hanging requests
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error("API Error Details:", {
      message: error.message,
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.config?.headers,
    });
    return Promise.reject(error);
  }
);

// Email-related API calls
export const getEmails = async (params = {}) => {
  console.log("Fetching emails with params:", params);
  try {
    return await api.get("/api/emails", { params });
  } catch (error) {
    console.error("getEmails error:", error);
    throw error;
  }
};

export const getThread = async (threadId: string) => {
  return api.get(`/api/emails/thread/${threadId}`);
};

export const syncEmails = async () => {
  return api.post("/api/emails/sync");
};

export const searchEmails = async (query: string) => {
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

export const getLabelsByCategory = async (categoryId: string) => {
  return api.get(`/api/labels/category/${categoryId}`);
};

export const createLabel = async (labelData) => {
  return api.post("/api/labels", labelData);
};

export const updateLabel = async (labelId: number, labelData) => {
  return api.put(`/api/labels/${labelId}`, labelData);
};

export const deleteLabel = async (labelId: number) => {
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
  params: Record<string, any> = {}
) => {
  console.log(`API Call: getEmailsByLabel with labelName: "${labelName}"`);
  try {
    const response = await api.get(
      `/api/emails/labeled/${encodeURIComponent(labelName)}`,
      { params }
    );
    console.log(`API Response for ${labelName}:`, response.data);

    // Add validation and detailed logging
    if (!response.data) {
      console.error(`Empty response data for label ${labelName}`);
    } else if (Array.isArray(response.data)) {
      console.log(
        `Received array with ${response.data.length} emails for ${labelName}`
      );
    } else if (response.data.emails && Array.isArray(response.data.emails)) {
      console.log(
        `Received object with ${response.data.emails.length} emails for ${labelName}`
      );
    } else {
      console.error(
        `Unexpected response format for ${labelName}:`,
        response.data
      );
    }

    return response;
  } catch (error) {
    console.error(`Error fetching emails with label ${labelName}:`, error);
    throw error;
  }
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

/**
 * Get threads similar to a specific thread across multiple categories
 * This enhances the existing getSimilarThreads by allowing multi-category search
 * @param threadId The ID of the thread to find similar threads for
 * @param includeCategories Array of category labels to include (empty = all)
 * @param excludeCategories Array of category labels to exclude
 * @param topK Number of similar threads to return
 * @param timestamp Optional timestamp for cache-busting
 * @returns Promise with similar threads from multiple categories
 */
export const getSimilarThreadsMultiCategory = async (
  threadId: string,
  includeCategories: string[] = [],
  excludeCategories: string[] = [],
  topK: number = 10,
  timestamp?: number
) => {
  return api.get("/api/emails/similar-multi", {
    params: {
      thread_id: threadId,
      include_categories: includeCategories.join(","),
      exclude_categories: excludeCategories.join(","),
      top_k: topK,
      t: timestamp || Date.now(), // Add timestamp for cache-busting
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

// Job-Candidate Matching API calls
/**
 * Find candidates that match a job posting
 * @param jobThreadId The thread ID of the job posting
 * @param topK Number of candidates to return
 * @returns Promise with matching candidates
 */
export const getMatchingCandidates = async (
  jobThreadId: string,
  topK: number = 3
) => {
  return api.get(`/api/matches/job/${jobThreadId}/candidates`, {
    params: { top_k: topK },
  });
};

/**
 * Find job postings that match a candidate
 * @param candidateThreadId The thread ID of the candidate
 * @param topK Number of jobs to return
 * @returns Promise with matching jobs
 */
export const getMatchingJobs = async (
  candidateThreadId: string,
  topK: number = 3
) => {
  console.log(
    `API Call: getMatchingJobs for candidate thread ${candidateThreadId}`
  );
  return api.get(`/api/matches/jobs/${candidateThreadId}`, {
    params: { top_k: topK },
  });
};

// User-related API calls
export const getCurrentUser = async () => {
  console.log("Calling getCurrentUser API");
  const token = localStorage.getItem("auth_token");
  return api.get("/api/auth/me");
};

// Onboarding-related API calls
export const setOnboardingPreferences = (preferences: {
  max_emails_to_index: number;
}) => {
  console.log("Calling onboarding API with preferences:", preferences);
  return api.post("/api/auth/onboarding", preferences);
};

/**
 * Fetches new emails that have arrived since the given timestamp
 * @param lastCheckedTimestamp ISO format timestamp of last check (e.g., '2023-03-17T12:30:45Z')
 * @param maxResults Maximum number of results to return
 * @returns Promise with new emails data
 */
export const getNewEmails = async (
  lastCheckedTimestamp?: string,
  maxResults: number = 20,
  useGmailQuery: boolean = true
) => {
  if (useGmailQuery) {
    console.log("Fetching new emails using Gmail query syntax");
  } else {
    console.log(
      `Fetching new emails since ${lastCheckedTimestamp || "last hour"}`
    );
  }

  try {
    // Add timestamp to avoid caching
    const cacheBuster = new Date().getTime();

    const response = await api.get("/api/emails/new", {
      params: {
        last_checked_timestamp: lastCheckedTimestamp,
        max_results: maxResults,
        use_gmail_query: useGmailQuery,
        t: cacheBuster,
      },
    });

    // Handle empty response properly
    if (!response.data) {
      console.log("No data returned from new emails endpoint");
      return {
        data: { count: 0, emails: [], timestamp: new Date().toISOString() },
      };
    }

    console.log(`Found ${response.data.count || 0} new emails`);

    // Ensure data format is consistent
    if (!response.data.emails) {
      response.data.emails = [];
    }

    if (!response.data.count) {
      response.data.count = response.data.emails.length || 0;
    }

    if (!response.data.timestamp) {
      response.data.timestamp = new Date().toISOString();
    }

    return response;
  } catch (error) {
    console.error("Error fetching new emails:", error);
    // Return a valid response format even on error
    return {
      data: {
        count: 0,
        emails: [],
        timestamp: new Date().toISOString(),
        error: error.message || "Unknown error",
      },
    };
  }
};

/**
 * Refreshes emails by pulling the latest data from the database
 * This leverages the background service's work without querying Gmail directly
 * @param maxResults Maximum number of results to return
 * @returns Promise with refreshed emails from database
 */
export const refreshEmailsFromDatabase = async (maxResults: number = 20) => {
  console.log("Refreshing emails from database");
  try {
    // Add timestamp to avoid caching
    const cacheBuster = new Date().getTime();

    // Use the existing emails endpoint but with a refresh_db=true parameter
    const response = await api.get("/api/emails", {
      params: {
        page: 1,
        page_size: maxResults,
        refresh_db: true,
        t: cacheBuster,
      },
    });

    console.log(`Refreshed ${response.data?.length || 0} emails from database`);
    return response;
  } catch (error) {
    console.error("Error refreshing emails from database:", error);
    throw error;
  }
};

export default api;
