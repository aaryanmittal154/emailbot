import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  Text,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Select,
  Textarea,
  Button,
  Flex,
  useToast,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Divider,
  Badge,
  useColorModeValue,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import { InfoIcon, RepeatIcon, QuestionIcon } from "@chakra-ui/icons";
import axios from "axios";

// API endpoint base URL
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://emailbot-k8s7.onrender.com";

// API helper functions
const api = {
  get: async (url) => {
    const token = localStorage.getItem("auth_token");
    return axios.get(`${BASE_URL}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  post: async (url, data) => {
    const token = localStorage.getItem("auth_token");
    return axios.post(`${BASE_URL}${url}`, data, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
  del: async (url) => {
    const token = localStorage.getItem("auth_token");
    return axios.delete(`${BASE_URL}${url}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
};

// Define categories for which prompts can be customized
const CATEGORIES = [
  "Job Posting",
  "Candidate",
  "Event",
  "Questions",
  "Discussion Topics",
  "Irrelevant",
  "Other",
  "Follow-ups",
];

// Define prompt types
const PROMPT_TYPES = ["classification", "auto_reply"];

// Default description for each prompt type
const PROMPT_DESCRIPTIONS = {
  classification: "Used to determine the category of an email",
  auto_reply: "Used to generate responses for emails in this category",
};

const PromptManagement: React.FC = () => {
  // State
  const [selectedCategory, setSelectedCategory] =
    useState<string>("Job Posting");
  const [selectedType, setSelectedType] = useState<string>("classification");
  const [promptContent, setPromptContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDefault, setIsDefault] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [promptId, setPromptId] = useState<number | null>(null);

  const toast = useToast();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Fetch the prompt when category or type changes
  useEffect(() => {
    fetchPrompt();
  }, [selectedCategory, selectedType]);

  // Fetch the prompt from the API
  const fetchPrompt = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(
        `/api/prompts/${selectedCategory}/${selectedType}`
      );

      if (response.data) {
        setPromptContent(response.data.content);
        setIsDefault(response.data.is_default);
        setPromptId(response.data.id);
      }
    } catch (err) {
      console.error("Error fetching prompt:", err);
      setError("Failed to load prompt. Please try again.");

      // Set to empty
      setPromptContent("");
      setIsDefault(true);
      setPromptId(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Save the prompt to the API
  const savePrompt = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.post("/api/prompts", {
        category: selectedCategory,
        prompt_type: selectedType,
        content: promptContent,
      });

      if (response.data) {
        toast({
          title: "Prompt saved",
          description: "Your custom prompt has been saved successfully.",
          status: "success",
          duration: 3000,
          isClosable: true,
        });

        setIsDefault(false);
        setPromptId(response.data.id);
      }
    } catch (err) {
      console.error("Error saving prompt:", err);
      setError("Failed to save prompt. Please try again.");
      toast({
        title: "Error",
        description: "Failed to save prompt. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default prompt
  const resetToDefault = async () => {
    if (!promptId) return; // No custom prompt to delete

    setIsLoading(true);

    try {
      await api.del(`/api/prompts/${promptId}`);

      toast({
        title: "Reset to default",
        description: "The prompt has been reset to the default version.",
        status: "info",
        duration: 3000,
        isClosable: true,
      });

      // Fetch the default prompt
      fetchPrompt();
    } catch (err) {
      console.error("Error resetting prompt:", err);
      setError("Failed to reset prompt. Please try again.");
      toast({
        title: "Error",
        description: "Failed to reset prompt. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box p={6} bg={bgColor} borderRadius="lg" shadow="sm" w="100%">
      <Heading size="lg" mb={6}>
        Custom Prompts Manager
      </Heading>

      <Text mb={6}>
        Customize the AI prompts used for email classification and auto-replies.
        The system will use your custom prompts instead of the defaults when
        processing emails.
      </Text>

      <Flex mb={6} wrap="wrap" gap={4}>
        <Box flex="1" minW="200px">
          <Text mb={2} fontWeight="bold">
            Category
          </Text>
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            mb={4}
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </Box>

        <Box flex="1" minW="200px">
          <Text mb={2} fontWeight="bold">
            Prompt Type
          </Text>
          <Select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            mb={4}
          >
            {PROMPT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "classification" ? "Classification" : "Auto-Reply"}
              </option>
            ))}
          </Select>
        </Box>
      </Flex>

      <Flex mb={4} align="center" justify="space-between">
        <Flex align="center">
          <Heading size="md" mr={2}>
            {selectedType === "classification"
              ? "Classification"
              : "Auto-Reply"}{" "}
            Prompt
          </Heading>
          <Tooltip
            label={
              PROMPT_DESCRIPTIONS[
                selectedType as keyof typeof PROMPT_DESCRIPTIONS
              ]
            }
          >
            <InfoIcon color="blue.500" />
          </Tooltip>
        </Flex>

        <Flex align="center">
          {isDefault ? (
            <Badge colorScheme="green" mr={2}>
              Default
            </Badge>
          ) : (
            <Badge colorScheme="purple" mr={2}>
              Custom
            </Badge>
          )}

          {!isDefault && (
            <Tooltip label="Reset to default prompt">
              <IconButton
                aria-label="Reset to default"
                icon={<RepeatIcon />}
                size="sm"
                colorScheme="red"
                variant="outline"
                onClick={resetToDefault}
                isLoading={isLoading}
              />
            </Tooltip>
          )}
        </Flex>
      </Flex>

      {error && (
        <Alert status="error" mb={4} borderRadius="md">
          <AlertIcon />
          <AlertTitle mr={2}>Error!</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <Flex justify="center" align="center" h="300px">
          <Spinner size="xl" color="blue.500" />
        </Flex>
      ) : (
        <>
          <Textarea
            value={promptContent}
            onChange={(e) => setPromptContent(e.target.value)}
            placeholder="Enter your custom prompt..."
            size="lg"
            h="400px"
            mb={4}
            fontFamily="monospace"
          />

          <Flex justify="flex-end">
            <Button
              colorScheme="blue"
              onClick={savePrompt}
              isLoading={isSaving}
              loadingText="Saving"
            >
              Save Custom Prompt
            </Button>
          </Flex>
        </>
      )}

      <Box
        mt={8}
        p={4}
        borderRadius="md"
        bg="gray.50"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <Flex align="center" mb={2}>
          <QuestionIcon mr={2} color="blue.500" />
          <Text fontWeight="bold">Tips for writing effective prompts</Text>
        </Flex>
        <Text fontSize="sm">
          • Be specific about what the AI should focus on in emails
          <br />
          • Include clear instructions on the output format
          <br />
          • Define rules and boundaries for the AI to follow
          <br />
          • For classification prompts, clearly define each category
          <br />• For auto-reply prompts, specify the tone and style you want
        </Text>
      </Box>
    </Box>
  );
};

export default PromptManagement;
