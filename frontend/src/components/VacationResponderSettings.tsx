import { useState, useEffect } from "react";
import {
  Box,
  Button,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Switch,
  VStack,
  HStack,
  Heading,
  Text,
  useToast,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Checkbox,
  Spinner,
  Badge,
} from "@chakra-ui/react";
import {
  getGmailVacationSettings,
  enableGmailVacationResponder,
  disableGmailVacationResponder,
  getGmailRateLimitStatus,
} from "../lib/api";

const VacationResponderSettings = () => {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<any>(null);

  const [formData, setFormData] = useState({
    response_subject: "",
    response_body_html: "",
    restrict_to_domain: false,
    restrict_to_contacts: false,
    end_date: "", // YYYY-MM-DD
    end_time: "", // HH:MM
  });

  // Fetch current settings and rate limit info on component mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      // Get current vacation settings
      const settingsResponse = await getGmailVacationSettings();
      setSettings(settingsResponse.data);

      // If vacation responder is enabled, populate form with current settings
      if (settingsResponse.data.enableAutoReply) {
        setFormData({
          response_subject: settingsResponse.data.responseSubject || "",
          response_body_html: settingsResponse.data.responseBodyHtml || "",
          restrict_to_domain: settingsResponse.data.restrictToDomain || false,
          restrict_to_contacts:
            settingsResponse.data.restrictToContacts || false,
          end_date: "",
          end_time: "",
        });
      }

      // Check for rate limits
      const rateLimitResponse = await getGmailRateLimitStatus();
      if (rateLimitResponse.data.is_rate_limited) {
        setRateLimitInfo(rateLimitResponse.data);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch Gmail vacation settings",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleEnable = async () => {
    setIsSubmitting(true);
    try {
      // Construct end_time from date and time inputs if provided
      let end_time = null;
      if (formData.end_date && formData.end_time) {
        end_time = new Date(
          `${formData.end_date}T${formData.end_time}:00`
        ).toISOString();
      }

      // Enable vacation responder
      const response = await enableGmailVacationResponder({
        response_subject: formData.response_subject,
        response_body_html: formData.response_body_html,
        restrict_to_domain: formData.restrict_to_domain,
        restrict_to_contacts: formData.restrict_to_contacts,
        end_time: end_time,
      });

      // Update settings with new response
      setSettings(response.data.settings);

      toast({
        title: "Success",
        description: "Gmail vacation responder enabled successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Refresh settings
      fetchSettings();
    } catch (error) {
      console.error("Error enabling vacation responder:", error);

      // Check for rate limit errors
      if (error.response?.data?.details?.rate_limit) {
        setRateLimitInfo(error.response.data.details.rate_limit);
        toast({
          title: "Rate Limit Exceeded",
          description: `Gmail API rate limit reached. Try again after ${new Date(
            error.response.data.details.rate_limit.retry_after
          ).toLocaleString()}`,
          status: "warning",
          duration: 10000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to enable Gmail vacation responder",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable = async () => {
    setIsSubmitting(true);
    try {
      // Disable vacation responder
      await disableGmailVacationResponder();

      toast({
        title: "Success",
        description: "Gmail vacation responder disabled successfully",
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Refresh settings
      fetchSettings();
    } catch (error) {
      console.error("Error disabling vacation responder:", error);
      toast({
        title: "Error",
        description: "Failed to disable Gmail vacation responder",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <Box p={5} borderWidth={1} borderRadius="md" shadow="md">
        <VStack spacing={4} align="center">
          <Heading size="md">Gmail Vacation Responder</Heading>
          <Spinner size="xl" />
          <Text>Loading settings...</Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={5} borderWidth={1} borderRadius="md" shadow="md">
      <VStack spacing={6} align="stretch">
        <Heading size="md">Gmail Vacation Responder</Heading>

        {rateLimitInfo && (
          <Alert status="warning" borderRadius="md">
            <AlertIcon />
            <Box flex="1">
              <AlertTitle>Gmail Rate Limit Reached</AlertTitle>
              <AlertDescription display="block">
                Gmail's API rate limit has been reached.
                <Text>
                  Retry after:{" "}
                  {new Date(rateLimitInfo.retry_after).toLocaleString()}
                </Text>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Current Status */}
        <Box p={4} bg="gray.50" borderRadius="md">
          <Heading size="sm" mb={2}>
            Current Status
          </Heading>
          <HStack justify="space-between">
            <Text>Auto-Reply:</Text>
            <Badge colorScheme={settings?.enableAutoReply ? "green" : "red"}>
              {settings?.enableAutoReply ? "Enabled" : "Disabled"}
            </Badge>
          </HStack>

          {settings?.enableAutoReply && (
            <>
              <Text mt={2} fontWeight="bold">
                Response Subject:
              </Text>
              <Text>{settings.responseSubject}</Text>

              <Text mt={2} fontWeight="bold">
                Response Body:
              </Text>
              <Box p={2} bg="white" borderRadius="sm" mt={1}>
                <div
                  dangerouslySetInnerHTML={{
                    __html: settings.responseBodyHtml,
                  }}
                />
              </Box>

              {settings.startTimeFormatted && (
                <HStack mt={2}>
                  <Text>Start Time:</Text>
                  <Text>
                    {new Date(settings.startTimeFormatted).toLocaleString()}
                  </Text>
                </HStack>
              )}

              {settings.endTimeFormatted && (
                <HStack mt={2}>
                  <Text>End Time:</Text>
                  <Text>
                    {new Date(settings.endTimeFormatted).toLocaleString()}
                  </Text>
                </HStack>
              )}

              <HStack mt={2}>
                <Text>Restricted to Domain:</Text>
                <Badge>{settings.restrictToDomain ? "Yes" : "No"}</Badge>
              </HStack>

              <HStack mt={2}>
                <Text>Restricted to Contacts:</Text>
                <Badge>{settings.restrictToContacts ? "Yes" : "No"}</Badge>
              </HStack>
            </>
          )}
        </Box>

        <Divider />

        {/* Settings Form */}
        <Box>
          <Heading size="sm" mb={4}>
            Configure Vacation Responder
          </Heading>

          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Subject Line</FormLabel>
              <Input
                name="response_subject"
                value={formData.response_subject}
                onChange={handleInputChange}
                placeholder="Out of Office: Will reply when I return"
                isDisabled={isSubmitting || !!rateLimitInfo}
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Response Message</FormLabel>
              <Textarea
                name="response_body_html"
                value={formData.response_body_html}
                onChange={handleInputChange}
                placeholder="I am currently out of the office and will respond when I return."
                rows={6}
                isDisabled={isSubmitting || !!rateLimitInfo}
              />
            </FormControl>

            <FormControl>
              <FormLabel>End Date (Optional)</FormLabel>
              <Input
                name="end_date"
                type="date"
                value={formData.end_date}
                onChange={handleInputChange}
                isDisabled={isSubmitting || !!rateLimitInfo}
              />
              <Text fontSize="sm" color="gray.600" mt={1}>
                If not set, auto-reply will continue until manually disabled
              </Text>
            </FormControl>

            <FormControl>
              <FormLabel>End Time (Optional)</FormLabel>
              <Input
                name="end_time"
                type="time"
                value={formData.end_time}
                onChange={handleInputChange}
                isDisabled={isSubmitting || !!rateLimitInfo}
              />
            </FormControl>

            <HStack spacing={8} mt={2}>
              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="restrict-domain" mb="0">
                  Restrict to Domain
                </FormLabel>
                <Switch
                  id="restrict-domain"
                  name="restrict_to_domain"
                  isChecked={formData.restrict_to_domain}
                  onChange={handleInputChange}
                  isDisabled={isSubmitting || !!rateLimitInfo}
                />
              </FormControl>

              <FormControl display="flex" alignItems="center">
                <FormLabel htmlFor="restrict-contacts" mb="0">
                  Restrict to Contacts
                </FormLabel>
                <Switch
                  id="restrict-contacts"
                  name="restrict_to_contacts"
                  isChecked={formData.restrict_to_contacts}
                  onChange={handleInputChange}
                  isDisabled={isSubmitting || !!rateLimitInfo}
                />
              </FormControl>
            </HStack>
          </VStack>

          <HStack mt={6} spacing={4} justify="flex-end">
            <Button
              colorScheme="red"
              onClick={handleDisable}
              isLoading={isSubmitting}
              loadingText="Disabling..."
              isDisabled={!settings?.enableAutoReply || !!rateLimitInfo}
            >
              Disable Auto-Reply
            </Button>

            <Button
              colorScheme="blue"
              onClick={handleEnable}
              isLoading={isSubmitting}
              loadingText="Enabling..."
              isDisabled={
                !formData.response_subject ||
                !formData.response_body_html ||
                !!rateLimitInfo
              }
            >
              Enable Auto-Reply
            </Button>
          </HStack>
        </Box>

        <Box mt={4}>
          <Alert status="info" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>About Gmail's Vacation Responder</AlertTitle>
              <AlertDescription>
                <Text>
                  Gmail's built-in vacation responder is more reliable than
                  custom auto-reply solutions:
                </Text>
                <VStack align="start" mt={2} spacing={1}>
                  <Text>
                    • Automatically prevents duplicate responses to the same
                    sender
                  </Text>
                  <Text>
                    • Works directly within Gmail and respects Gmail's rate
                    limits
                  </Text>
                  <Text>
                    • Continues working even when this application is offline
                  </Text>
                  <Text>
                    • Can be limited to contacts or people in your organization
                  </Text>
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        </Box>
      </VStack>
    </Box>
  );
};

export default VacationResponderSettings;
