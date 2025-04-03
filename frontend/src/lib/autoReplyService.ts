import * as api from "./api";

/**
 * Cross-category context types for different email classifications
 */
export const SPECIALIZED_CATEGORIES = ["Job Posting", "Candidate"];
export const GENERAL_CATEGORIES = [
  "Questions",
  "Discussion Topics",
  "Events",
  "Other",
];
export const SKIP_CATEGORIES = ["Irrelevant"];

/**
 * Gather appropriate context for auto-reply generation based on email classification
 * This function determines whether to use specialized matching or cross-category context
 *
 * @param threadId The email thread ID
 * @param primaryCategory The primary classification of the thread (e.g., "Questions", "Job Posting")
 * @param timestamp Optional timestamp for cache-busting (defaults to current time)
 * @returns Promise with context data for the auto-reply
 */
export const gatherAutoReplyContext = async (
  threadId: string,
  primaryCategory: string,
  timestamp: number = Date.now()
) => {
  try {
    // Skip processing for irrelevant emails
    if (SKIP_CATEGORIES.includes(primaryCategory)) {
      console.log(
        `Skipping auto-reply context gathering for ${primaryCategory} email`
      );
      return { data: [] };
    }

    // Specialized matching for job postings and candidates
    if (primaryCategory === "Job Posting") {
      // For job postings, find matching candidates
      return await api.getMatchingCandidates(threadId);
    } else if (primaryCategory === "Candidate") {
      // For candidates, find matching jobs
      return await api.getMatchingJobs(threadId);
    } else if (GENERAL_CATEGORIES.includes(primaryCategory)) {
      // For general categories (Questions, Discussion Topics, Events, Other)
      // use cross-category context gathering
      return await api.getSimilarThreadsMultiCategory(
        threadId,
        GENERAL_CATEGORIES, // Include all general categories
        SPECIALIZED_CATEGORIES.concat(SKIP_CATEGORIES), // Exclude specialized and skip categories
        10, // Get top 10 results
        timestamp // Use provided timestamp for cache-busting
      );
    } else {
      // Fallback for any unrecognized categories - use single category context
      return await api.getSimilarThreads(threadId, primaryCategory, 5);
    }
  } catch (error) {
    console.error("Error gathering auto-reply context:", error);
    // Return empty context on error rather than failing completely
    return { data: [] };
  }
};
