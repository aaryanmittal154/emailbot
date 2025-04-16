"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  SimpleGrid,
  Spinner,
  Button,
  Flex,
  useToast,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Divider,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tooltip,
  HStack,
  Switch,
  FormLabel,
} from "@chakra-ui/react";
import {
  ArrowBackIcon,
  ChevronDownIcon,
  InfoIcon,
  SearchIcon,
} from "@chakra-ui/icons";
import { FiSettings, FiLogOut, FiMail, FiRefreshCw } from "react-icons/fi";
import axios from "axios";
import AutoReplyButton from "../../components/AutoReplyButton";
import VacationResponderSettings from "../../components/VacationResponderSettings";
import {
  LabelSuggestions,
  ThreadLabels,
  LabelManager,
} from "../../components/EmailLabels";
import OnboardingModal from "../../components/OnboardingModal";
import {
  getEmails,
  getThread,
  syncEmails,
  searchEmails,
  indexEmails,
  getEmailsByLabel,
  classifyThread,
  suggestLabelsForThread,
  getSimilarThreads,
  getNewEmails,
  refreshEmailsFromDatabase,
  getCurrentUser,
} from "../../lib/api";
import PromptManagement from "../../components/PromptManagement";
import {
  getBackgroundServiceStatus,
  toggleBackgroundService,
} from "../../lib/backgroundServiceApi";
import { motion } from "framer-motion";
import DashboardLayout from "../../components/ui/DashboardLayout";
import he from "he"; // Add this import
import { getBackgroundServiceOAuthUrl } from "../../lib/backgroundServiceApi";

const BASE_URL = "https://emailbot-k8s7.onrender.com";

interface UserData {
  id: number;
  email: string;
  full_name: string;
  picture: string;
  is_onboarded?: boolean;
  max_emails_to_index?: number;
}

interface EmailData {
  id: number;
  gmail_id: string;
  thread_id: string;
  sender: string;
  recipients: string[];
  subject: string;
  snippet: string;
  date: string;
  labels: string[];
  has_attachment: boolean;
  is_read: boolean;
  body?: string;
  internal_date?: number;
  message_position?: {
    is_first: boolean;
    is_last: boolean;
  };
}

interface ThreadData {
  thread_id: string;
  messages: EmailData[];
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
}

// Add new interface for semantic search results
interface SemanticSearchResult {
  thread_id: string;
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
  text_preview: string;
  full_content: string;
  score: number;
}

interface SearchResponse {
  query: string;
  results: SemanticSearchResult[];
  count: number;
}

// Helper function to decode HTML entities
const decodeHtmlEntities = (text: string | null | undefined): string => {
  if (!text) return "";
  try {
    // Use a library like 'he' for robust decoding
    return he.decode(text);
  } catch (e) {
    console.error("Error decoding HTML entities:", e);
    // Fallback: basic replacements (less reliable)
    return text
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
};

// Function to extract and clean the relevant HTML part
const getCleanHtmlBody = (rawBody: string | null | undefined): string => {
  if (!rawBody) return "";

  const escapedDivMatch = rawBody.match(
    /(&lt;div.*?&gt;(?:.|\n)*?&lt;\/div&gt;)/s
  ); // Find outermost escaped div
  const unescapedDivMatch = rawBody.match(/(<div.*?>(?:.|\n)*?<\/div>)/s); // Find outermost unescaped div

  // Case 1: Both unescaped and escaped divs are present (common in replies)
  // Prioritize the unescaped version as it's likely the main HTML part intended for rendering this message segment.
  if (unescapedDivMatch && unescapedDivMatch[1] && escapedDivMatch) {
    console.log(
      "getCleanHtmlBody: Found both unescaped and escaped HTML, using unescaped."
    );
    // Decode entities just in case some exist within the unescaped block
    return decodeHtmlEntities(unescapedDivMatch[1]);
  }

  // Case 2: Only escaped HTML div is present
  if (escapedDivMatch && escapedDivMatch[1] && !unescapedDivMatch) {
    console.log(
      "getCleanHtmlBody: Found only escaped HTML, decoding and using it."
    );
    return decodeHtmlEntities(escapedDivMatch[1]);
  }

  // Case 3: Only unescaped HTML div is present (or no escaped found)
  if (unescapedDivMatch && unescapedDivMatch[1]) {
    console.log(
      "getCleanHtmlBody: Found unescaped HTML (or no escaped), using it."
    );
    // Decode entities just in case some exist within the block
    return decodeHtmlEntities(unescapedDivMatch[1]);
  }

  // Case 4: No <div> blocks found, check for other common HTML tags like <p>
  if (
    rawBody.match(/<p.*?>/i) ||
    rawBody.match(/<span.*?>/i) ||
    rawBody.match(/<a href/i)
  ) {
    console.log("getCleanHtmlBody: Found other HTML tags, decoding full body.");
    // Assume the whole body is intended as HTML, decode potential entities
    return decodeHtmlEntities(rawBody);
  }

  // Case 5: Fallback - Assume plain text
  // Decode entities and convert newlines to <br> for rendering.
  console.log(
    "getCleanHtmlBody: No significant HTML found, treating as plain text."
  );
  // Use regex \r?\n to handle both LF and CRLF line endings
  return decodeHtmlEntities(rawBody).replace(/\r?\n/g, "<br />");
};

export default function Dashboard() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [emails, setEmails] = useState<EmailData[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadData | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Add new state variables for semantic search
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(
    null
  );
  const [isIndexing, setIsIndexing] = useState(false);

  // Modal for indexing progress
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [jobPostings, setJobPostings] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [otherEmails, setOtherEmails] = useState<any[]>([]);
  const [irrelevantEmails, setIrrelevantEmails] = useState<any[]>([]);
  const [loadingLabeled, setLoadingLabeled] = useState<boolean>(false);
  const [selectedLabeledEmail, setSelectedLabeledEmail] = useState<any>(null);
  const [extractedFields, setExtractedFields] = useState<any>(null);

  // New state variables for matching
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [sharedCandidates, setSharedCandidates] = useState<any[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(false);

  // Add state for email content loading
  const [isEmailContentLoading, setIsEmailContentLoading] =
    useState<boolean>(false);

  // Add state for checking emails
  const [isCheckingEmails, setIsCheckingEmails] = useState(false);
  // Add state for tracking active tab
  const [tabIndex, setTabIndex] = useState(0);
  // Add state for onboarding modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Map thread IDs to their primary category for efficient Inbox label display
  const [threadIdToCategoryMap, setThreadIdToCategoryMap] = useState<
    Map<string, string>
  >(new Map());

  // State for background auto-reply service
  const [isAutoReplyEnabled, setIsAutoReplyEnabled] = useState(false);
  const [isLoadingAutoReplyStatus, setIsLoadingAutoReplyStatus] =
    useState(true);
  const [isTogglingAutoReply, setIsTogglingAutoReply] = useState(false); // Prevent double toggles

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      console.log("No token found in localStorage, redirecting to login");
      router.push("/");
      return;
    }

    console.log(`Found token in localStorage: ${token.substring(0, 10)}...`);

    // Set up axios defaults
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    console.log("Set Authorization header for axios");

    // Set base URL for API requests
    axios.defaults.baseURL = BASE_URL;
    console.log(`Set base URL for axios: ${BASE_URL}`);

    const fetchUserData = async () => {
      try {
        console.log("Fetching user data using getCurrentUser API");
        const response = await getCurrentUser();
        console.log("User data fetched successfully:", response.data);
        setUser(response.data);

        // Check if user needs onboarding
        if (response.data.is_onboarded === false) {
          console.log("User needs onboarding, is_onboarded is FALSE");
          setShowOnboardingModal(true);
        } else {
          console.log("User is already onboarded, is_onboarded is TRUE");
          // Load emails from database on initial load/refresh
          setIsCheckingEmails(true);
          console.log("Loading emails from database on app start/refresh");

          // Use the user's preferred email count instead of hardcoded value
          const emailCount = response.data.max_emails_to_index || 10;
          console.log(`Using user's selected email count: ${emailCount}`);

          // Use refreshEmailsFromDatabase instead of fetchEmails to ensure we're loading from DB
          const emailsResponse = await refreshEmailsFromDatabase(emailCount);

          if (emailsResponse && emailsResponse.data) {
            // Sort the refreshed emails by date (newest first)
            const refreshedEmails = [...emailsResponse.data].sort((a, b) => {
              const dateA = a.date || "";
              const dateB = b.date || "";
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });

            // Update the main emails list
            setEmails(refreshedEmails);
            setHasMore(refreshedEmails.length === emailCount);
            setPage(1);
          }

          // Also fetch labeled emails from database
          await fetchLabeledEmails();

          // Fetch background service status
          try {
            console.log("Fetching background service status...");
            const statusResponse = await getBackgroundServiceStatus();
            console.log("Background service status:", statusResponse.data);
            setIsAutoReplyEnabled(statusResponse.data.is_enabled);
          } catch (statusError) {
            console.error(
              "Error fetching background service status:",
              statusError
            );
            toast({
              title: "Error fetching settings",
              description:
                "Could not load the status of the background auto-reply service.",
              status: "error",
              duration: 5000,
              isClosable: true,
            });
          } finally {
            setIsLoadingAutoReplyStatus(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as any).response === "object"
        ) {
          console.log(
            "Axios error details:",
            error.response
              ? {
                  status: (error as any).response.status,
                  statusText: (error as any).response.statusText,
                  data: (error as any).response.data,
                }
              : "No response details"
          );
        }

        toast({
          title: "Authentication error",
          description: "Please login again.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        localStorage.removeItem("auth_token");
        router.push("/");
      } finally {
        setIsLoading(false);
        setIsCheckingEmails(false);
      }
    };

    fetchUserData();
  }, [router, toast]);

  useEffect(() => {
    if (user) {
      // Fetch labeled emails for each category
      fetchLabeledEmails();

      // Check if there's a thread parameter in the URL
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        const threadId = urlParams.get("thread");

        if (threadId) {
          // If there's a thread ID in the URL, fetch and display that thread
          console.log(`Loading thread from URL parameter: ${threadId}`);
          fetchThread(threadId);
        }
      }
    }
  }, [user]);

  // Add polling for new emails
  useEffect(() => {
    console.log("Setting up email refresh interval...");

    const intervalId = setInterval(() => {
      if (!isCheckingEmails) {
        console.log("Polling: Checking for new emails...");
        handleCheckNewEmails();
      } else {
        console.log("Polling: Skipping check, refresh already in progress.");
      }
    }, 60000); // Check every 60 seconds

    // Cleanup function to clear the interval when the component unmounts
    return () => {
      console.log("Clearing email refresh interval.");
      clearInterval(intervalId);
    };
  }, [isCheckingEmails]); // Dependency array includes isCheckingEmails to prevent concurrent checks

  useEffect(() => {
    // Set up a handler for browser history pop state (back/forward buttons)
    const handlePopState = (event: PopStateEvent) => {
      if (event.state === null || event.state.view === "inbox") {
        // User navigated back to inbox view
        closeThread();
      }
    };

    // Add the event listener
    window.addEventListener("popstate", handlePopState);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const fetchEmails = async (page = 1, append = false) => {
    try {
      // Check if token exists before making request
      const token = localStorage.getItem("auth_token");
      if (!token) {
        console.log("No token found, redirecting to login");
        router.push("/");
        return;
      }

      // Ensure authorization header is set before each request
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      setIsLoading(true);
      console.log(`Fetching emails page ${page}, append: ${append}`);

      // Add cache-busting timestamp
      const timestamp = new Date().getTime();

      // Use the user's preferred email count
      const emailCount = user?.max_emails_to_index || 10;

      // Construct the absolute URL using the environment variable
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "https://emailbot-k8s7.onrender.com"; // Provide a fallback if needed
      const endpoint = `${apiUrl}/api/emails/`;

      console.log(`Making request to: ${endpoint}`); // Log the exact URL being called

      const response = await axios.get(endpoint, {
        params: {
          page,
          page_size: emailCount,
          // priority_categories: ["Job Posting", "Candidate"], // Keep commented out unless needed
          group_threads: true,
          include_latest_per_thread: true,
          refresh_db: true, // Add this line to force DB query on backend
          t: timestamp,
        },
      });

      // Sort emails by date (newest first) before updating state
      let sortedEmails = response.data;
      if (Array.isArray(sortedEmails)) {
        sortedEmails.sort((a, b) => {
          const dateA = a.date || "";
          const dateB = b.date || "";
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      }

      if (append) {
        setEmails((prev) => {
          const combined = [...prev, ...sortedEmails];
          // Ensure combined list is sorted
          return combined.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          });
        });
      } else {
        setEmails(sortedEmails);
      }

      setHasMore(response.data.length === emailCount);
      setPage(page);
    } catch (error: any) {
      console.error("Error fetching emails:", error);

      // Handle 401 Unauthorized error
      if (error.response && error.response.status === 401) {
        console.log("Authentication error, redirecting to login");
        localStorage.removeItem("auth_token"); // Clear invalid token
        toast({
          title: "Session expired",
          description: "Please log in again to continue",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        router.push("/");
      } else {
        toast({
          title: "Error",
          description: "Could not fetch emails. Please try again.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const syncEmails = async () => {
    try {
      setIsSyncing(true);
      toast({
        title: "Syncing emails",
        description: "This may take a while...",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      await axios.post("/api/emails/sync", {
        max_results: 500,
        apply_thread_grouping: true,
      });

      toast({
        title: "Sync started",
        description: "Emails are being synchronized in the background",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Wait a moment then refresh the email list
      setTimeout(() => {
        fetchEmails(1, false); // Fixed: using new parameter format (page, append)
        setIsSyncing(false);
      }, 3000);
    } catch (error) {
      console.error("Error syncing emails:", error);
      toast({
        title: "Sync error",
        description: "Could not synchronize emails",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      setIsSyncing(false);
    }
  };

  const loadMoreEmails = async () => {
    if (hasMore && !isLoading) {
      await fetchEmails(page + 1, true);
    }
  };

  const handleLogout = async () => {
    try {
      // Call the backend logout endpoint to disable background service
      const token = localStorage.getItem("auth_token");
      if (token) {
        await axios.post(
          "/api/auth/logout",
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Always clear local storage and redirect, even if the API call fails
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_id");
      router.push("/");
    }
  };

  const fetchThread = async (threadId: string) => {
    try {
      // Show loading indicator immediately
      setIsThreadLoading(true);
      setIsEmailContentLoading(true);

      console.log(`Loading thread ${threadId}`);
      // Use the correct API endpoint from the api.ts file
      const response = await getThread(threadId);
      const threadData = response.data;
      console.log("Thread data:", threadData);

      // Add a state to browser history for this email view
      window.history.pushState(
        { view: "email", threadId },
        "",
        `?thread=${threadId}`
      );

      // Check if this thread has a specific category label
      const threadLabels = threadData.labels || [];
      const categoryLabels = [
        "Job Posting",
        "Candidate",
        "Question",
        "Follow-up",
        "Resource"
      ];
      const matchedCategory = threadLabels.find((label: string) =>
        categoryLabels.includes(label)
      );

      if (matchedCategory) {
        console.log(
          `Thread has category: ${matchedCategory}, opening in specialized view`
        );
        // For all categorized emails, first just display the thread without classification
        setSelectedLabeledEmail({
          ...threadData,
          category: matchedCategory,
        });

        // If in inbox tab, also set selectedThread to null to ensure we don't show both views
        if (tabIndex === 0) {
          setSelectedThread(null);
        }

        setIsThreadLoading(false);
        setIsEmailContentLoading(false);

        // Auto-load details for Job Posting and Candidate emails
        if (
          matchedCategory === "Job Posting" ||
          matchedCategory === "Candidate"
        ) {
          // Add a small delay to ensure the UI is updated first
          setTimeout(() => {
            loadEmailDetails();
          }, 500);
        }
      } else {
        // If no category, just show the regular thread view
        setSelectedThread(threadData);

        // Clear any selected labeled email
        setSelectedLabeledEmail(null);

        setIsThreadLoading(false);
        setIsEmailContentLoading(false);
      }
    } catch (error: any) {
      console.error("Error fetching thread:", error);
      toast({
        title: "Error loading email",
        description: error.message || "Could not load email thread",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsThreadLoading(false);
      setIsEmailContentLoading(false);
    }
  };

  // Helper function to format sender names consistently
  const formatSenderName = (sender: string) => {
    if (!sender) return "Unknown";

    // If it's just an email address without a name
    if (sender.includes("@") && !sender.includes("<")) {
      // Try to extract a name from the email
      const namePart = sender.split("@")[0];
      // Convert to title case and replace dots/underscores with spaces
      return namePart
        .split(/[._]/)
        .map(
          (part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
        )
        .join(" ");
    }

    // If it's in the format "Name <email@example.com>"
    if (sender.includes("<")) {
      const name = sender.split("<")[0].trim();
      return name || "Unknown";
    }

    return sender;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const closeThread = () => {
    // Add or replace a history state for the inbox view
    window.history.pushState({ view: "inbox" }, "", "?");

    setSelectedThread(null);
    setSelectedLabeledEmail(null);
    setExtractedFields(null);
    setTopMatches([]);
    setSharedCandidates([]);
  };

  // Add semantic search function
  const handleSemanticSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const response = await axios.get("/api/emails/semantic-search", {
        params: {
          q: searchQuery,
          top_k: 20,
        },
      });

      console.log("Semantic search results:", response.data);
      setSearchResults(response.data);
    } catch (error) {
      console.error("Error performing semantic search:", error);
      toast({
        title: "Search Error",
        description: "Could not perform semantic search",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Function to start indexing threads for search
  const startIndexingThreads = async () => {
    try {
      setIsIndexing(true);
      onOpen(); // Open the modal

      const response = await axios.post("/api/emails/semantic-index", {
        max_threads: 200,
      });

      toast({
        title: "Indexing Started",
        description: response.data.message,
        status: "info",
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error indexing threads:", error);
      toast({
        title: "Indexing Error",
        description: "Could not start indexing threads",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      // Set a timeout to close the modal and reset state after 10 seconds
      setTimeout(() => {
        setIsIndexing(false);
        onClose();
      }, 10000);
    }
  };

  // Handle search when Enter key is pressed
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSemanticSearch();
    }
  };

  const fetchLabeledEmails = async () => {
    setLoadingLabeled(true);
    try {
      // Add cache buster to ensure fresh data
      const cacheBuster = new Date().getTime();

      // Fetch all categories in parallel with refresh_db=true parameter
      const [
        jobPostingsRes,
        candidatesRes,
        eventsRes,
        questionsRes,
        resourceRes,
        discussionsRes,
        otherRes,
        irrelevantRes,
      ] = await Promise.all([
        getEmailsByLabel("Job Posting", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Candidate", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Event", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Questions", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Resource", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Discussion Topics", {
          refresh_db: true,
          t: cacheBuster,
        }),
        getEmailsByLabel("Other", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Irrelevant", { refresh_db: true, t: cacheBuster }),
      ]);

      // Create the mapping from thread_id to category
      const newMap = new Map<string, string>();
      const categories = {
        "Job Posting": jobPostingsRes.data || [],
        Candidate: candidatesRes.data || [],
        Event: eventsRes.data || [],
        Questions: questionsRes.data || [],
        Resource: resourceRes.data || [],
        "Discussion Topics": discussionsRes.data || [],
        Other: otherRes.data || [],
        Irrelevant: irrelevantRes.data || [],
      };

      for (const [categoryName, emailsInCategory] of Object.entries(
        categories
      )) {
        if (Array.isArray(emailsInCategory)) {
          emailsInCategory.forEach((email: any) => {
            if (email && email.thread_id) {
              newMap.set(email.thread_id, categoryName);
            }
          });
        }
      }
      setThreadIdToCategoryMap(newMap);
      console.log("Updated threadIdToCategoryMap:", newMap);

      // Sort function for emails (newest first)
      const sortByDate = (emails: any[]) => {
        return [...emails].sort((a, b) => {
          const dateA = a.last_updated || a.date || "";
          const dateB = b.last_updated || b.date || "";
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      };

      // Update state with fresh data, ensuring all are sorted by date
      setJobPostings(sortByDate(jobPostingsRes.data || []));
      setCandidates(sortByDate(candidatesRes.data || []));
      setEvents(sortByDate(eventsRes.data || []));
      setQuestions(sortByDate(questionsRes.data || []));
      setDiscussions(sortByDate(discussionsRes.data || []));
      setResources(sortByDate(resourceRes.data || []));
      setOtherEmails(sortByDate(otherRes.data || []));
      setIrrelevantEmails(sortByDate(irrelevantRes.data || []));
      console.log("Refreshed all labeled categories from database");
    } catch (error) {
      console.error("Error fetching labeled emails:", error);
      toast({
        title: "Error",
        description: "Could not refresh labeled emails. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoadingLabeled(false);
    }
  };

  const handleSelectLabeledEmail = async (email: any, category: string) => {
    try {
      // Show loading indicator immediately
      setIsEmailContentLoading(true);

      // Clear previously loaded details
      setExtractedFields(null);
      setTopMatches([]);
      setSharedCandidates([]);

      let thread = email;
      let threadResponse;

      // Add a state to browser history for this email view
      window.history.pushState(
        { view: "email", threadId: email.thread_id },
        "",
        `?category=${category}&thread=${email.thread_id}`
      );

      // Check if we need to fetch the full thread (if the passed email doesn't have complete data)
      if (!email.messages) {
        // First fetch the full thread
        console.log(`Loading thread ${email.thread_id}`);
        threadResponse = await getThread(email.thread_id);
        thread = threadResponse.data;
      }

      // First just display the thread without classification
      setSelectedLabeledEmail({
        ...thread,
        category,
      });

      // Turn off loading indicator to show the email quickly
      setIsEmailContentLoading(false);

      // For Job Posting and Candidate emails, auto-load details in the background
      if (category === "Job Posting" || category === "Candidate") {
        // Small delay to ensure the UI has updated first
        setTimeout(() => {
          loadEmailDetails();
        }, 500);
      }
    } catch (error: any) {
      console.error("Error fetching email content:", error);
      toast({
        title: "Error fetching email content",
        description:
          error.message || "An error occurred while fetching email content",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsEmailContentLoading(false);
    }
  };

  // New function to load email details (classification and matches) on demand
  const loadEmailDetails = async () => {
    if (!selectedLabeledEmail) return;

    const thread = selectedLabeledEmail;
    const category = selectedLabeledEmail.category;

    // Only proceed for Job Posting and Candidate categories
    if (category !== "Job Posting" && category !== "Candidate") return;

    try {
      setIsEmailContentLoading(true);

      // Get the classified fields
      console.log(`Classifying thread ${thread.thread_id}`);
      const classificationResponse = await classifyThread(thread.thread_id);
      const classification = classificationResponse.data;

      setSelectedLabeledEmail({
        ...thread,
        classification_data: classification,
      });
      setExtractedFields(classification.fields);

      // Fetch top matches and shared candidates
      setIsLoadingMatches(true);
      try {
        // Get top matching threads with the opposite label
        // If current is job posting, find candidates and vice versa
        const targetLabel =
          category === "Job Posting" ? "Candidate" : "Job Posting";

        console.log(
          `Finding similar threads for ${thread.thread_id} with target ${targetLabel}`
        );
        const matchResponse = await getSimilarThreads(
          thread.thread_id,
          targetLabel,
          5
        );

        // Transform the results to match our UI format
        const similarThreads = matchResponse.data.similar_threads.map(
          (thread: any) => {
            // Extract classification fields
            const classificationData = thread.classification_data || {};
            const fields = classificationData.fields || {};

            // Common properties
            const result = {
              thread_id: thread.thread_id,
              subject: thread.subject,
              match_percentage: Math.round(thread.score * 100), // Convert similarity score to percentage
            };

            // Add specific properties based on the target label
            if (targetLabel === "Candidate") {
              return {
                ...result,
                key_skills: fields.skills || "Not specified",
                experience_years: fields.experience || "Not specified",
              };
            } else {
              // For job postings
              return {
                ...result,
                company_name: fields.company_name || "Not specified",
                location: fields.location || "Remote",
                salary_range: fields.salary_range || "Not specified",
              };
            }
          }
        );

        setTopMatches(similarThreads);

        // For job postings, set mock shared candidates data
        if (category === "Job Posting") {
          setSharedCandidates([
            {
              thread_id: "mock_1",
              subject: "Jane Smith - Software Engineer",
              match_percentage: 92,
              key_skills: "React, TypeScript, GraphQL",
              experience_years: "4 years",
              shared_date: "3 days ago",
            },
            {
              thread_id: "mock_2",
              subject: "Michael Johnson - Frontend Developer",
              match_percentage: 85,
              key_skills: "JavaScript, CSS, React",
              experience_years: "3 years",
              shared_date: "3 days ago",
            },
            {
              thread_id: "mock_3",
              subject: "Sarah Williams - Full Stack Engineer",
              match_percentage: 78,
              key_skills: "Node.js, React, MongoDB",
              experience_years: "5 years",
              shared_date: "3 days ago",
            },
          ]);
        } else {
          setSharedCandidates([]);
        }
      } catch (error: any) {
        console.error("Error fetching matches:", error);
        toast({
          title: "Error fetching matches",
          description:
            error.message || "An error occurred while fetching matches",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoadingMatches(false);
      }
    } catch (error: any) {
      console.error("Error fetching email details:", error);
      toast({
        title: "Error fetching email details",
        description:
          error.message || "An error occurred while loading email details",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsEmailContentLoading(false);
    }
  };

  const renderLabeledEmailList = (
    emails: any[] | null | undefined,
    category: string
  ) => {
    // Handle loading state
    if (loadingLabeled) {
      return (
        <Box textAlign="center" p={4}>
          <Spinner size="md" />
          <Text mt={2}>Loading {category} emails...</Text>
        </Box>
      );
    }

    // Handle null/undefined emails or empty array
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return (
        <Box textAlign="center" p={4} bg="gray.50" borderRadius="md">
          <Text color="gray.500">No {category} emails found</Text>
        </Box>
      );
    }

    // Special rendering for Job Postings
    if (category === "Job Posting") {
      return (
        <VStack spacing={3} align="stretch">
          {emails.map((email) => (
            <Box
              key={email.thread_id}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              _hover={{ bg: "blue.50" }}
              cursor="pointer"
              onClick={() => handleSelectLabeledEmail(email, category)}
              borderLeftWidth="4px"
              borderLeftColor="blue.500"
            >
              <Heading size="sm">{email.subject || "(No Subject)"}</Heading>

              {/* If we have cached classification data */}
              {email.classification_data?.fields ? (
                <Box mt={2}>
                  <Flex align="center" mt={1}>
                    <Badge colorScheme="blue" mr={2}>
                      Company
                    </Badge>
                    <Text fontWeight="medium">
                      {email.classification_data.fields.company_name ||
                        "Unknown"}
                    </Text>
                  </Flex>
                  <Flex align="center" mt={1}>
                    <Badge colorScheme="green" mr={2}>
                      Position
                    </Badge>
                    <Text>
                      {email.classification_data.fields.position ||
                        "Unknown position"}
                    </Text>
                  </Flex>
                  <Flex align="center" mt={1}>
                    <Badge colorScheme="purple" mr={2}>
                      Location
                    </Badge>
                    <Text>
                      {email.classification_data.fields.location ||
                        "No location specified"}
                    </Text>
                  </Flex>

                  {email.classification_data.fields.salary_range && (
                    <Flex align="center" mt={1}>
                      <Badge colorScheme="teal" mr={2}>
                        Salary
                      </Badge>
                      <Text>
                        {email.classification_data.fields.salary_range}
                      </Text>
                    </Flex>
                  )}
                </Box>
              ) : (
                <Text fontSize="sm" color="gray.600" noOfLines={1} mt={1}>
                  {email.latest_message?.snippet || "No preview available"}
                </Text>
              )}

              <Flex justify="space-between" mt={2}>
                <Text fontSize="xs" color="gray.500">
                  {email.message_count} messages
                </Text>
                <Text fontSize="xs" color="gray.500">
                  {formatDate(email.last_updated)}
                </Text>
              </Flex>
            </Box>
          ))}
        </VStack>
      );
    }

    // Special rendering for Candidates
    if (category === "Candidate") {
      return (
        <VStack spacing={3} align="stretch">
          {emails.map((email) => {
            // Extract candidate name from subject based on patterns
            let candidateName = "";

            if (email.subject?.includes("Seeking")) {
              candidateName = "Software Engineer Candidate";
            } else if (email.subject?.includes("Friend looking for")) {
              candidateName = "John"; // From the snippet: "...details about John"
            } else if (email.subject?.includes("Tell me more about")) {
              candidateName = email.subject.replace("Tell me more about ", "");
            } else if (email.latest_message?.snippet?.includes("Jane")) {
              candidateName = "Jane";
            } else {
              candidateName = email.subject?.replace(/^Re:\s*/i, "");
            }

            // Determine if we have location info
            const locationMatch = email.latest_message?.snippet?.match(
              /in\s(the\s)?([\w\s]+)\s(area|region)/i
            );
            const location = locationMatch
              ? locationMatch[2]
              : email.latest_message?.snippet?.includes("Palo Alto")
              ? "Palo Alto"
              : null;

            return (
              <Box
                key={email.thread_id}
                p={4}
                borderWidth="1px"
                borderRadius="md"
                _hover={{ bg: "red.50" }}
                cursor="pointer"
                onClick={() => handleSelectLabeledEmail(email, category)}
                borderLeftWidth="4px"
                borderLeftColor="red.500"
              >
                <Heading size="sm" color="red.600">
                  {candidateName}
                </Heading>

                <Flex mt={2} mb={2} wrap="wrap" gap={2}>
                  {/* Extract position if possible */}
                  {email.subject?.toLowerCase().includes("engineer") && (
                    <Badge colorScheme="green" px={2} py={1}>
                      Software Engineer
                    </Badge>
                  )}

                  {email.subject
                    ?.toLowerCase()
                    .includes("looking for a job") && (
                    <Badge colorScheme="green" px={2} py={1}>
                      Job Seeker
                    </Badge>
                  )}

                  {/* Extract location if mentioned in snippet */}
                  {location && (
                    <Badge colorScheme="purple" px={2} py={1}>
                      {location}
                    </Badge>
                  )}

                  {/* If snippet mentions experience or skill */}
                  {email.latest_message?.snippet
                    ?.toLowerCase()
                    .includes("experience") && (
                    <Badge colorScheme="blue" px={2} py={1}>
                      Experienced
                    </Badge>
                  )}

                  {email.latest_message?.snippet
                    ?.toLowerCase()
                    .includes("strong candidate") && (
                    <Badge colorScheme="blue" px={2} py={1}>
                      Strong Candidate
                    </Badge>
                  )}
                </Flex>

                <Text fontSize="sm" color="gray.700" noOfLines={2}>
                  {email.latest_message?.snippet || "No preview available"}
                </Text>

                <Flex justify="space-between" mt={2}>
                  <Text fontSize="xs" color="gray.500">
                    {email.message_count} message
                    {email.message_count !== 1 ? "s" : ""}
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {formatDate(email.last_updated)}
                  </Text>
                </Flex>
              </Box>
            );
          })}
        </VStack>
      );
    }

    // Default rendering for other categories
    return (
      <VStack spacing={3} align="stretch">
        {emails.map((email) => (
          <Box
            key={email.thread_id}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            _hover={{ bg: "gray.50" }}
            cursor="pointer"
            onClick={() => handleSelectLabeledEmail(email, category)}
          >
            <Heading size="sm">{email.subject || "(No Subject)"}</Heading>
            <Text fontSize="sm" color="gray.600" noOfLines={1} mt={1}>
              {email.latest_message?.snippet || "No preview available"}
            </Text>
            <Flex justify="space-between" mt={2}>
              <Text fontSize="xs" color="gray.500">
                {email.message_count} messages
              </Text>
              <Text fontSize="xs" color="gray.500">
                {formatDate(email.last_updated)}
              </Text>
            </Flex>
          </Box>
        ))}
      </VStack>
    );
  };

  const renderExtractedFields = (fields: any, category: string) => {
    if (!fields) return null;

    let fieldEntries = Object.entries(fields);

    return (
      <Box p={4} bg="blue.50" borderRadius="md" mb={4}>
        <Heading size="sm" mb={3}>
          Extracted Information
        </Heading>
        <VStack align="stretch" spacing={2}>
          {fieldEntries.map(([key, value]) => (
            <Flex key={key}>
              <Text fontWeight="bold" minWidth="150px">
                {key
                  .split("_")
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ")}
                :
              </Text>
              <Text>{(value as string) || "N/A"}</Text>
            </Flex>
          ))}
        </VStack>
      </Box>
    );
  };

  const renderMatchCard = (match: any, isJob: boolean) => {
    return (
      <Box
        key={match.thread_id}
        p={3}
        borderWidth="1px"
        borderRadius="md"
        borderLeftWidth="4px"
        borderLeftColor={isJob ? "blue.500" : "red.500"}
        bg="white"
        _hover={{ bg: isJob ? "blue.50" : "red.50" }}
        cursor="pointer"
      >
        <Flex justify="space-between" align="center">
          <Heading size="xs" color={isJob ? "blue.600" : "red.600"}>
            {isJob
              ? match.subject?.replace(/^Re:\s*/i, "")
              : match.subject?.replace(/^Re:\s*/i, "")}
          </Heading>
          <Badge
            colorScheme={
              match.match_percentage > 85
                ? "green"
                : match.match_percentage > 70
                ? "yellow"
                : "orange"
            }
            px={2}
            py={1}
            borderRadius="md"
          >
            {match.match_percentage}% Match
          </Badge>
        </Flex>

        <Flex mt={2} wrap="wrap" gap={1}>
          {isJob ? (
            <>
              {match.company_name && (
                <Badge colorScheme="blue" variant="outline" fontSize="xs">
                  {match.company_name}
                </Badge>
              )}
              {match.location && (
                <Badge colorScheme="purple" variant="outline" fontSize="xs">
                  {match.location}
                </Badge>
              )}
            </>
          ) : (
            <>
              {match.key_skills && (
                <Badge colorScheme="teal" variant="outline" fontSize="xs">
                  {match.key_skills}
                </Badge>
              )}
              {match.experience_years && (
                <Badge colorScheme="blue" variant="outline" fontSize="xs">
                  {match.experience_years}
                </Badge>
              )}
            </>
          )}
        </Flex>

        {match.shared_date && (
          <Text fontSize="xs" color="gray.500" mt={1}>
            Shared {match.shared_date}
          </Text>
        )}
      </Box>
    );
  };

  const renderTopMatches = () => {
    if (isLoadingMatches) {
      return (
        <Box textAlign="center" p={4}>
          <Spinner size="sm" />
          <Text mt={2} fontSize="sm">
            Loading matches...
          </Text>
        </Box>
      );
    }

    if (!topMatches || topMatches.length === 0) {
      return null;
    }

    const isJobPosting = selectedLabeledEmail?.category === "Job Posting";

    return (
      <Box
        mt={5}
        p={4}
        bg={isJobPosting ? "red.50" : "blue.50"}
        borderRadius="md"
      >
        <Heading size="sm" mb={3}>
          Top Matching {isJobPosting ? "Candidates" : "Jobs"}
        </Heading>
        <VStack spacing={3} align="stretch">
          {topMatches.map((match) => renderMatchCard(match, !isJobPosting))}
        </VStack>
      </Box>
    );
  };

  const renderSharedCandidates = () => {
    if (!sharedCandidates || sharedCandidates.length === 0) {
      return null;
    }

    return (
      <Box mt={5} p={4} bg="yellow.50" borderRadius="md">
        <Heading size="sm" mb={3}>
          Candidates Shared in Reply
          <Tooltip label="These candidates were suggested in the automatic email reply">
            <InfoIcon ml={2} boxSize={4} />
          </Tooltip>
        </Heading>
        <VStack spacing={3} align="stretch">
          {sharedCandidates.map((candidate) =>
            renderMatchCard(candidate, false)
          )}
        </VStack>
      </Box>
    );
  };

  const renderLabeledEmailView = () => {
    if (!selectedLabeledEmail) {
      return (
        <Box p={4} textAlign="center">
          <Text>Select an email to view details</Text>
        </Box>
      );
    }

    // Show loading indicator while email content is being fetched
    if (isEmailContentLoading) {
      return (
        <Box p={10} textAlign="center">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" speed="0.65s" />
            <Text>Loading email content...</Text>
          </VStack>
        </Box>
      );
    }

    // Function to handle back button click
    const handleBackClick = () => {
      // Use browser's history back if available
      if (window.history.state && window.history.state.view === "email") {
        window.history.back();
      } else {
        // Fallback to manual state clearing
        window.history.pushState({ view: "inbox" }, "", "?");
        setSelectedLabeledEmail(null);
        setExtractedFields(null);
        setTopMatches([]);
        setSharedCandidates([]);
      }
    };

    return (
      <Box>
        <Button leftIcon={<ArrowBackIcon />} onClick={handleBackClick} mb={4}>
          Back to List
        </Button>

        {selectedLabeledEmail.category === "Job Posting" && extractedFields ? (
          <Box
            p={5}
            shadow="md"
            borderWidth="1px"
            borderRadius="md"
            mb={4}
            borderLeftWidth="4px"
            borderLeftColor="blue.500"
          >
            <Heading size="md">{selectedLabeledEmail.subject}</Heading>

            <Flex mt={4} gap={2} flexWrap="wrap">
              <Badge colorScheme="blue" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.category}
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.message_count} messages
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.participants?.length} participants
              </Badge>
            </Flex>

            <Box mt={5} p={4} bg="blue.50" borderRadius="md">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <Heading size="sm" mb={2}>
                    Company Details
                  </Heading>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Company:
                    </Text>
                    <Text fontSize="lg" fontWeight="medium">
                      {extractedFields.company_name || "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Position:
                    </Text>
                    <Text fontSize="lg">
                      {extractedFields.position || "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Location:
                    </Text>
                    <Text>{extractedFields.location || "Not specified"}</Text>
                  </Flex>

                  {extractedFields.salary_range && (
                    <Flex align="baseline" mt={2}>
                      <Text fontWeight="bold" minWidth="120px">
                        Salary Range:
                      </Text>
                      <Text>{extractedFields.salary_range}</Text>
                    </Flex>
                  )}
                </Box>

                <Box>
                  <Heading size="sm" mb={2}>
                    Job Details
                  </Heading>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Requirements:
                    </Text>
                    <Text noOfLines={3}>
                      {extractedFields.requirements || "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Deadline:
                    </Text>
                    <Text>
                      {extractedFields.application_deadline || "Not specified"}
                    </Text>
                  </Flex>
                </Box>
              </SimpleGrid>

              {extractedFields.requirements && (
                <Box mt={4}>
                  <Heading size="sm" mb={2}>
                    Job Requirements
                  </Heading>
                  <Text whiteSpace="pre-wrap">
                    {extractedFields.requirements}
                  </Text>
                </Box>
              )}

              <Button mt={4} colorScheme="blue" size="sm">
                Apply Now
              </Button>
            </Box>

            {/* Render top candidates matches */}
            {renderTopMatches()}

            {/* Render candidates shared in reply */}
            {renderSharedCandidates()}
          </Box>
        ) : selectedLabeledEmail.category === "Candidate" && extractedFields ? (
          <Box
            p={5}
            shadow="md"
            borderWidth="1px"
            borderRadius="md"
            mb={4}
            borderLeftWidth="4px"
            borderLeftColor="red.500"
          >
            <Heading size="md" color="red.600">
              {selectedLabeledEmail.subject?.replace(/^Re:\s*/i, "")}
            </Heading>

            <Flex mt={4} gap={2} flexWrap="wrap">
              <Badge colorScheme="red" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.category}
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.message_count} messages
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.participants?.length} participants
              </Badge>
            </Flex>

            <Box mt={5} p={4} bg="red.50" borderRadius="md">
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Box>
                  <Heading size="sm" mb={2}>
                    Candidate Details
                  </Heading>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Name:
                    </Text>
                    <Text fontSize="lg" fontWeight="medium">
                      {extractedFields.candidate_name ||
                        selectedLabeledEmail.subject
                          ?.replace(/^Re:\s*/i, "")
                          .split(" ")
                          .slice(0, 2)
                          .join(" ") ||
                        "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Position:
                    </Text>
                    <Text fontSize="lg">
                      {extractedFields.position_applied ||
                        (selectedLabeledEmail.subject
                          ?.toLowerCase()
                          .includes("software engineer")
                          ? "Software Engineer"
                          : selectedLabeledEmail.subject
                              ?.toLowerCase()
                              .includes("position")
                          ? "Position"
                          : "Not specified")}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Location:
                    </Text>
                    <Text fontSize="lg">
                      {extractedFields.location || "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Experience:
                    </Text>
                    <Text>
                      {extractedFields.experience_years || "Not specified"}
                    </Text>
                  </Flex>
                </Box>

                <Box>
                  <Heading size="sm" mb={2}>
                    Qualifications
                  </Heading>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Education:
                    </Text>
                    <Text>{extractedFields.education || "Not specified"}</Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Key Skills:
                    </Text>
                    <Text noOfLines={3}>
                      {extractedFields.key_skills || "Not specified"}
                    </Text>
                  </Flex>
                  <Flex align="baseline" mt={2}>
                    <Text fontWeight="bold" minWidth="120px">
                      Availability:
                    </Text>
                    <Text>
                      {extractedFields.availability || "Not specified"}
                    </Text>
                  </Flex>
                </Box>
              </SimpleGrid>

              {extractedFields.key_skills && (
                <Box mt={4}>
                  <Heading size="sm" mb={2}>
                    Candidate Skills
                  </Heading>
                  <Text whiteSpace="pre-wrap">
                    {extractedFields.key_skills}
                  </Text>
                </Box>
              )}

              <Button mt={4} colorScheme="red" size="sm">
                Contact Candidate
              </Button>
            </Box>

            {/* Render top job matches */}
            {renderTopMatches()}
          </Box>
        ) : (selectedLabeledEmail.category === "Job Posting" ||
            selectedLabeledEmail.category === "Candidate") &&
          !extractedFields ? (
          // Show email with loading indicator for details that are loading in background
          <Box
            p={5}
            shadow="md"
            borderWidth="1px"
            borderRadius="md"
            mb={4}
            borderLeftWidth="4px"
            borderLeftColor={
              selectedLabeledEmail.category === "Job Posting"
                ? "blue.500"
                : "red.500"
            }
          >
            <Heading
              size="md"
              color={
                selectedLabeledEmail.category === "Job Posting"
                  ? "blue.600"
                  : "red.600"
              }
            >
              {selectedLabeledEmail.subject?.replace(/^Re:\s*/i, "")}
            </Heading>

            <Flex mt={4} gap={2} flexWrap="wrap">
              <Badge
                colorScheme={
                  selectedLabeledEmail.category === "Job Posting"
                    ? "blue"
                    : "red"
                }
                fontSize="0.9em"
                p={1}
              >
                {selectedLabeledEmail.category}
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.message_count} messages
              </Badge>
              <Badge colorScheme="gray" fontSize="0.9em" p={1}>
                {selectedLabeledEmail.participants?.length} participants
              </Badge>
            </Flex>

            <Box
              mt={5}
              p={4}
              bg={
                selectedLabeledEmail.category === "Job Posting"
                  ? "blue.50"
                  : "red.50"
              }
              borderRadius="md"
            >
              {isLoadingMatches || isEmailContentLoading ? (
                <Flex direction="column" align="center" p={4}>
                  <Spinner
                    size="md"
                    color={
                      selectedLabeledEmail.category === "Job Posting"
                        ? "blue.500"
                        : "red.500"
                    }
                    mb={3}
                  />
                  <Text>
                    Loading{" "}
                    {selectedLabeledEmail.category === "Job Posting"
                      ? "job"
                      : "candidate"}{" "}
                    details...
                  </Text>
                </Flex>
              ) : (
                <>
                  <Text fontSize="md" mb={4}>
                    Click below to load detailed information about this{" "}
                    {selectedLabeledEmail.category === "Job Posting"
                      ? "job posting"
                      : "candidate"}
                    .
                  </Text>
                  <Button
                    colorScheme={
                      selectedLabeledEmail.category === "Job Posting"
                        ? "blue"
                        : "red"
                    }
                    onClick={loadEmailDetails}
                    leftIcon={<InfoIcon />}
                  >
                    Load Details
                  </Button>
                </>
              )}
            </Box>
          </Box>
        ) : (
          <Box p={5} shadow="md" borderWidth="1px" borderRadius="md" mb={4}>
            <Heading size="md">{selectedLabeledEmail.subject}</Heading>
            <Text fontSize="sm" color="gray.600">
              {selectedLabeledEmail.message_count} messages •
              {selectedLabeledEmail.participants?.length} participants
            </Text>
            <Badge
              mt={2}
              colorScheme={
                selectedLabeledEmail.category === "Job Posting"
                  ? "blue"
                  : selectedLabeledEmail.category === "Candidate"
                  ? "red"
                  : "green"
              }
            >
              {selectedLabeledEmail.category}
            </Badge>
          </Box>
        )}

        <Heading size="md" mb={3}>
          Original Email Thread
        </Heading>
        <VStack spacing={4} align="stretch">
          {selectedLabeledEmail.messages?.map((message: any, index: number) => {
            const cleanBody = getCleanHtmlBody(message.body); // Get cleaned body
            return (
              <Box
                key={message.gmail_id}
                p={4}
                borderWidth="1px"
                borderRadius="md"
                bg={message.is_read ? "white" : "blue.50"}
              >
                <Flex justify="space-between" mb={2}>
                  <Text fontWeight="bold">
                    {formatSenderName(message.sender)}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {formatDate(message.date)}
                  </Text>
                </Flex>
                {cleanBody ? ( // Use cleaned body
                  <Box
                    dangerouslySetInnerHTML={{ __html: cleanBody }} // Render cleaned body
                    className="email-body"
                    mt={2}
                    mb={2}
                  />
                ) : (
                  <Text mb={2}>{message.snippet}</Text> // Fallback to snippet
                )}
              </Box>
            );
          })}
        </VStack>
      </Box>
    );
  };

  const renderThreadView = () => {
    if (!selectedThread) {
      return (
        <Box p={4} textAlign="center">
          <Text>Select an email to view details</Text>
        </Box>
      );
    }

    // Show loading indicator while thread is being fetched
    if (isThreadLoading || isEmailContentLoading) {
      return (
        <Box p={10} textAlign="center">
          <VStack spacing={4}>
            <Spinner size="xl" color="blue.500" thickness="4px" speed="0.65s" />
            <Text>Loading email thread...</Text>
          </VStack>
        </Box>
      );
    }

    // Function to handle back button click
    const handleBackClick = () => {
      // Use browser's history back if available
      closeThread();
    };

    return (
      <Box p={4}>
        <Button mb={4} onClick={handleBackClick}>
          Back to Inbox
        </Button>
        <Box p={5} shadow="md" borderWidth="1px" borderRadius="md" mb={4}>
          <Heading size="lg">{selectedThread.subject}</Heading>
          <Text fontSize="sm" color="gray.600">
            {selectedThread.message_count} messages •
            {selectedThread.participants.length} participants
          </Text>
        </Box>

        {/* Add Thread Labels Component */}
        <Box p={4} shadow="md" borderWidth="1px" borderRadius="md" mb={4}>
          <ThreadLabels
            threadId={selectedThread.thread_id}
            onLabelRemoved={() => {
              // Refresh if needed
            }}
          />
        </Box>

        <VStack spacing={4} align="stretch">
          {selectedThread.messages.map((message, index) => {
            const cleanBody = getCleanHtmlBody(message.body); // Get cleaned body
            return (
              <Box
                key={message.gmail_id}
                p={4}
                borderWidth="1px"
                borderRadius="md"
                bg={message.is_read ? "white" : "blue.50"}
              >
                <Flex justify="space-between" mb={2}>
                  <Text fontWeight="bold">
                    {formatSenderName(message.sender)}
                  </Text>
                  <Text fontSize="sm" color="gray.500">
                    {formatDate(message.date)}
                  </Text>
                </Flex>
                {cleanBody ? ( // Use cleaned body
                  <Box
                    dangerouslySetInnerHTML={{ __html: cleanBody }} // Render cleaned body
                    className="email-body"
                    mt={2}
                    mb={2}
                  />
                ) : (
                  <Text mb={2}>{message.snippet}</Text> // Fallback to snippet
                )}
              </Box>
            );
          })}
        </VStack>
      </Box>
    );
  };

  // Add function to check for new emails
  const handleCheckNewEmails = async () => {
    setIsCheckingEmails(true);
    toast({
      title: "Refreshing emails",
      description: "Loading the latest emails from database...",
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    try {
      // Use user preference instead of hardcoded value
      const emailCount = user?.max_emails_to_index || 10;

      // First refresh the main inbox emails
      const response = await refreshEmailsFromDatabase(emailCount);

      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }

      // Sort the refreshed emails by date (newest first)
      const refreshedEmails = [...response.data].sort((a, b) => {
        const dateA = a.date || "";
        const dateB = b.date || "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      // Update the main emails list
      setEmails(refreshedEmails);

      // Now refresh all labeled categories (Job Postings, Candidates, etc.)
      await fetchLabeledEmails();

      // For thoroughness, refresh any other data views in other tabs
      // if (tabIndex === 4) {
        // If Follow-ups tab is active or might be viewed
        // await fetchSimilarEmails(); // Original call - likely typo
        // Corrected call to use the imported function:
        // await getSimilarThreads(); // This function requires threadId and targetLabel, which are not available here. Commenting out for now.
        // If getSimilarThreads requires a thread ID, this logic needs revision.
      // }

      // Update the UI to reflect refreshed data
      setIsLoading(false);

      // Commented out the success toast notification as requested
      /*
      toast({
        title: `Email data refreshed`,
        description:
          "All tabs have been updated with the latest data from the database",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      */
    } catch (error) {
      console.error("Error refreshing emails:", error);
      toast({
        title: "Error refreshing emails",
        description: error.message || "Please try again later",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsCheckingEmails(false);
    }
  };

  // Handler for when onboarding is complete
  const handleOnboardingComplete = () => {
    if (user) {
      setUser({
        ...user,
        is_onboarded: true,
      });
    }
    setShowOnboardingModal(false);

    // Load emails after onboarding is complete
    setIsCheckingEmails(true);

    // First get the latest user data including max_emails_to_index
    getCurrentUser()
      .then((userResponse) => {
        // Update user with the latest data including max_emails_to_index
        setUser(userResponse.data);

        // Use the user's preferred email count
        const emailCount = userResponse.data.max_emails_to_index || 10;

        // Then fetch emails based on the user's preference
        refreshEmailsFromDatabase(emailCount).then((emailsResponse) => {
          if (emailsResponse && emailsResponse.data) {
            // Sort the refreshed emails by date (newest first)
            const refreshedEmails = [...emailsResponse.data].sort((a, b) => {
              const dateA = a.date || "";
              const dateB = b.date || "";
              return new Date(dateB).getTime() - new Date(dateA).getTime();
            });

            // Update the main emails list
            setEmails(refreshedEmails);
            setHasMore(refreshedEmails.length === emailCount);
            setPage(1);
          }
          setIsCheckingEmails(false);
        });

        fetchLabeledEmails();

        // Fetch background status after onboarding too
        getBackgroundServiceStatus()
          .then((statusResponse) => {
            setIsAutoReplyEnabled(statusResponse.data.is_enabled);
            setIsLoadingAutoReplyStatus(false);
          })
          .catch((statusError) => {
            console.error(
              "Error fetching background service status after onboarding:",
              statusError
            );
            setIsLoadingAutoReplyStatus(false);
            // Toast handled in main fetch logic
          });

        toast({
          title: "Onboarding complete!",
          description:
            "Your preferences have been saved. We're now loading your emails.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      })
      .catch((error) => {
        console.error("Error fetching user data after onboarding:", error);
        setIsCheckingEmails(false);
      });
  };

  // Handler for toggling the auto-reply service
  const handleToggleAutoReply = async () => {
    if (isTogglingAutoReply) return; // Prevent concurrent requests

    setIsTogglingAutoReply(true);
    const currentState = isAutoReplyEnabled;

    try {
      console.log(`Toggling background service from ${currentState}...`);
      const response = await toggleBackgroundService();

      if (response.data.success) {
        const newState = response.data.is_enabled;
        setIsAutoReplyEnabled(newState);
        console.log(`Background service toggled successfully to: ${newState}`);
        toast({
          title: `Background Auto-Reply ${newState ? "Enabled" : "Disabled"}`, // Adjusted title
          description: response.data.message,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } else {
        // Revert state on failure
        setIsAutoReplyEnabled(currentState);
        console.error(
          "Failed to toggle background service:",
          response.data.message
        );

        // Check if the failure requires authentication
        if (response.data.needs_auth) {
          // Replace the previous toast call with one using the render prop
          toast({
            position: "top",
            duration: 7000,
            isClosable: true,

            render: ({ onClose }) => (
              <Box
                color="white"
                p={4}
                bg="yellow.500"
                borderRadius="md"
                shadow="md"
              >
                <Flex justify="space-between" align="center">
                  <Box mr={3}>
                    {" "}
                    {/* Added margin for spacing */}
                    <Text fontWeight="bold">Authentication Required</Text>
                    <Text fontSize="sm">
                      {" "}
                      {/* Slightly smaller description */}
                      Please authorize the background service to access your
                      email offline.
                    </Text>
                  </Box>
                  <Button
                    variant="solid"
                    colorScheme="whiteAlpha"
                    size="sm"
                    onClick={() => {
                      initiateBackgroundAuth();
                      onClose(); // Close toast after clicking
                    }}
                  >
                    Authorize Now
                  </Button>
                </Flex>
              </Box>
            ),
          });
        } else {
          // Show generic error if auth is not the issue
          toast({
            title: "Error Toggling Service",
            description:
              response.data.message || "Could not update the service status.",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      }
    } catch (error: any) {
      // Revert state on failure
      setIsAutoReplyEnabled(currentState);
      console.error("Error during background service toggle API call:", error);
      toast({
        title: "Error Toggling Service",
        description:
          error.response?.data?.message ||
          "An unexpected error occurred. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsTogglingAutoReply(false);
    }
  };

  // Function to initiate background service OAuth flow
  const initiateBackgroundAuth = async () => {
    try {
      const response = await getBackgroundServiceOAuthUrl();
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error("Error getting background service auth URL:", error);
      toast({
        title: "Authorization Error",
        description:
          "Could not initiate authorization for the background service.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  if (isLoading) {
    return (
      <Flex height="100vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <>
      {isLoading ? (
        <Flex justify="center" align="center" height="100vh">
          <Spinner size="xl" />
        </Flex>
      ) : user ? (
        <DashboardLayout
          user={user}
          onSyncEmails={syncEmails}
          isSyncing={isSyncing}
          notificationCount={0}
          onLogout={handleLogout}
          isAutoReplyEnabled={isAutoReplyEnabled}
          isLoadingAutoReplyStatus={isLoadingAutoReplyStatus}
          isTogglingAutoReply={isTogglingAutoReply}
          onToggleAutoReply={handleToggleAutoReply}
          activeTab={tabIndex}
          onTabChange={setTabIndex}
          tabCounts={{
            inbox: emails.length,
            "job postings": jobPostings.length,
            candidates: candidates.length,
            questions: questions.length,
            "discussion topics": discussions.length,
            events: events.length,
            other: otherEmails.length,
            irrelevant: irrelevantEmails.length,
          }}
        >
          <Box>
            {tabIndex === 0 && (
              <Box>
                {selectedThread ? (
                  renderThreadView()
                ) : (
                  <Box
                    shadow="md"
                    borderWidth="1px"
                    borderRadius="md"
                    overflow="hidden"
                    width="100%"
                    mx={0}
                    px={0}
                  >
                    <Table variant="simple" width="100%" size="md">
                      <Thead bg="gray.50">
                        <Tr>
                          <Th width="25%">From</Th>
                          <Th width="45%">Subject (Thread)</Th>
                          <Th width="15%">Date</Th>
                          <Th width="15%">Labels</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {emails.length === 0 ? (
                          <Tr>
                            <Td colSpan={4} textAlign="center" py={4}>
                              {isLoading ? (
                                <Spinner size="sm" />
                              ) : (
                                "No emails found"
                              )}
                            </Td>
                          </Tr>
                        ) : (
                          emails
                            .filter(
                              (email) => !/^(Re:\s*)/i.test(email.subject || "")
                            ) // Filter out replies
                            .map((email) => (
                              <Tr
                                key={email.gmail_id}
                                onClick={() => fetchThread(email.thread_id)}
                                cursor="pointer"
                                _hover={{ bg: "gray.50" }}
                                bg={email.is_read ? "white" : "blue.50"}
                                title="Click to view complete thread"
                              >
                                <Td
                                  fontWeight={email.is_read ? "normal" : "bold"}
                                >
                                  {formatSenderName(email.sender)}
                                </Td>
                                <Td
                                  fontWeight={email.is_read ? "normal" : "bold"}
                                >
                                  <Flex align="center">
                                    {/* Remove Re: prefix from subject */}
                                    <Text>
                                      {(
                                        email.subject || "(No Subject)"
                                      ).replace(/^(Re:\s*)/i, "")}{" "}
                                    </Text>
                                    <Badge
                                      ml={2}
                                      colorScheme="blue"
                                      variant="outline"
                                      fontSize="xs"
                                    >
                                      Thread
                                    </Badge>
                                  </Flex>
                                </Td>
                                <Td>{formatDate(email.date)}</Td>
                                <Td>
                                  <Flex gap={1} wrap="wrap">
                                    {threadIdToCategoryMap.has(
                                      email.thread_id
                                    ) &&
                                      (() => {
                                        const label = threadIdToCategoryMap.get(
                                          email.thread_id
                                        )!;
                                        return (
                                          <Badge
                                            key={`${email.thread_id}-category`}
                                            colorScheme={
                                              label === "Job Posting"
                                                ? "blue"
                                                : label === "Candidate"
                                                ? "red"
                                                : label === "Questions"
                                                ? "green"
                                                : label === "Discussion Topics"
                                                ? "yellow"
                                                : label === "Event"
                                                ? "cyan"
                                                : label === "Follow-ups"
                                                ? "orange"
                                                : label === "Search"
                                                ? "purple"
                                                : label === "Irrelevant"
                                                ? "gray"
                                                : "gray"
                                            }
                                          >
                                            {label}
                                          </Badge>
                                        );
                                      })()}
                                    {email.has_attachment && (
                                      <Badge colorScheme="teal">
                                        Attachment
                                      </Badge>
                                    )}
                                  </Flex>
                                </Td>
                              </Tr>
                            ))
                        )}
                      </Tbody>
                    </Table>

                    <Box
                      p={2}
                      textAlign="center"
                      color="gray.500"
                      fontSize="sm"
                    >
                      <Text>
                        Only showing original emails from each thread (not
                        replies). Click a thread to view all replies.
                      </Text>
                    </Box>

                    {hasMore && (
                      <Flex justify="center" p={4}>
                        <Button
                          onClick={loadMoreEmails}
                          isLoading={isLoading && page > 1}
                          loadingText="Loading"
                        >
                          Load More
                        </Button>
                      </Flex>
                    )}
                  </Box>
                )}
              </Box>
            )}

            {tabIndex === 1 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Job Posting" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Job Postings</Heading>
                  </Flex>
                  {renderLabeledEmailList(jobPostings, "Job Posting")}
                </Box>
              ))}

            {tabIndex === 2 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Candidate" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Candidates</Heading>
                  </Flex>
                  {renderLabeledEmailList(candidates, "Candidate")}
                </Box>
              ))}

            {tabIndex === 3 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Question" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Questions</Heading>
                  </Flex>
                  {renderLabeledEmailList(questions, "Question")}
                </Box>
              ))}

            {tabIndex === 4 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Discussion" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Discussion Topics</Heading>
                  </Flex>
                  {renderLabeledEmailList(discussions, "Discussion")}
                </Box>
              ))}

            {tabIndex === 5 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Event" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Events</Heading>
                  </Flex>
                  {renderLabeledEmailList(events, "Event")}
                </Box>
              ))}

            {tabIndex === 6 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Resource" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Resources</Heading>
                  </Flex>
                  {renderLabeledEmailList(resources, "Resource")}
                </Box>
              ))}

            {tabIndex === 7 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Other" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Other</Heading>
                  </Flex>
                  {renderLabeledEmailList(otherEmails, "Other")}
                </Box>
              ))}

            {tabIndex === 8 &&
              (selectedLabeledEmail &&
              selectedLabeledEmail.category === "Irrelevant" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">
                      Irrelevant (Promotional/Security)
                    </Heading>
                  </Flex>
                  {renderLabeledEmailList(irrelevantEmails, "Irrelevant")}
                </Box>
              ))}

            {tabIndex === 9 && <PromptManagement />}

            {/* Remove the redundant thread rendering since each tab now handles its own threads */}
          </Box>
        </DashboardLayout>
      ) : (
        <Flex justify="center" align="center" height="100vh">
          <Box textAlign="center">
            <Text>Session expired. Please log in again.</Text>
            <Button colorScheme="blue" mt={4} onClick={() => router.push("/")}>
              Go to Login
            </Button>
          </Box>
        </Flex>
      )}

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => {
          setShowOnboardingModal(false);
          // Refresh user data in case preferences were updated
          getCurrentUser().then((res) => setUser(res.data));
        }}
        onOnboardingComplete={handleOnboardingComplete}
        // userId={user?.id} // Removed this prop as it's not defined in OnboardingModalProps
      />

      {/* Indexing Progress Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Indexing Email Threads</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Flex direction="column" align="center" justify="center" py={6}>
              <Spinner size="xl" mb={4} />
              <Text textAlign="center">
                Your email threads are being indexed for semantic search. This
                process runs in the background and may take several minutes.
              </Text>
              <Text textAlign="center" mt={4} fontWeight="bold">
                You can close this dialog and continue using the app.
              </Text>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Add a small CSS rule for email body styling */}
      <style jsx global>{`
        .email-body {
          overflow-wrap: break-word;
          word-wrap: break-word;
          max-width: 100%;
          overflow-x: hidden;
        }
        .email-body img {
          max-width: 100%;
          height: auto;
        }
        .email-body a {
          color: #3182ce;
          text-decoration: underline;
        }
        .email-body blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 10px;
          margin-left: 10px;
          color: #718096;
        }
        .email-body pre {
          white-space: pre-wrap;
          background-color: #f7fafc;
          padding: 8px;
          border-radius: 4px;
        }
      `}</style>

      {/* Floating action button for always-accessible email checking */}
      <Box position="fixed" bottom="80px" right="30px" zIndex={10000}>
        <Tooltip label="Refresh emails from database">
          <IconButton
            aria-label="Refresh emails"
            icon={<FiMail />}
            colorScheme="green"
            size="xl"
            isRound
            boxShadow="dark-lg"
            isLoading={isCheckingEmails}
            onClick={handleCheckNewEmails}
            _hover={{ transform: "scale(1.15)" }}
            transition="all 0.2s"
            width="60px"
            height="60px"
          />
        </Tooltip>
      </Box>
    </>
  );
}
