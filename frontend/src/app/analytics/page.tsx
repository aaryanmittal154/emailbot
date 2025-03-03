"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
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
  Card,
  CardBody,
  CardHeader,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Stack,
  HStack,
  Progress,
  Select,
  Tag,
  TagLabel,
} from "@chakra-ui/react";
import { ArrowBackIcon, SearchIcon } from "@chakra-ui/icons";
import {
  getEmailSummary,
  getWeeklyDigest,
  getPopularTopics,
  getEmailSentiment,
  getEmailTimePatterns,
  naturalLanguageSearch,
  getSearchSuggestions,
} from "../../lib/api";

// Helper function to debounce input
const useDebounce = (value: string, delay: number): string => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

interface UserData {
  id: number;
  email: string;
  full_name: string;
  picture: string;
}

// Add these type definitions before the component
interface TimePattern {
  days: Record<string, number>;
  peak_times: Array<{
    hour: string;
    count: number;
  }>;
  response_times: {
    average: string;
    fastest: string;
    slowest: string;
  };
}

// Add these type definitions
interface PopularTopic {
  topic: string;
  count: number;
  threads: string[];
}

interface SentimentData {
  overall: string;
  breakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  trends: Array<{
    date: string;
    sentiment: string;
    value: number;
  }>;
}

interface SearchResult {
  thread_id: string;
  subject: string;
  snippet: string;
  date: string;
  score: number;
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search functionality
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Analytics data
  const [emailSummary, setEmailSummary] = useState<any>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<any>(null);
  const [popularTopics, setPopularTopics] = useState<PopularTopic[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(
    null
  );
  const [timePatterns, setTimePatterns] = useState<TimePattern | null>(null);
  const [timeframe, setTimeframe] = useState<string>("week");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      console.log("No token found in localStorage, redirecting to login");
      router.push("/");
      return;
    }

    // Set up axios defaults
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    axios.defaults.baseURL = "http://emailbot-k8s7.onrender.com";

    fetchUserData();
  }, [router]);

  // Fetch search suggestions when query changes
  useEffect(() => {
    if (debouncedSearchQuery && debouncedSearchQuery.length > 2) {
      fetchSearchSuggestions();
    } else {
      setSearchSuggestions([]);
    }
  }, [debouncedSearchQuery]);

  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get("/api/auth/me");
      setUser(response.data);
      await fetchAnalytics();
    } catch (error) {
      console.error("Error fetching user data:", error);
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

  const fetchAnalytics = async () => {
    try {
      // For demonstration purposes, we'll use mock data
      // In a real implementation, we would call the API endpoints

      // Mock email summary data
      setEmailSummary({
        total_emails: 2543,
        unread_emails: 127,
        weekly_change: 12.5,
        top_senders: [
          { email: "john@example.com", count: 45 },
          { email: "updates@linkedin.com", count: 32 },
          { email: "team@slack.com", count: 28 },
        ],
        email_categories: {
          Work: 45,
          Personal: 25,
          Promotions: 20,
          Updates: 10,
        },
      });

      // Mock weekly digest
      setWeeklyDigest({
        emails_received: 120,
        emails_sent: 45,
        avg_response_time: "2.5 hours",
        busiest_day: "Monday",
        key_contacts: [
          "sarah@company.com",
          "marketing@updates.com",
          "dev-team@work.com",
        ],
        week_over_week_change: 8.3,
      });

      // Mock popular topics
      setPopularTopics([
        { topic: "Project Update", count: 23, threads: ["t1", "t2"] },
        { topic: "Meeting Request", count: 18, threads: ["t2"] },
        { topic: "Support Ticket", count: 15, threads: ["t3"] },
        { topic: "Newsletter", count: 12, threads: [] },
        { topic: "Product Launch", count: 10, threads: [] },
      ]);

      // Mock sentiment data
      setSentimentData({
        overall: "positive",
        breakdown: {
          positive: 65,
          neutral: 25,
          negative: 10,
        },
        trends: [
          { date: "2023-06-10", sentiment: "positive", value: 70 },
          { date: "2023-06-11", sentiment: "neutral", value: 50 },
          { date: "2023-06-12", sentiment: "negative", value: 30 },
        ],
      });

      // Mock time patterns
      setTimePatterns({
        peak_times: [
          { hour: "9:00", count: 42 },
          { hour: "14:00", count: 35 },
          { hour: "17:00", count: 28 },
        ],
        response_times: {
          average: "28 minutes",
          fastest: "15 minutes",
          slowest: "45 minutes",
        },
        days: {
          Monday: 45,
          Tuesday: 52,
          Wednesday: 38,
          Thursday: 65,
          Friday: 48,
          Saturday: 22,
          Sunday: 15,
        },
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const fetchSearchSuggestions = async () => {
    try {
      // In a real implementation, we would call the actual API
      // const response = await getSearchSuggestions(debouncedSearchQuery);
      // setSearchSuggestions(response.suggestions);

      // Mock data for demonstration
      setSearchSuggestions([
        `emails about "${debouncedSearchQuery}"`,
        `"${debouncedSearchQuery}" from last week`,
        `important emails containing "${debouncedSearchQuery}"`,
      ]);
    } catch (error) {
      console.error("Error fetching search suggestions:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      // In a real implementation, we would call the actual API
      // const results = await naturalLanguageSearch(searchQuery);

      // Mock data for demonstration
      setSearchResults([
        {
          thread_id: "t1",
          subject: "Project Update - Q3 Goals",
          snippet: `... regarding ${searchQuery} ... we should discuss this at the next meeting.`,
          date: "2023-06-15T10:30:00Z",
          score: 0.8,
        },
        {
          thread_id: "t2",
          subject: `Discussion about ${searchQuery}`,
          snippet: "I think we should proceed with the plan as discussed...",
          date: "2023-06-14T16:45:00Z",
          score: 0.7,
        },
        {
          thread_id: "t3",
          subject: "Weekly Team Sync",
          snippet: `The ${searchQuery} initiative was mentioned in our last call...`,
          date: "2023-06-13T09:15:00Z",
          score: 0.6,
        },
      ]);
    } catch (error) {
      console.error("Error performing search:", error);
      toast({
        title: "Search Error",
        description: "Failed to complete your search. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const renderSearchResults = () => {
    if (searchResults.length === 0) return null;

    return (
      <Box mt={4} p={4} borderWidth="1px" borderRadius="lg">
        <Heading size="md" mb={4}>
          Search Results
        </Heading>
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Subject</Th>
              <Th>Snippet</Th>
              <Th>Date</Th>
              <Th>Score</Th>
            </Tr>
          </Thead>
          <Tbody>
            {searchResults.map((result) => (
              <Tr key={result.thread_id}>
                <Td fontWeight="bold">{result.subject}</Td>
                <Td>{result.snippet}</Td>
                <Td>{new Date(result.date).toLocaleDateString()}</Td>
                <Td>{result.score.toFixed(2)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>
    );
  };

  const renderPopularTopics = () => {
    return (
      <Card>
        <CardHeader pb={0}>
          <Heading size="md">Popular Topics</Heading>
        </CardHeader>
        <CardBody>
          <VStack align="stretch" spacing={3}>
            {popularTopics.map((topic, index) => (
              <Box key={index} p={2} borderWidth="1px" borderRadius="md">
                <Flex justify="space-between" align="center">
                  <Text fontWeight="bold">{topic.topic}</Text>
                  <Badge
                    colorScheme={topic.threads.length > 0 ? "green" : "gray"}
                  >
                    {topic.count} emails
                  </Badge>
                </Flex>
              </Box>
            ))}
          </VStack>
        </CardBody>
      </Card>
    );
  };

  const renderSentimentAnalysis = () => {
    return (
      <Card>
        <CardHeader pb={0}>
          <Heading size="md">Email Sentiment</Heading>
        </CardHeader>
        <CardBody>
          <Stat mb={4}>
            <StatLabel>Overall Sentiment</StatLabel>
            <StatNumber>
              {sentimentData?.overall.charAt(0).toUpperCase() +
                sentimentData?.overall.slice(1)}
            </StatNumber>
            <StatHelpText>
              <StatArrow
                type={
                  sentimentData?.trends[sentimentData?.trends.length - 1]
                    .sentiment === "positive"
                    ? "increase"
                    : "decrease"
                }
              />
              {sentimentData?.trends[sentimentData?.trends.length - 1]
                .sentiment === "positive"
                ? "Improving"
                : "Declining"}
            </StatHelpText>
          </Stat>

          <Text mb={2}>Sentiment Trends</Text>
          <Stack spacing={3}>
            {sentimentData?.trends.map((trend, index) => (
              <Box key={index}>
                <Flex justify="space-between" mb={1}>
                  <Text fontSize="sm">{trend.date}</Text>
                  <Text fontSize="sm">
                    {trend.sentiment.charAt(0).toUpperCase() +
                      trend.sentiment.slice(1)}
                  </Text>
                </Flex>
                <Progress
                  value={trend.value}
                  colorScheme={
                    trend.sentiment === "positive"
                      ? "green"
                      : trend.sentiment === "negative"
                      ? "red"
                      : "blue"
                  }
                  size="sm"
                />
              </Box>
            ))}
          </Stack>
        </CardBody>
      </Card>
    );
  };

  const renderTimePatterns = () => {
    return (
      <Card>
        <CardHeader pb={0}>
          <Flex justify="space-between" align="center">
            <Heading size="md">Email Time Patterns</Heading>
          </Flex>
        </CardHeader>
        <CardBody>
          <Box mb={4}>
            <Text fontWeight="bold" mb={2}>
              Busiest Days
            </Text>
            <Flex justify="space-between" flexWrap="wrap">
              {Object.entries(timePatterns?.days || {}).map(
                ([day, count]: [string, number]) => (
                  <Tag
                    key={day}
                    m={1}
                    size="md"
                    variant="subtle"
                    colorScheme="blue"
                  >
                    <TagLabel>
                      {day}: {count}
                    </TagLabel>
                  </Tag>
                )
              )}
            </Flex>
          </Box>

          <Box>
            <Text fontWeight="bold" mb={2}>
              Peak Email Times
            </Text>
            <HStack spacing={4} flexWrap="wrap">
              {timePatterns?.peak_times.map((time) => (
                <Stat
                  key={time.hour}
                  size="sm"
                  p={2}
                  borderWidth="1px"
                  borderRadius="md"
                >
                  <StatLabel>{time.hour}</StatLabel>
                  <StatNumber>{time.count}</StatNumber>
                  <StatHelpText>emails</StatHelpText>
                </Stat>
              ))}
            </HStack>
          </Box>
        </CardBody>
      </Card>
    );
  };

  // Main content
  if (isLoading) {
    return (
      <Container maxW="container.xl" py={10}>
        <Flex direction="column" align="center" justify="center" h="50vh">
          <Spinner size="xl" mb={4} />
          <Text>Loading analytics dashboard...</Text>
        </Flex>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={10}>
      <Box mb={8}>
        <Flex justify="space-between" align="center" mb={6}>
          <VStack align="start" spacing={1}>
            <Heading as="h1" size="xl">
              Email Analytics
            </Heading>
            <Text color="gray.600">
              Insights from your email communications
            </Text>
          </VStack>
          <Button
            leftIcon={<ArrowBackIcon />}
            onClick={() => router.push("/dashboard")}
          >
            Back to Dashboard
          </Button>
        </Flex>

        {/* Search Bar */}
        <Box maxW="700px" mx="auto" mt={8} mb={8}>
          <InputGroup size="lg">
            <Input
              placeholder="Ask a question about your emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            />
            <InputRightElement width="4.5rem">
              <IconButton
                h="1.75rem"
                size="sm"
                aria-label="Search"
                icon={<SearchIcon />}
                onClick={handleSearch}
                isLoading={isSearching}
              />
            </InputRightElement>
          </InputGroup>

          {/* Search suggestions */}
          {searchSuggestions.length > 0 && !searchResults.length && (
            <Box mt={2} p={2} borderWidth="1px" borderRadius="md" bg="gray.50">
              <Text fontSize="sm" fontWeight="bold" mb={1}>
                Suggestions:
              </Text>
              <VStack align="stretch" spacing={1}>
                {searchSuggestions.map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    justifyContent="flex-start"
                    fontSize="sm"
                    py={1}
                    height="auto"
                    onClick={() => {
                      setSearchQuery(suggestion);
                      handleSearch();
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </VStack>
            </Box>
          )}
        </Box>

        {/* Search Results */}
        {renderSearchResults()}

        {/* Analytics Overview */}
        {!searchResults.length && (
          <>
            <Tabs isLazy colorScheme="blue" mt={8}>
              <TabList>
                <Tab>Overview</Tab>
                <Tab>Weekly Digest</Tab>
                <Tab>Sentiment Analysis</Tab>
                <Tab>Time Patterns</Tab>
              </TabList>

              <TabPanels>
                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
                    <Card>
                      <CardHeader pb={0}>
                        <Heading size="md">Email Summary</Heading>
                      </CardHeader>
                      <CardBody>
                        <SimpleGrid columns={2} spacing={4} mb={4}>
                          <Stat>
                            <StatLabel>Total Emails</StatLabel>
                            <StatNumber>
                              {emailSummary?.total_emails.toLocaleString()}
                            </StatNumber>
                            <StatHelpText>
                              <StatArrow type="increase" />
                              {emailSummary?.weekly_change}% from last week
                            </StatHelpText>
                          </Stat>
                          <Stat>
                            <StatLabel>Unread</StatLabel>
                            <StatNumber>
                              {emailSummary?.unread_emails}
                            </StatNumber>
                            <StatHelpText>
                              {(
                                (emailSummary?.unread_emails /
                                  emailSummary?.total_emails) *
                                100
                              ).toFixed(1)}
                              % of total
                            </StatHelpText>
                          </Stat>
                        </SimpleGrid>

                        <Divider my={4} />

                        <Text fontWeight="bold" mb={2}>
                          Top Senders
                        </Text>
                        <VStack align="stretch" spacing={2}>
                          {emailSummary?.top_senders.map((sender, index) => (
                            <Flex key={index} justify="space-between">
                              <Text>{sender.email}</Text>
                              <Badge>{sender.count} emails</Badge>
                            </Flex>
                          ))}
                        </VStack>
                      </CardBody>
                    </Card>

                    {renderPopularTopics()}
                  </SimpleGrid>

                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    {renderSentimentAnalysis()}
                    {renderTimePatterns()}
                  </SimpleGrid>
                </TabPanel>

                <TabPanel>
                  <Card>
                    <CardBody>
                      <Heading size="md" mb={4}>
                        Weekly Email Digest
                      </Heading>
                      <SimpleGrid
                        columns={{ base: 1, md: 3 }}
                        spacing={6}
                        mb={6}
                      >
                        <Stat>
                          <StatLabel>Emails Received</StatLabel>
                          <StatNumber>
                            {weeklyDigest?.emails_received}
                          </StatNumber>
                          <StatHelpText>
                            <StatArrow type="increase" />
                            {weeklyDigest?.week_over_week_change}% from previous
                            week
                          </StatHelpText>
                        </Stat>
                        <Stat>
                          <StatLabel>Emails Sent</StatLabel>
                          <StatNumber>{weeklyDigest?.emails_sent}</StatNumber>
                        </Stat>
                        <Stat>
                          <StatLabel>Avg Response Time</StatLabel>
                          <StatNumber>
                            {weeklyDigest?.avg_response_time}
                          </StatNumber>
                        </Stat>
                      </SimpleGrid>

                      <Divider my={4} />

                      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                        <Box>
                          <Text fontWeight="bold" mb={2}>
                            Busiest Day
                          </Text>
                          <Text fontSize="xl">{weeklyDigest?.busiest_day}</Text>
                        </Box>
                        <Box>
                          <Text fontWeight="bold" mb={2}>
                            Key Contacts This Week
                          </Text>
                          <VStack align="stretch" spacing={1}>
                            {weeklyDigest?.key_contacts.map(
                              (contact, index) => (
                                <Text key={index}>{contact}</Text>
                              )
                            )}
                          </VStack>
                        </Box>
                      </SimpleGrid>
                    </CardBody>
                  </Card>
                </TabPanel>

                <TabPanel>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
                    {renderSentimentAnalysis()}
                    <Card>
                      <CardBody>
                        <Heading size="md" mb={4}>
                          Sentiment by Contact
                        </Heading>
                        <Table variant="simple">
                          <Thead>
                            <Tr>
                              <Th>Contact</Th>
                              <Th>Sentiment</Th>
                              <Th>Emails</Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            <Tr>
                              <Td>john@company.com</Td>
                              <Td>
                                <Badge colorScheme="green">Positive</Badge>
                              </Td>
                              <Td>12</Td>
                            </Tr>
                            <Tr>
                              <Td>support@vendor.com</Td>
                              <Td>
                                <Badge colorScheme="red">Negative</Badge>
                              </Td>
                              <Td>8</Td>
                            </Tr>
                            <Tr>
                              <Td>team@organization.com</Td>
                              <Td>
                                <Badge colorScheme="gray">Neutral</Badge>
                              </Td>
                              <Td>15</Td>
                            </Tr>
                          </Tbody>
                        </Table>
                      </CardBody>
                    </Card>
                  </SimpleGrid>
                </TabPanel>

                <TabPanel>{renderTimePatterns()}</TabPanel>
              </TabPanels>
            </Tabs>
          </>
        )}
      </Box>
    </Container>
  );
}
