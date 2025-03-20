import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  HStack,
  Button,
  IconButton,
  Badge,
  Input,
  InputGroup,
  InputRightElement,
  useToast,
  useBreakpointValue,
  useColorModeValue,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Skeleton,
  Tooltip,
  Icon,
} from "@chakra-ui/react";
import { SearchIcon, ArrowBackIcon, ChevronRightIcon, RepeatIcon, AddIcon, InfoIcon, WarningIcon, TimeIcon } from "@chakra-ui/icons";
import { FiMail } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import CategoryPanel from "./CategoryPanel";
import EmailThreadViewer from "./EmailThreadViewer";
import NewEmailNotifier from "./NewEmailNotifier";
import { formatTimeSince, getLastEmailCheckTimestamp } from "../../lib/emailUtils";

// Preserve all API functions
import {
  getEmails,
  getThread,
  syncEmails,
  searchEmails,
  indexEmails,
  getEmailsByLabel,
  classifyThread,
  getSimilarThreads,
  getMatchingCandidates,
  getMatchingJobs,
  getNewEmails,
} from "../../lib/api";

// Types
interface EmailData {
  id: string;
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
}

interface ThreadData {
  thread_id: string;
  messages: EmailData[];
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
}

interface DashboardContentProps {
  user: any;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  emails?: any[];
  jobPostings?: any[];
  candidates?: any[];
  isLoading?: boolean;
}

const MotionBox = motion(Box);

const DashboardContent: React.FC<DashboardContentProps> = ({
  user,
  isSyncing,
  setIsSyncing,
  emails: initialEmails = [],
  jobPostings: initialJobPostings = [],
  candidates: initialCandidates = [],
  isLoading: initialLoading = false,
}: DashboardContentProps) => {
  const toast = useToast();

  const [viewType, setViewType] = useState<ViewType>("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailData | null>(null);
  const [activeThread, setActiveThread] = useState<ThreadData | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);

  // Ensure inputs are arrays
  const safeJobPostings = Array.isArray(initialJobPostings) ? initialJobPostings : [];

  // Panel state
  const [emails, setEmails] = useState<any[]>(initialEmails);
  const [jobPostings, setJobPostings] = useState<any[]>(safeJobPostings);
  const [candidates, setCandidates] = useState<any[]>(initialCandidates);
  const [isLoading, setIsLoading] = useState<boolean>(initialLoading);
  const [loadingLabeled, setLoadingLabeled] = useState<boolean>(false);

  // State for emails and threads
  const [selectedThread, setSelectedThread] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Categorized emails
  const [activeCategory, setActiveCategory] = useState("All");
  const [events, setEvents] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [discussionTopics, setDiscussionTopics] = useState<any[]>([]);
  const [other, setOther] = useState<any[]>([]);

  // Category loading states
  const [loadedCategories, setLoadedCategories] = useState<string[]>([]);
  const [selectedLabeledEmail, setSelectedLabeledEmail] = useState<any>(null);

  // UI state
  const columns = useBreakpointValue({ base: 1, md: 2, lg: 3 });

  // Add state to track emails that arrived during the current session
  const [newlyArrivedEmails, setNewlyArrivedEmails] = useState<any[]>([]);

  // Add state for tracking last email check
  const [lastEmailCheck, setLastEmailCheck] = useState<string | null>(
    typeof window !== 'undefined' ? getLastEmailCheckTimestamp() : null
  );

  // Add state for test button loading
  const [isTestingEmailFetch, setIsTestingEmailFetch] = useState(false);

  // State for various email categories
  const [emails, setEmails] = useState<any[]>(initialEmails);
  const [jobPostings, setJobPostings] = useState<any[]>(safeJobPostings);
  const [candidates, setCandidates] = useState<any[]>(initialCandidates);
  const [questions, setQuestions] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [otherEmails, setOtherEmails] = useState<any[]>([]);
  const [irrelevantEmails, setIrrelevantEmails] = useState<any[]>([]);

  // Update state when props change
  useEffect(() => {
    if (initialEmails.length > 0) setEmails(initialEmails);
    if (safeJobPostings.length > 0) setJobPostings(safeJobPostings);
    if (initialCandidates.length > 0) setCandidates(initialCandidates);
    setIsLoading(initialLoading);
  }, [initialEmails, safeJobPostings, initialCandidates, initialLoading]);

  // Update initial categories loaded state
  useEffect(() => {
    const categories = [];
    if (safeJobPostings.length > 0) categories.push("Job Posting");
    if (initialCandidates.length > 0) categories.push("Candidate");
    if (categories.length > 0) {
      setLoadedCategories(categories);
    }
  }, [safeJobPostings, initialCandidates]);

  // ===== FETCH DATA FUNCTIONS =====

  // Fetch all emails - preserved from original
  const fetchEmails = async (page = 1, pageSize = 20) => {
    try {
      setIsThreadLoading(true);
      // Add cache-busting with timestamp
      const timestamp = new Date().getTime();
      // Fix the API call parameters
      const response = await getEmails({
        page,
        max_results: pageSize,
        t: timestamp,
      });

      const newEmails = response.data.emails || [];
      if (page === 1) {
        setEmails(newEmails);
      } else {
        setEmails((prev) => [...prev, ...newEmails]);
      }

      setHasMore(newEmails.length === pageSize);
      setIsThreadLoading(false);
    } catch (error) {
      console.error("Error fetching emails:", error);
      setIsThreadLoading(false);
      toast({
        title: "Error fetching emails",
        description:
          "There was an error fetching your emails. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Fetch thread details
  const fetchThread = async (threadId: string) => {
    try {
      setIsThreadLoading(true);
      const response = await getThread(threadId);

      if (response.data) {
        setSelectedThread(response.data);
      }
      setIsThreadLoading(false);
    } catch (error) {
      console.error("Error fetching thread:", error);
      setIsThreadLoading(false);
      toast({
        title: "Error fetching thread",
        description:
          "There was an error fetching the email thread. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Search emails
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const response = await searchEmails(searchQuery);

      if (response.data) {
        setSearchResults(response.data);
      }
      setIsSearching(false);
    } catch (error) {
      console.error("Error searching emails:", error);
      setIsSearching(false);
      toast({
        title: "Error searching emails",
        description:
          "There was an error searching your emails. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Fetch labeled emails
  const fetchLabeledEmails = async () => {
    if (loadingLabeled) return;

    setLoadingLabeled(true);

    try {
      // Fetch all the different categories in parallel for better performance
      const [jobResults, candidateResults, questionResults, discussionResults, eventsResults, otherResults, irrelevantResults] = await Promise.all([
        getEmailsByLabel("Job Posting"),
        getEmailsByLabel("Candidate"),
        getEmailsByLabel("Questions"),
        getEmailsByLabel("Discussion Topics"),
        getEmailsByLabel("Event"),
        getEmailsByLabel("Other"),
        getEmailsByLabel("Irrelevant")
      ]);

      setJobPostings(jobResults.data || []);
      setCandidates(candidateResults.data || []);
      setQuestions(questionResults.data || []);
      setDiscussions(discussionResults.data || []);
      setEvents(eventsResults.data || []);
      setOtherEmails(otherResults.data || []);
      setIrrelevantEmails(irrelevantResults.data || []);

      // Update the badge counts if needed
      console.log(`Loaded labeled emails: ${jobResults.data.length} jobs, ${candidateResults.data.length} candidates`);
    } catch (error) {
      console.error("Error fetching labeled emails:", error);
      toast({
        title: "Error",
        description: "Failed to load categorized emails. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingLabeled(false);
    }
  };

  // Handle refreshing a single category
  const handleRefreshCategory = async (category: string) => {
    try {
      setLoadingLabeled(true);
      const timestamp = new Date().getTime(); // Cache busting
      // Fix the parameter type
      const response = await getEmailsByLabel(category, { t: timestamp });

      // Update the appropriate category
      switch (category) {
        case "Job Posting":
          setJobPostings(response.data.emails || []);
          break;
        case "Candidate":
          setCandidates(response.data.emails || []);
          break;
        case "Event":
          setEvents(response.data.emails || []);
          break;
        case "Questions":
          setQuestions(response.data.emails || []);
          break;
        case "Discussion Topics":
          setDiscussions(response.data.emails || []);
          break;
        case "Other":
          setOtherEmails(response.data.emails || []);
          break;
        case "Irrelevant":
          setIrrelevantEmails(response.data.emails || []);
          break;
      }

      setLoadingLabeled(false);
      toast({
        title: "Category refreshed",
        description: `${category} category has been refreshed.`,
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error(`Error refreshing ${category} category:`, error);
      setLoadingLabeled(false);
      toast({
        title: "Error refreshing category",
        description: `There was an error refreshing the ${category} category.`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Sync emails - preserved functionality
  const handleSyncEmails = async () => {
    try {
      setIsSyncing(true);
      // Fix the parameter - remove it if not needed
      await syncEmails();

      toast({
        title: "Syncing emails",
        description: "Your emails are being synced in the background.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      // Fetch emails after a short delay to allow sync to start
      setTimeout(() => {
        fetchEmails();
        fetchLabeledEmails();
        setIsSyncing(false);
      }, 2000);
    } catch (error) {
      console.error("Error syncing emails:", error);
      setIsSyncing(false);
      toast({
        title: "Error syncing emails",
        description:
          "There was an error syncing your emails. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Load more emails
  const loadMoreEmails = () => {
    if (hasMore && !isThreadLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchEmails(nextPage);
    }
  };

  // ===== LIFECYCLE HOOKS =====

  // Initial data loading
  useEffect(() => {
    if (user) {
      fetchEmails();
      // Only load high-priority categories initially
      fetchLabeledEmails();
    }
  }, [user]);

  // Add automatic refresh for emails - preserved functionality
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(() => {
      console.log("Auto-refreshing emails...");
      fetchEmails(1);

      // Only refresh loaded categories
      loadedCategories.forEach((category) => {
        handleRefreshCategory(category);
      });
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [user, loadedCategories]);

  // On-demand category loading
  const loadCategoryIfNeeded = (category: string) => {
    if (!loadedCategories.includes(category)) {
      handleRefreshCategory(category);
    }
  };

  // Update last checked timestamp from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkTimestamp = () => {
        const timestamp = getLastEmailCheckTimestamp();
        setLastEmailCheck(timestamp);
      };

      // Check initially
      checkTimestamp();

      // Set up interval to update the displayed time
      const intervalId = setInterval(checkTimestamp, 10000); // Update every 10 seconds

      return () => clearInterval(intervalId);
    }
  }, []);

  // ===== HANDLERS =====

  // Select email thread
  const handleSelectEmail = (email: EmailData) => {
    fetchThread(email.thread_id);
  };

  // Back to list from thread view
  const handleBackFromThread = () => {
    setSelectedThread(null);
  };

  // Refresh thread
  const handleRefreshThread = () => {
    if (selectedThread) {
      fetchThread(selectedThread.thread_id);
    }
  };

  // Handle when new emails are received from the notifier
  const handleNewEmailsReceived = (newEmails: any[]) => {
    setNewlyArrivedEmails(prevEmails => {
      // Combine with any previously received new emails, avoiding duplicates
      const emailIds = new Set(prevEmails.map(e => e.id));
      const uniqueNewEmails = newEmails.filter(e => !emailIds.has(e.id));
      return [...prevEmails, ...uniqueNewEmails];
    });

    // Update the main emails list if we're in the "all" view
    if (viewType === "all") {
      setEmails(prevEmails => {
        // Add the new emails to the beginning of the list
        const emailIds = new Set(prevEmails.map(e => e.id));
        const uniqueNewEmails = newEmails.filter(e => !emailIds.has(e.id));
        return [...uniqueNewEmails, ...prevEmails];
      });
    }

    // Update the appropriate category if we have new emails that belong to any categories
    const jobPostingsEmails = newEmails.filter(email =>
      email.labels && email.labels.includes("Job Posting"));
    const candidateEmails = newEmails.filter(email =>
      email.labels && email.labels.includes("Candidate"));

    if (jobPostingsEmails.length > 0) {
      setJobPostings(prev => [...jobPostingsEmails, ...prev]);
    }

    if (candidateEmails.length > 0) {
      setCandidates(prev => [...candidateEmails, ...prev]);
    }
  };

  // Add a test function for checking new emails manually
  const handleTestEmailFetch = () => {
    setIsTestingEmailFetch(true);
    toast({
      title: "Testing Email Fetch",
      description: "Manually checking for new emails...",
      status: "info",
      duration: 3000,
      isClosable: true,
    });

    // Use our API directly to check for new emails
    getNewEmails()
      .then(response => {
        const { count, emails, timestamp } = response.data;
        // Update last check timestamp
        setLastEmailCheck(timestamp);

        toast({
          title: `Found ${count} new email${count === 1 ? '' : 's'}`,
          description: count > 0
            ? "New emails have been added to your categories"
            : "No new emails found since last check",
          status: count > 0 ? "success" : "info",
          duration: 5000,
          isClosable: true,
        });

        // Update UI with any new emails found
        if (count > 0 && emails && emails.length > 0) {
          handleNewEmailsReceived(emails);
        }
      })
      .catch(error => {
        console.error("Test fetch failed:", error);
        toast({
          title: "Error checking for emails",
          description: "Something went wrong. Please try again.",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      })
      .finally(() => {
        setIsTestingEmailFetch(false);
      });
  };

  // ===== RENDER FUNCTIONS =====

  // Add adapter function to convert EmailData to Email format
  const adaptEmailData = (emailData: any): any => {
    // Check data exists
    if (!emailData) return null;

    let senderObj = { name: "", email: "" };

    // Handle different sender formats
    if (typeof emailData.sender === "object" && emailData.sender !== null) {
      senderObj = emailData.sender;
    } else if (typeof emailData.sender === "string") {
      // Try to parse "Name <email@example.com>" format
      const match = emailData.sender.match(/(.*?)\s*<(.+?)>/);
      if (match) {
        senderObj = {
          name: match[1].trim(),
          email: match[2].trim(),
        };
      } else {
        // Just use the whole string as email
        senderObj = {
          name: emailData.sender.split("@")[0] || "Unknown",
          email: emailData.sender,
        };
      }
    }

    return {
      id:
        emailData.gmail_id ||
        emailData.id ||
        `email-${Math.random().toString(36).substr(2, 9)}`,
      thread_id: emailData.thread_id || emailData.id,
      subject: emailData.subject || "No Subject",
      sender: senderObj,
      preview: emailData.snippet || "",
      recipients: emailData.recipients || [],
      timestamp: emailData.date || new Date().toISOString(),
      isRead: emailData.is_read || false,
      hasAttachment: emailData.has_attachment || false,
      labels: emailData.labels || [],
    };
  };

  // Convert all emails to the required format for CategoryPanel
  const adaptEmails = (emailsData: any[]): any[] => {
    // Check if emailsData is undefined or null
    if (!emailsData || !Array.isArray(emailsData)) {
      console.error("Invalid email data provided to adaptEmails:", emailsData);
      return [];
    }

    // Convert each email to the required format
    const adaptedEmails = emailsData.map(adaptEmailData);

    // Sort emails by date (newest first)
    adaptedEmails.sort((a, b) => {
      // Try to use timestamp first, then date as fallback
      const dateA = a.timestamp || a.date || '';
      const dateB = b.timestamp || b.date || '';

      // Sort in descending order (newest first)
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

    return adaptedEmails;
  };

  // Convert back from UI email format to the format expected by the original functions
  const reverseAdaptEmail = (email: any): any => {
    // If sender is a string already, just return as is
    if (typeof email.sender === "string") {
      return email;
    }

    // Convert the sender object back to a string format
    let senderString = "";
    if (email.sender && typeof email.sender === "object") {
      if (email.sender.name && email.sender.email) {
        senderString = `${email.sender.name} <${email.sender.email}>`;
      } else if (email.sender.email) {
        senderString = email.sender.email;
      }
    }

    return {
      ...email,
      gmail_id: email.gmail_id || email.id,
      sender: senderString || email.sender.email || "unknown@example.com",
      snippet: email.snippet || email.preview || "",
      is_read: email.is_read || email.isRead || false,
      has_attachment: email.has_attachment || email.hasAttachment || false,
      date: email.date || email.timestamp || new Date().toISOString(),
    };
  };

  // Render all emails panel
  const renderAllEmailsPanel = () => (
    <CategoryPanel
      title="All Emails"
      category="All Emails"
      emails={adaptEmails(emails)}
      isLoading={isThreadLoading}
      onRefresh={() => fetchEmails(1)}
      onEmailSelect={(email) => {
        handleSelectEmail(reverseAdaptEmail(email));
      }}
      emptyMessage="No emails found"
    />
  );

  // Render job postings panel
  const renderJobPostingsPanel = () => {
    console.log("Rendering job postings panel with data:", jobPostings);
    return (
    <CategoryPanel
      title="Job Postings"
      category="Job Posting"
      emails={adaptEmails(jobPostings)}
      isLoading={loadingLabeled}
      onRefresh={() => handleRefreshCategory("Job Posting")}
      onEmailSelect={(email) => {
        handleSelectEmail(reverseAdaptEmail(email));
      }}
      emptyMessage="No job postings found"
      badgeCount={jobPostings.length}
    />
  );

  // Render candidates panel
  const renderCandidatesPanel = () => (
    <CategoryPanel
      title="Candidates"
      category="Candidate"
      emails={adaptEmails(candidates)}
      isLoading={loadingLabeled}
      onRefresh={() => handleRefreshCategory("Candidate")}
      onEmailSelect={(email) => {
        handleSelectEmail(reverseAdaptEmail(email));
      }}
      emptyMessage="No candidates found"
      badgeCount={candidates.length}
    />
  );

  // Render a specific category panel
  const renderCategoryPanel = (
    title: string,
    category: string,
    emails: any[],
    onTabClick?: () => void
  ) => (
    <CategoryPanel
      title={title}
      category={category}
      emails={adaptEmails(emails)}
      isLoading={loadingLabeled}
      onRefresh={() => handleRefreshCategory(category)}
      onEmailSelect={(email) => {
        handleSelectEmail(reverseAdaptEmail(email));
      }}
      badgeCount={emails.length}
      animation="fadeIn"
      emptyMessage={`No ${category.toLowerCase()} emails found`}
    />
  );

  // Render the irrelevant emails panel
  const renderIrrelevantPanel = () => (
    <CategoryPanel
      title="Irrelevant"
      category="Irrelevant"
      emails={adaptEmails(irrelevantEmails)}
      isLoading={loadingLabeled}
      onRefresh={() => handleRefreshCategory("Irrelevant")}
      onEmailSelect={(email) => {
        handleSelectEmail(reverseAdaptEmail(email));
      }}
      badgeCount={irrelevantEmails.length}
      animation="fadeIn"
      emptyMessage="No irrelevant emails found (promotional/security)"
    />
  );

  return (
    <Box position="relative">
      {/* Add the NewEmailNotifier at the top */}
      <NewEmailNotifier
        onNewEmailsReceived={handleNewEmailsReceived}
        pollingInterval={30000} // Check for new emails every 30 seconds
      />

      {/* Test Button for New Email Fetch - positioned more prominently */}
      <Flex justifyContent="flex-end" mb={4} alignItems="center">
        {lastEmailCheck && (
          <Flex alignItems="center" mr={4} color="gray.600" fontSize="sm">
            <TimeIcon mr={1} />
            <Text>Last checked: {formatTimeSince(lastEmailCheck)}</Text>
          </Flex>
        )}
        <Button
          leftIcon={<RepeatIcon />}
          colorScheme="blue"
          size="md"
          isLoading={isTestingEmailFetch}
          loadingText="Checking..."
          onClick={handleTestEmailFetch}
        >
          Test New Email Fetch
        </Button>
      </Flex>

      {/* Floating action button for manually triggering email fetch */}
      <Box
        position="fixed"
        bottom="80px"
        right="20px"
        zIndex={10}
      >
        <Tooltip label="Check for new emails now">
          <IconButton
            aria-label="Check for new emails"
            icon={<Icon as={FiMail} />}
            colorScheme="green"
            size="lg"
            isRound
            boxShadow="lg"
            isLoading={isTestingEmailFetch}
            onClick={handleTestEmailFetch}
            _hover={{ transform: 'scale(1.1)' }}
            transition="all 0.2s"
          />
        </Tooltip>
      </Box>

      <AnimatePresence mode="wait">
        {selectedThread ? (
          <MotionBox
            key="thread-viewer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <EmailThreadViewer
              thread={selectedThread}
              onBack={handleBackFromThread}
              onRefresh={handleRefreshThread}
            />
          </MotionBox>
        ) : (
          <MotionBox
            key="email-dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Search Bar */}
            <Box mb={8}>
              <InputGroup size="lg">
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  bg="white"
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="gray.300"
                  _hover={{ borderColor: "brand.300" }}
                  _focus={{
                    borderColor: "brand.500",
                    boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
                  }}
                  fontSize="md"
                  height="56px"
                />
                <InputRightElement width="4.5rem" height="56px">
                  <Button
                    h="2.5rem"
                    size="md"
                    colorScheme="brand"
                    onClick={handleSearch}
                    isLoading={isSearching}
                  >
                    <SearchIcon />
                  </Button>
                </InputRightElement>
              </InputGroup>
            </Box>

            {/* Email Categories */}
            <Tabs
              variant="modern"
              colorScheme="brand"
              onChange={(index) => {
                // On-demand loading based on tab selection
                switch (index) {
                  case 0: // All Emails
                    break;
                  case 1: // Job Postings
                    loadCategoryIfNeeded("Job Posting");
                    break;
                  case 2: // Candidates
                    loadCategoryIfNeeded("Candidate");
                    break;
                  case 3: // Events
                    loadCategoryIfNeeded("Event");
                    break;
                  case 4: // Questions
                    loadCategoryIfNeeded("Questions");
                    break;
                  case 5: // Discussion Topics
                    loadCategoryIfNeeded("Discussion Topics");
                    break;
                  case 6: // Other
                    loadCategoryIfNeeded("Other");
                    break;
                }
              }}
            >
              <TabList overflowX="auto" pb={2} mb={4}>
                <Tab>All Emails</Tab>
                <Tab>
                  Job Postings{" "}
                  {jobPostings.length > 0 && (
                    <Badge ml={2} colorScheme="blue" borderRadius="full">
                      {jobPostings.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>
                  Candidates{" "}
                  {candidates.length > 0 && (
                    <Badge ml={2} colorScheme="green" borderRadius="full">
                      {candidates.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>
                  Events{" "}
                  {events.length > 0 && (
                    <Badge ml={2} colorScheme="purple" borderRadius="full">
                      {events.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>
                  Questions{" "}
                  {questions.length > 0 && (
                    <Badge ml={2} colorScheme="orange" borderRadius="full">
                      {questions.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>
                  Discussion Topics{" "}
                  {discussions.length > 0 && (
                    <Badge ml={2} colorScheme="teal" borderRadius="full">
                      {discussions.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>
                  Other{" "}
                  {otherEmails.length > 0 && (
                    <Badge ml={2} colorScheme="gray" borderRadius="full">
                      {otherEmails.length}
                    </Badge>
                  )}
                </Tab>
                <Tab>Irrelevant {irrelevantEmails.length > 0 && (
                  <Badge ml={2} colorScheme="red" borderRadius="full">{irrelevantEmails.length}</Badge>
                )}</Tab>
              </TabList>

              <TabPanels>
                {/* All Emails Tab */}
                <TabPanel p={0}>
                  {searchResults ? (
                    <Box mb={4}>
                      <Flex justify="space-between" align="center" mb={4}>
                        <Heading size="md">
                          Search Results for "{searchQuery}"
                        </Heading>
                        <Button
                          size="sm"
                          leftIcon={<ArrowBackIcon />}
                          onClick={() => setSearchResults(null)}
                        >
                          Back to Inbox
                        </Button>
                      </Flex>

                      {/* Search results component would go here */}
                      <Box>
                        {searchResults.results &&
                        searchResults.results.length > 0 ? (
                          <CategoryPanel
                            title="Search Results"
                            category="Search Results"
                            emails={adaptEmails(
                              searchResults.results.map((result: any) => ({
                                id: result.thread_id,
                                thread_id: result.thread_id,
                                subject: result.subject,
                                sender: result.sender,
                                snippet: result.snippet,
                                labels: [],
                                has_attachment: false,
                                is_read: true,
                              }))
                            )}
                            isLoading={false}
                            onRefresh={handleSearch}
                            onEmailSelect={(email) => {
                              fetchThread(email.thread_id);
                            }}
                            badgeCount={searchResults.results.length}
                            animation="fadeIn"
                          />
                        ) : (
                          <Box
                            p={6}
                            bg="white"
                            borderRadius="lg"
                            textAlign="center"
                          >
                            <Text>No results found for "{searchQuery}"</Text>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <>
                      {renderAllEmailsPanel()}

                      {/* Load More Button */}
                      {hasMore && (
                        <Flex justify="center" mt={4}>
                          <Button
                            onClick={loadMoreEmails}
                            isLoading={isThreadLoading}
                            loadingText="Loading..."
                            colorScheme="brand"
                            variant="outline"
                          >
                            Load More
                          </Button>
                        </Flex>
                      )}
                    </>
                  )}
                </TabPanel>

                {/* Job Postings Tab */}
                <TabPanel p={0}>{renderJobPostingsPanel()}</TabPanel>

                {/* Candidates Tab */}
                <TabPanel p={0}>{renderCandidatesPanel()}</TabPanel>

                {/* Events Tab */}
                <TabPanel p={0}>
                  {renderCategoryPanel("Events", "Event", events, () =>
                    loadCategoryIfNeeded("Event")
                  )}
                </TabPanel>

                {/* Questions Tab */}
                <TabPanel p={0}>
                  {renderCategoryPanel("Questions", "Questions", questions, () =>
                    loadCategoryIfNeeded("Questions")
                  )}
                </TabPanel>

                {/* Discussion Topics Tab */}
                <TabPanel p={0}>
                  {renderCategoryPanel(
                    "Discussion Topics",
                    "Discussion Topics",
                    discussions,
                    () => loadCategoryIfNeeded("Discussion Topics")
                  )}
                </TabPanel>

                {/* Other Tab */}
                <TabPanel p={0}>
                  {renderCategoryPanel("Other", "Other", otherEmails, () =>
                    loadCategoryIfNeeded("Other")
                  )}
                </TabPanel>

                {/* Irrelevant Tab */}
                <TabPanel p={0}>{renderIrrelevantPanel()}</TabPanel>
              </TabPanels>
            </Tabs>
          </MotionBox>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default DashboardContent;
