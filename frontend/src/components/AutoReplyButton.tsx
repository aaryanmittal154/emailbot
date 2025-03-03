import { useState } from "react";
import {
  Button,
  useToast,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
  VStack,
  Text,
  Badge,
  Switch,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  ButtonGroup,
  Box,
  Flex,
  Spinner,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Tooltip,
} from "@chakra-ui/react";
import {
  triggerAutoReply,
  getAutoReplyConfig,
  updateAutoReplyConfig,
  getAutoReplyStatus,
  getGmailRateLimitStatus,
  resetGmailRateLimits,
} from "@/lib/api.wrapper";

interface AutoReplyButtonProps {
  variant?: string;
  size?: string;
  colorScheme?: string;
}

const AutoReplyButton = ({
  variant = "solid",
  size = "md",
  colorScheme = "blue",
}: AutoReplyButtonProps) => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [config, setConfig] = useState({
    enabled: true,
    max_threads_per_check: 20,
    auto_reply_signature: null,
    use_html: false,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [replyStats, setReplyStats] = useState(null);
  const [rateLimitInfo, setRateLimitInfo] = useState(null);

  // Load config when popover opens
  const handlePopoverOpen = async () => {
    setIsOpen(true);
    setIsConfigLoading(true);

    try {
      // Get current configuration
      const configResponse = await getAutoReplyConfig();
      setConfig(configResponse.data);

      // Get current status
      const statusResponse = await getAutoReplyStatus();
      setStatus(statusResponse.data);

      // Check for active rate limits
      try {
        const rateLimitResponse = await getGmailRateLimitStatus();
        if (rateLimitResponse.data.is_rate_limited) {
          setRateLimitInfo({
            status: "rate_limited",
            retry_after: rateLimitResponse.data.retry_after,
          });
          // We no longer show a toast here, just silently set the rate limit info
        } else {
          // Clear any previous rate limit info
          setRateLimitInfo(null);
        }
      } catch (rateLimitError) {
        console.error("Error checking rate limit status:", rateLimitError);
      }
    } catch (error) {
      console.error("Error fetching auto-reply configuration:", error);
      toast({
        title: "Error",
        description: "Could not load auto-reply configuration.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsConfigLoading(false);
    }
  };

  // Save config changes
  const handleSaveConfig = async () => {
    try {
      const response = await updateAutoReplyConfig(config);
      setConfig(response.data);

      toast({
        title: "Success",
        description: "Auto-reply configuration updated.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error updating auto-reply configuration:", error);
      toast({
        title: "Error",
        description: "Could not update auto-reply configuration.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Trigger auto-reply check
  const handleTriggerAutoReply = async () => {
    setIsLoading(true);
    // Clear previous rate limit info
    setRateLimitInfo(null);

    try {
      const response = await triggerAutoReply(
        config.max_threads_per_check,
        config.use_html
      );
      setReplyStats(response.data);

      // Check for rate limit information in the response
      if (response.data.details && response.data.details.rate_limit) {
        setRateLimitInfo(response.data.details.rate_limit);

        toast({
          title: "Gmail Rate Limit Active",
          description: `Auto-reply partially processed. Gmail's sending limit has been reached until ${formatDate(
            response.data.details.rate_limit.retry_after
          )}`,
          status: "warning",
          duration: 7000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Auto-reply check complete",
          description: `Processed ${response.data.processed_count} threads, sent ${response.data.replied_count} replies.`,
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("Error triggering auto-reply:", error);

      // Check for rate limit in error response
      let errorMessage = "Could not process auto-replies.";
      let errorStatus = "error";

      if (
        error.response?.data?.detail &&
        error.response.data.detail.includes("rate limit exceeded")
      ) {
        errorStatus = "warning";
        errorMessage =
          "Gmail sending rate limit exceeded. You can still configure settings but sending is paused.";

        // Try to extract retry time from error
        const retryMatch =
          error.response.data.detail.match(/Retry after ([^"]+)/);
        const retryTime = retryMatch ? retryMatch[1] : "some time";

        setRateLimitInfo({
          status: "rate_limited",
          retry_after: retryTime,
        });
      }

      toast({
        title: errorStatus === "warning" ? "Gmail Rate Limit Active" : "Error",
        description: errorMessage,
        status: errorStatus,
        duration: 7000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString || dateString === "unknown") return "Unknown";
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return dateString;
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpen={handlePopoverOpen}
      onClose={() => setIsOpen(false)}
      closeOnBlur={false}
      placement="bottom"
      gutter={2}
    >
      <PopoverTrigger>
        <Button
          size={size}
          variant={variant}
          colorScheme={colorScheme}
          isLoading={isLoading}
          loadingText="Processing"
        >
          Auto-Reply
        </Button>
      </PopoverTrigger>
      <PopoverContent width="350px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold">Auto-Reply Settings</PopoverHeader>
        <PopoverBody>
          {isConfigLoading ? (
            <Flex justify="center" align="center" height="150px">
              <Spinner />
            </Flex>
          ) : (
            <VStack spacing={4} align="start">
              {rateLimitInfo && (
                <Box borderRadius="md" p={2} bg="yellow.50" fontSize="sm">
                  <Flex alignItems="center" gap={2} mb={2}>
                    <Text fontWeight="medium" color="yellow.800">
                      Note: Gmail rate limit active until{" "}
                      {formatDate(rateLimitInfo.retry_after)}
                    </Text>
                  </Flex>
                  <Button
                    size="xs"
                    colorScheme="yellow"
                    onClick={async () => {
                      try {
                        await resetGmailRateLimits();
                        setRateLimitInfo(null);
                        toast({
                          title: "Rate Limits Reset",
                          description:
                            "Successfully cleared any active rate limits.",
                          status: "success",
                          duration: 5000,
                          isClosable: true,
                        });
                      } catch (error) {
                        console.error("Error resetting rate limits:", error);
                        toast({
                          title: "Error",
                          description: "Failed to reset rate limits.",
                          status: "error",
                          duration: 5000,
                          isClosable: true,
                        });
                      }
                    }}
                  >
                    Reset Rate Limit
                  </Button>
                </Box>
              )}

              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="auto-reply-enabled" mb="0">
                  Enable Auto-Reply
                </FormLabel>
                <Switch
                  id="auto-reply-enabled"
                  isChecked={config.enabled}
                  onChange={(e) =>
                    setConfig({ ...config, enabled: e.target.checked })
                  }
                  isDisabled={!!rateLimitInfo}
                />
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="max-threads">
                  Max Threads to Check
                </FormLabel>
                <Input
                  id="max-threads"
                  type="number"
                  value={config.max_threads_per_check}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      max_threads_per_check: parseInt(e.target.value),
                    })
                  }
                  min={1}
                  max={100}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <Tooltip label="Disable to use plain text format which may help avoid rate limits">
                  <FormLabel htmlFor="use-html" mb="0">
                    Use HTML Formatting
                  </FormLabel>
                </Tooltip>
                <Switch
                  id="use-html"
                  isChecked={config.use_html}
                  onChange={(e) =>
                    setConfig({ ...config, use_html: e.target.checked })
                  }
                />
              </FormControl>

              <FormControl>
                <FormLabel htmlFor="signature">
                  Custom Signature (optional)
                </FormLabel>
                <Textarea
                  id="signature"
                  value={config.auto_reply_signature || ""}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      auto_reply_signature: e.target.value || null,
                    })
                  }
                  placeholder="Best regards,&#10;Your Name"
                  size="sm"
                />
              </FormControl>

              {status && (
                <Box width="100%" mt={2}>
                  <Text fontSize="sm" fontWeight="bold">
                    Status
                  </Text>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Enabled:</Text>
                    <Badge colorScheme={status.enabled ? "green" : "red"}>
                      {status.enabled ? "Active" : "Inactive"}
                    </Badge>
                  </Flex>
                  {status.last_check_time && (
                    <Flex justify="space-between">
                      <Text fontSize="sm">Last Check:</Text>
                      <Text fontSize="sm">
                        {new Date(status.last_check_time).toLocaleString()}
                      </Text>
                    </Flex>
                  )}
                  <Flex justify="space-between">
                    <Text fontSize="sm">Total Replies:</Text>
                    <Text fontSize="sm">{status.total_replies_sent}</Text>
                  </Flex>
                </Box>
              )}

              {replyStats && (
                <Box width="100%" mt={2} p={2} bg="gray.50" borderRadius="md">
                  <Text fontSize="sm" fontWeight="bold">
                    Last Check Results:
                  </Text>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Processed:</Text>
                    <Text fontSize="sm">
                      {replyStats.processed_count} threads
                    </Text>
                  </Flex>
                  <Flex justify="space-between">
                    <Text fontSize="sm">Replies Sent:</Text>
                    <Badge
                      colorScheme={
                        replyStats.replied_count > 0 ? "green" : "gray"
                      }
                    >
                      {replyStats.replied_count}
                    </Badge>
                  </Flex>
                  {replyStats.details?.error_count > 0 && (
                    <Flex justify="space-between">
                      <Text fontSize="sm">Errors:</Text>
                      <Badge colorScheme="red">
                        {replyStats.details.error_count}
                      </Badge>
                    </Flex>
                  )}
                </Box>
              )}
            </VStack>
          )}
        </PopoverBody>
        <PopoverFooter display="flex" justifyContent="space-between">
          <Button
            size="sm"
            onClick={handleSaveConfig}
            isDisabled={isConfigLoading}
          >
            Save Settings
          </Button>
          <Tooltip
            isDisabled={!rateLimitInfo}
            label={
              rateLimitInfo
                ? `Gmail rate limit active until ${formatDate(
                    rateLimitInfo.retry_after
                  )}`
                : ""
            }
            placement="top"
          >
            <Button
              size="sm"
              colorScheme="blue"
              onClick={handleTriggerAutoReply}
              isLoading={isLoading}
              isDisabled={isConfigLoading || !config.enabled || !!rateLimitInfo}
            >
              Run Now
            </Button>
          </Tooltip>
        </PopoverFooter>
      </PopoverContent>
    </Popover>
  );
};

export default AutoReplyButton;
