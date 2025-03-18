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
  Input,
  InputGroup,
  InputRightElement,
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
} from "@chakra-ui/react";
import { ArrowBackIcon, ChevronDownIcon, InfoIcon } from "@chakra-ui/icons";
import { FiSettings, FiLogOut, FiMail, FiRefreshCw } from "react-icons/fi";
import axios from "axios";
import AutoReplyButton from "../../components/AutoReplyButton";
import VacationResponderSettings from "../../components/VacationResponderSettings";
import {
  LabelSuggestions,
  ThreadLabels,
  LabelManager,
} from "../../components/EmailLabels";
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
} from "../../lib/api";

const BASE_URL = "https://emailbot-k8s7.onrender.com";

interface UserData {
  id: number;
  email: string;
  full_name: string;
  picture: string;
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
  const [otherEmails, setOtherEmails] = useState<any[]>([]);
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
        console.log("Fetching user data from /api/auth/me");
        const response = await axios.get("/api/auth/me");
        console.log("User data fetched successfully:", response.data);
        setUser(response.data);

        // Fetch emails (up to 50)
        await fetchEmails();
      } catch (error) {
        console.error("Error fetching user data:", error);
        console.log(
          "Axios error details:",
          error.response
            ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data,
              }
            : "No response details"
        );

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
      }
    };

    fetchUserData();
  }, [router, toast]);

  useEffect(() => {
    if (user) {
      // Fetch labeled emails for each category
      fetchLabeledEmails();
    }
  }, [user]);

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

      const response = await axios.get("/api/emails", {
        params: {
          page,
          max_results: 10,
          priority_categories: ["Job Posting", "Candidate"],
          t: timestamp, // Cache-busting parameter
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

      setHasMore(response.data.length === 10);
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

      await axios.post("/api/emails/sync", { max_results: 500 });

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

      // Check if this thread has a specific category label
      const threadLabels = threadData.labels || [];
      const categoryLabels = [
        "Job Posting",
        "Candidate",
        "Question",
        "Follow-up",
      ];
      const matchedCategory = threadLabels.find((label) =>
        categoryLabels.includes(label)
      );

      if (matchedCategory) {
        console.log(
          `Thread has category: ${matchedCategory}, opening in specialized view`
        );
        // If this email belongs to a category, use the specialized view by calling handleSelectLabeledEmail
        await handleSelectLabeledEmail(threadData, matchedCategory);
        // Don't clear selectedThread completely - just set isThreadLoading to false
        setIsThreadLoading(false);
      } else {
        // If no category, just show the regular thread view
        setSelectedThread(threadData);
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
    } finally {
      setIsThreadLoading(false);
      setIsEmailContentLoading(false);
    }
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
    setSelectedThread(null);
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
        discussionsRes,
        otherRes,
      ] = await Promise.all([
        getEmailsByLabel("Job Posting", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Candidate", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Event", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Questions", { refresh_db: true, t: cacheBuster }),
        getEmailsByLabel("Discussion Topics", {
          refresh_db: true,
          t: cacheBuster,
        }),
        getEmailsByLabel("Other", { refresh_db: true, t: cacheBuster }),
      ]);

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
      setOtherEmails(sortByDate(otherRes.data || []));

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

      let thread = email;
      let threadResponse;

      // Check if we need to fetch the full thread (if the passed email doesn't have complete data)
      if (!email.messages) {
        // First fetch the full thread
        console.log(`Loading thread ${email.thread_id}`);
        threadResponse = await getThread(email.thread_id);
        thread = threadResponse.data;
      }

      // Then get the classified fields
      console.log(`Classifying thread ${thread.thread_id}`);
      const classificationResponse = await classifyThread(thread.thread_id);
      const classification = classificationResponse.data;

      setSelectedLabeledEmail({
        ...thread,
        category,
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

        // For now, we'll keep the mock shared candidates data
        // In a real implementation, this would be another API call
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
      } catch (error) {
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
        setIsEmailContentLoading(false);
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

    return (
      <Box>
        <Button
          leftIcon={<ArrowBackIcon />}
          onClick={() => {
            setSelectedLabeledEmail(null);
            setExtractedFields(null);
            setTopMatches([]);
            setSharedCandidates([]);
          }}
          mb={4}
        >
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
        ) : selectedLabeledEmail.category === "Candidate" ? (
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
              <Heading size="sm" mb={3}>
                Candidate Information
              </Heading>
              <Text mb={4}>
                This candidate's information is available in the email thread
                below.
              </Text>
              <Button colorScheme="red" size="sm">
                Contact Candidate
              </Button>
            </Box>

            {/* Render top job matches */}
            {renderTopMatches()}
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

        {extractedFields &&
          selectedLabeledEmail.category !== "Job Posting" &&
          selectedLabeledEmail.category !== "Candidate" &&
          renderExtractedFields(extractedFields, selectedLabeledEmail.category)}

        <Heading size="md" mb={3}>
          Original Email Thread
        </Heading>
        <VStack spacing={4} align="stretch">
          {selectedLabeledEmail.messages?.map((message: any, index: number) => (
            <Box
              key={message.gmail_id}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              bg={message.is_read ? "white" : "blue.50"}
            >
              <Flex justify="space-between" mb={2}>
                <Text fontWeight="bold">{message.sender}</Text>
                <Text fontSize="sm" color="gray.500">
                  {formatDate(message.date)}
                </Text>
              </Flex>
              {message.body ? (
                <Box
                  dangerouslySetInnerHTML={{ __html: message.body }}
                  className="email-body"
                  mt={2}
                  mb={2}
                />
              ) : (
                <Text mb={2}>{message.snippet}</Text>
              )}
            </Box>
          ))}
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

    return (
      <Box p={4}>
        <Button mb={4} onClick={closeThread}>
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

        {/* Add Label Manager Component */}
        <Box p={4} shadow="md" borderWidth="1px" borderRadius="md" mb={4}>
          <LabelManager />
        </Box>

        <VStack spacing={4} align="stretch">
          {selectedThread.messages.map((message, index) => (
            <Box
              key={message.gmail_id}
              p={4}
              borderWidth="1px"
              borderRadius="md"
              bg={message.is_read ? "white" : "blue.50"}
            >
              <Flex justify="space-between" mb={2}>
                <Text fontWeight="bold">{message.sender}</Text>
                <Text fontSize="sm" color="gray.500">
                  {formatDate(message.date)}
                </Text>
              </Flex>
              {message.body ? (
                <Box
                  dangerouslySetInnerHTML={{ __html: message.body }}
                  className="email-body"
                  mt={2}
                  mb={2}
                />
              ) : (
                <Text mb={2}>{message.snippet}</Text>
              )}
            </Box>
          ))}
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
      // First refresh the main inbox emails
      const response = await refreshEmailsFromDatabase(20);

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
      if (tabIndex === 4) {
        // If Follow-ups tab is active or might be viewed
        await fetchSimilarEmails();
      }

      // Update the UI to reflect refreshed data
      setIsLoading(false);

      toast({
        title: `Email data refreshed`,
        description:
          "All tabs have been updated with the latest data from the database",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
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

  if (isLoading) {
    return (
      <Flex height="100vh" align="center" justify="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <Flex justify="space-between" align="center" mb={8}>
        <Heading>Superconnector Email</Heading>
        <HStack spacing={3}>
          <Button
            leftIcon={<FiRefreshCw />}
            colorScheme="blue"
            isLoading={isCheckingEmails}
            loadingText="Refreshing..."
            onClick={handleCheckNewEmails}
            mr={2}
          >
            Refresh Emails
          </Button>
          <Button
            leftIcon={<FiSettings />}
            colorScheme="teal"
            variant="outline"
            onClick={() => router.push("/settings/background-service")}
          >
            Settings
          </Button>
          <Button
            leftIcon={<FiLogOut />}
            colorScheme="red"
            variant="outline"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </HStack>
      </Flex>

      {user && (
        <Box mb={8}>
          <Flex align="center" gap={4}>
            {user.picture && (
              <Box
                borderRadius="full"
                overflow="hidden"
                width="50px"
                height="50px"
                backgroundImage={`url(${user.picture})`}
                backgroundSize="cover"
              />
            )}
            <Box>
              <Heading size="md">{user.full_name}</Heading>
              <Text color="gray.600">{user.email}</Text>
            </Box>
          </Flex>
        </Box>
      )}

      <Flex pt={4} height="100vh" direction="column">
        <Tabs
          variant="enclosed"
          colorScheme="blue"
          mb={4}
          index={tabIndex}
          onChange={(index) => setTabIndex(index)}
        >
          <TabList>
            <Tab>Inbox</Tab>
            <Tab>Job Postings</Tab>
            <Tab>Candidates</Tab>
            <Tab>Questions</Tab>
            <Tab>Follow-ups</Tab>
            <Tab>Search</Tab>
            <Tab>Other</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              {/* Add visible refresh button at the top of each tab */}
              <Box textAlign="right" mb={4}>
                <Button
                  leftIcon={<FiRefreshCw />}
                  colorScheme="green"
                  onClick={handleCheckNewEmails}
                  isLoading={isCheckingEmails}
                  loadingText="Refreshing emails..."
                  size="md"
                >
                  Refresh Emails
                </Button>
              </Box>

              {/* Add semantic search input */}
              <Flex mb={4} align="center">
                <InputGroup size="md" maxW="600px" mr={4}>
                  <Input
                    placeholder="Search email threads by concepts, topics, or meaning..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                  />
                  <InputRightElement width="4.5rem">
                    <Button
                      h="1.75rem"
                      size="sm"
                      onClick={handleSemanticSearch}
                      isLoading={isSearching}
                    >
                      Search
                    </Button>
                  </InputRightElement>
                </InputGroup>

                <Button
                  colorScheme="purple"
                  onClick={startIndexingThreads}
                  isLoading={isIndexing}
                  loadingText="Indexing"
                  ml="auto"
                >
                  Index Threads
                </Button>
              </Flex>

              {/* Regular Inbox View */}
              <Flex justify="space-between" align="center" mb={4}>
                <Box
                  p={5}
                  shadow="md"
                  borderWidth="1px"
                  borderRadius="md"
                  flex="1"
                >
                  <Heading fontSize="xl">Emails Overview</Heading>
                  <Text mt={4}>
                    You have {emails.length} recent emails in your inbox.
                  </Text>
                </Box>
                <Flex ml={4}>
                  <Button
                    colorScheme="green"
                    mr={2}
                    onClick={handleCheckNewEmails}
                    isLoading={isCheckingEmails}
                    loadingText="Refreshing"
                    leftIcon={<FiMail />}
                  >
                    Refresh Emails
                  </Button>
                  <Button
                    colorScheme="blue"
                    mr={2}
                    onClick={() => fetchEmails(1, false)}
                    isLoading={isLoading && !isSyncing}
                    loadingText="Refreshing"
                  >
                    Refresh
                  </Button>
                  <Button
                    colorScheme="green"
                    mr={2}
                    onClick={syncEmails}
                    isLoading={isSyncing}
                    loadingText="Syncing"
                  >
                    Sync All
                  </Button>
                  <AutoReplyButton colorScheme="teal" />
                </Flex>
              </Flex>

              <Box
                shadow="md"
                borderWidth="1px"
                borderRadius="md"
                overflow="hidden"
              >
                <Table variant="simple">
                  <Thead bg="gray.50">
                    <Tr>
                      <Th>From</Th>
                      <Th>Subject (Thread)</Th>
                      <Th>Date</Th>
                      <Th>Labels</Th>
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
                      emails.map((email) => (
                        <Tr
                          key={email.gmail_id}
                          onClick={() => fetchThread(email.thread_id)}
                          cursor="pointer"
                          _hover={{ bg: "gray.50" }}
                          bg={email.is_read ? "white" : "blue.50"}
                          title="Click to view complete thread"
                        >
                          <Td fontWeight={email.is_read ? "normal" : "bold"}>
                            {email.sender.split("<")[0].trim()}
                          </Td>
                          <Td fontWeight={email.is_read ? "normal" : "bold"}>
                            <Flex align="center">
                              <Text>{email.subject || "(No Subject)"}</Text>
                              {/* Small indicator that this is a thread */}
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
                              {email.labels &&
                                email.labels.slice(0, 2).map((label, idx) => (
                                  <Badge
                                    key={idx}
                                    colorScheme={
                                      label === "INBOX"
                                        ? "blue"
                                        : label === "IMPORTANT"
                                        ? "red"
                                        : label === "CATEGORY_PERSONAL"
                                        ? "green"
                                        : label === "CATEGORY_SOCIAL"
                                        ? "purple"
                                        : "gray"
                                    }
                                  >
                                    {label.replace("CATEGORY_", "")}
                                  </Badge>
                                ))}
                              {email.has_attachment && (
                                <Badge colorScheme="teal">Attachment</Badge>
                              )}
                            </Flex>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>

                <Box p={2} textAlign="center" color="gray.500" fontSize="sm">
                  <Text>
                    Only showing original emails from each thread (not replies).
                    Click a thread to view all replies.
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
            </TabPanel>

            {/* Job Postings Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Job Posting" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Job Postings</Heading>
                    <Flex>
                      <Button
                        size="sm"
                        colorScheme="green"
                        onClick={handleCheckNewEmails}
                        isLoading={isCheckingEmails}
                        loadingText="Refreshing..."
                        mr={2}
                      >
                        Refresh
                      </Button>
                      <Button
                        size="sm"
                        onClick={fetchLabeledEmails}
                        leftIcon={<ArrowBackIcon />}
                      >
                        Refresh
                      </Button>
                    </Flex>
                  </Flex>
                  {renderLabeledEmailList(jobPostings, "Job Posting")}
                </Box>
              )}
            </TabPanel>

            {/* Candidates Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Candidate" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Candidates</Heading>
                    <Button
                      size="sm"
                      onClick={fetchLabeledEmails}
                      leftIcon={<ArrowBackIcon />}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  {renderLabeledEmailList(candidates, "Candidate")}
                </Box>
              )}
            </TabPanel>

            {/* Questions Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Question" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Questions</Heading>
                    <Button
                      size="sm"
                      onClick={fetchLabeledEmails}
                      leftIcon={<ArrowBackIcon />}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  {renderLabeledEmailList(questions, "Question")}
                </Box>
              )}
            </TabPanel>

            {/* Discussion Topics Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Discussion" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Discussion Topics</Heading>
                    <Button
                      size="sm"
                      onClick={fetchLabeledEmails}
                      leftIcon={<ArrowBackIcon />}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  {renderLabeledEmailList(discussions, "Discussion")}
                </Box>
              )}
            </TabPanel>

            {/* Events Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Event" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Events</Heading>
                    <Button
                      size="sm"
                      onClick={fetchLabeledEmails}
                      leftIcon={<ArrowBackIcon />}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  {renderLabeledEmailList(events, "Event")}
                </Box>
              )}
            </TabPanel>

            {/* Other Tab */}
            <TabPanel>
              {selectedLabeledEmail &&
              selectedLabeledEmail.category === "Other" ? (
                renderLabeledEmailView()
              ) : (
                <Box p={4} bg="white" borderRadius="md" shadow="sm">
                  <Flex justify="space-between" align="center" mb={4}>
                    <Heading size="md">Other</Heading>
                    <Button
                      size="sm"
                      onClick={fetchLabeledEmails}
                      leftIcon={<ArrowBackIcon />}
                    >
                      Refresh
                    </Button>
                  </Flex>
                  {renderLabeledEmailList(otherEmails, "Other")}
                </Box>
              )}
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel>
              <VStack spacing={6} align="stretch">
                {/* Auto-reply Section */}
                <Box p={6} bg="white" borderRadius="lg" shadow="sm">
                  <Heading size="md" mb={4}>
                    Auto-Reply Settings
                  </Heading>
                  <AutoReplyButton />
                </Box>

                {/* Vacation Responder Section */}
                <Box p={6} bg="white" borderRadius="lg" shadow="sm">
                  <Heading size="md" mb={4}>
                    Gmail Vacation Responder
                  </Heading>
                  <VacationResponderSettings />
                </Box>

                {/* Label Management Section */}
                <Box p={6} bg="white" borderRadius="lg" shadow="sm">
                  <LabelManager />
                </Box>
              </VStack>
            </TabPanel>
          </TabPanels>
        </Tabs>

        {/* Content area - only display thread if not already showing in a tab */}
        {selectedThread &&
        !selectedLabeledEmail &&
        !(tabIndex === 1 && selectedThread.labels?.includes("Job Posting")) &&
        !(tabIndex === 2 && selectedThread.labels?.includes("Candidate")) &&
        !(tabIndex === 3 && selectedThread.labels?.includes("Questions")) &&
        !(tabIndex === 4 && selectedThread.labels?.includes("Follow-up"))
          ? renderThreadView()
          : null}
      </Flex>

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
      <Box position="fixed" bottom="80px" right="30px" zIndex={9999}>
        <Tooltip label="Refresh emails from database">
          <IconButton
            aria-label="Refresh emails"
            icon={<FiMail />}
            colorScheme="green"
            size="lg"
            isRound
            boxShadow="lg"
            isLoading={isCheckingEmails}
            onClick={handleCheckNewEmails}
            _hover={{ transform: "scale(1.1)" }}
            transition="all 0.2s"
          />
        </Tooltip>
      </Box>
    </Container>
  );
}
