import * as api from './api';

/**
 * Cross-category context types for different email classifications
 */
export const SPECIALIZED_CATEGORIES = ['Job Posting', 'Candidate'];
export const GENERAL_CATEGORIES = ['Questions', 'Discussion Topics', 'Events', 'Other'];

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
    // Specialized matching for job postings and candidates
    if (primaryCategory === 'Job Posting') {
      // For job postings, find matching candidates
      return await api.getMatchingCandidates(threadId);
    } else if (primaryCategory === 'Candidate') {
      // For candidates, find matching jobs
      return await api.getMatchingJobs(threadId);
    } else if (GENERAL_CATEGORIES.includes(primaryCategory)) {
      // For general categories (Questions, Discussion Topics, Events, Other)
      // use cross-category context gathering
      return await api.getSimilarThreadsMultiCategory(
        threadId,
        GENERAL_CATEGORIES, // Include all general categories
        SPECIALIZED_CATEGORIES, // Exclude specialized categories
        10, // Get top 10 results
        timestamp // Use provided timestamp for cache-busting
      );
    } else {
      // Fallback for any unrecognized categories - use single category context
      return await api.getSimilarThreads(threadId, primaryCategory, 5);
    }
  } catch (error) {
    console.error('Error gathering auto-reply context:', error);
    // Return empty context on error rather than failing completely
    return { data: [] };
  }
};

/**
 * Generate an enhanced auto-reply for an email thread with cross-category context
 * This preserves existing functionality while adding cross-category context for general emails
 * 
 * @param threadId The email thread ID
 * @returns Promise with the generated auto-reply
 */
export const generateEnhancedAutoReply = async (threadId: string) => {
  try {
    // Get thread classification
    const classification = await api.classifyThread(threadId);
    const primaryCategory = classification.data.primary_label;
    
    // Get thread content
    const thread = await api.getThread(threadId);
    
    // Get appropriate context based on classification
    const context = await gatherAutoReplyContext(threadId, primaryCategory);
    
    // Generate reply using the context
    return api.post("/api/auto-reply/generate", {
      thread_id: threadId,
      primary_category: primaryCategory,
      context: context.data,
      use_cross_category: GENERAL_CATEGORIES.includes(primaryCategory), // Flag for backend
      timestamp: Date.now() // Add timestamp for cache-busting
    });
  } catch (error) {
    console.error('Error generating enhanced auto-reply:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

/**
 * Check and auto-reply to new emails with enhanced cross-category context
 * This is a drop-in replacement for the original triggerAutoReply with enhanced context
 * 
 * @param maxResults Maximum number of emails to process
 * @param useHtml Whether to use HTML formatting in replies
 * @returns Promise with auto-reply results
 */
export const triggerEnhancedAutoReply = async (maxResults = 20, useHtml = false) => {
  // We'll delegate to the backend to handle the auto-reply generation with enhanced context
  return api.post("/api/auto-reply/check-new-emails-enhanced", {
    max_results: maxResults,
    use_html: useHtml,
    use_cross_category: true, // Enable cross-category context
    timestamp: Date.now() // Add timestamp for cache-busting
  });
};
