import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Text,
  Button,
  Flex,
  Badge,
  useToast,
  Slide,
  SlideFade,
  useDisclosure,
  Icon,
  Tooltip,
} from "@chakra-ui/react";
import { FiBell, FiMail, FiRefreshCw } from "react-icons/fi";
import { getNewEmails } from "../../lib/api";
import {
  getLastEmailCheckTimestamp,
  saveLastEmailCheckTimestamp,
  formatTimeSince,
} from "../../lib/emailUtils";

interface NewEmailNotifierProps {
  onNewEmailsReceived?: (emails: any[]) => void;
  pollingInterval?: number; // in milliseconds
}

const NewEmailNotifier: React.FC<NewEmailNotifierProps> = ({
  onNewEmailsReceived,
  pollingInterval = 60000, // default to 1 minute
}) => {
  const [lastCheckedTimestamp, setLastCheckedTimestamp] = useState<
    string | null
  >(typeof window !== "undefined" ? getLastEmailCheckTimestamp() : null);
  const [newEmailsCount, setNewEmailsCount] = useState(0);
  const [isChecking, setIsChecking] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  // Function to check for new emails
  const checkForNewEmails = useCallback(async () => {
    try {
      setIsChecking(true);

      // Use last checked timestamp or let the backend use default (1 hour ago)
      const response = await getNewEmails(lastCheckedTimestamp);
      const { count, emails, timestamp } = response.data;

      // Update the last checked timestamp for next poll
      setLastCheckedTimestamp(timestamp);
      saveLastEmailCheckTimestamp(timestamp);

      // If we have new emails, show notification and call the callback
      if (count > 0) {
        setNewEmailsCount((prev) => prev + count); // Accumulate count
        onOpen(); // Show notification

        // Call the callback if provided
        if (onNewEmailsReceived) {
          onNewEmailsReceived(emails);
        }

        // Also show a toast for immediate visibility
        toast({
          title: `${count} new email${count === 1 ? "" : "s"} received`,
          description: "Click to view your new messages",
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error) {
      console.error("Error checking for new emails:", error);
      toast({
        title: "Couldn't check for new emails",
        description: "We'll try again later",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsChecking(false);
    }
  }, [lastCheckedTimestamp, onNewEmailsReceived, onOpen, toast]);

  // Set up polling interval
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check immediately on component mount
    checkForNewEmails();

    // Set up polling interval
    const intervalId = setInterval(checkForNewEmails, pollingInterval);

    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [checkForNewEmails, pollingInterval]);

  // Handle viewing new emails
  const handleViewNewEmails = () => {
    // Reset counter
    setNewEmailsCount(0);
    // Close notification
    onClose();

    // The actual viewing logic will depend on the onNewEmailsReceived callback
    // which should handle updating the UI
  };

  // Handle manual refresh
  const handleManualRefresh = () => {
    checkForNewEmails();
  };

  return (
    <>
      {/* Notification banner that slides in when new emails arrive */}
      <Slide direction="top" in={isOpen} style={{ zIndex: 10 }}>
        <Flex
          p={4}
          bg="blue.500"
          color="white"
          justifyContent="space-between"
          alignItems="center"
          boxShadow="md"
        >
          <Flex alignItems="center">
            <Icon as={FiMail} mr={2} />
            <Text fontWeight="medium">
              You have {newEmailsCount} new email
              {newEmailsCount === 1 ? "" : "s"}
            </Text>
          </Flex>
          <Flex>
            <Button
              size="sm"
              onClick={handleViewNewEmails}
              mr={2}
              colorScheme="whiteAlpha"
            >
              View
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              variant="outline"
              colorScheme="whiteAlpha"
            >
              Dismiss
            </Button>
          </Flex>
        </Flex>
      </Slide>

      {/* Floating badge for new email count */}
      {newEmailsCount > 0 && !isOpen && (
        <Box
          position="fixed"
          bottom="20px"
          right="20px"
          zIndex={10}
          onClick={onOpen}
          cursor="pointer"
        >
          <SlideFade in={true} offsetY="20px">
            <Flex
              alignItems="center"
              bg="blue.500"
              color="white"
              p={3}
              borderRadius="full"
              boxShadow="lg"
            >
              <Icon as={FiBell} mr={2} />
              <Badge
                colorScheme="red"
                borderRadius="full"
                px={2}
                py={1}
                fontSize="0.8em"
              >
                {newEmailsCount}
              </Badge>
              <Text ml={2} fontWeight="medium">
                New
              </Text>
            </Flex>
          </SlideFade>
        </Box>
      )}

      {/* Last checked indicator */}
      <Flex
        position="fixed"
        bottom="20px"
        left="20px"
        alignItems="center"
        fontSize="xs"
        color="gray.500"
        zIndex={5}
      >
        <Tooltip label={lastCheckedTimestamp || "Never checked"}>
          <Flex alignItems="center" cursor="help">
            <Icon as={FiRefreshCw} mr={1} />
            <Text>
              {lastCheckedTimestamp
                ? `Last checked: ${formatTimeSince(lastCheckedTimestamp)}`
                : "Checking emails..."}
            </Text>
          </Flex>
        </Tooltip>
        <Button
          size="xs"
          ml={2}
          onClick={handleManualRefresh}
          isLoading={isChecking}
          variant="ghost"
        >
          Refresh
        </Button>
      </Flex>
    </>
  );
};

export default NewEmailNotifier;
