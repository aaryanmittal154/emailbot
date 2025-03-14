import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Text,
  VStack,
  HStack,
  Radio,
  RadioGroup,
  Box,
  Heading,
  useToast,
  Flex,
  Badge,
} from "@chakra-ui/react";
import { setOnboardingPreferences } from "../lib/api";
import axios from "axios";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOnboardingComplete?: () => void; // Callback to trigger after onboarding completes
}

// Define constant for "All" emails option
const ALL_EMAILS = -1;

const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onOnboardingComplete,
}) => {
  const [step, setStep] = useState(1);
  const [emailCount, setEmailCount] = useState(100);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // If user selected "All", use a special value (-1) that the backend will interpret
      const countToSend = emailCount === ALL_EMAILS ? ALL_EMAILS : emailCount;

      console.log("Submitting preferences:", {
        max_emails_to_index: countToSend,
      });

      // Ensure we're sending an integer value
      const payload = {
        max_emails_to_index: Number(countToSend),
      };

      const response = await setOnboardingPreferences(payload);

      console.log("Onboarding response:", response.data);

      toast({
        title: "Preferences saved",
        description: response.data.message,
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      // Call the onOnboardingComplete callback if provided
      if (onOnboardingComplete) {
        onOnboardingComplete();
      }

      onClose();
    } catch (error) {
      console.error("Error saving preferences:", error);

      // Extract more detailed error information
      let errorMessage = "Failed to save your preferences. Please try again.";

      if (axios.isAxiosError(error) && error.response) {
        console.error("Error response:", error.response.data);
        errorMessage = error.response.data?.detail || errorMessage;

        // If the error is auth-related, suggest refreshing the page
        if (error.response.status === 401) {
          errorMessage =
            "Your session may have expired. Please refresh the page and try again.";
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        status: "error",
        duration: 8000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const emailOptions = [
    { value: 10, label: "10", description: "Minimal access" },
    { value: 20, label: "20", description: "Basic functionality" },
    { value: 50, label: "50", description: "Standard usage" },
    { value: 100, label: "100", description: "Recommended" },
    { value: 500, label: "500", description: "Comprehensive analysis" },
    { value: 1000, label: "1000", description: "Extended history" },
    { value: ALL_EMAILS, label: "All", description: "Complete access" },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      isCentered
      closeOnOverlayClick={false}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Welcome to EmailBot</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {step === 1 && (
            <VStack spacing={6} align="stretch">
              <Heading size="md">Let's get you set up</Heading>
              <Text>
                EmailBot uses AI to help you manage your emails more
                efficiently. To provide personalized assistance, we need access
                to some of your emails.
              </Text>
              <Text fontWeight="bold">
                How many of your recent emails would you like us to access?
              </Text>
              <Text fontSize="sm" color="gray.600" mb={4}>
                We'll only index and store metadata for the number you select.
                This helps us understand your communication patterns and provide
                better assistance.
              </Text>

              <RadioGroup
                onChange={(val) => setEmailCount(Number(val))}
                value={emailCount.toString()}
              >
                <VStack align="stretch" spacing={3}>
                  {emailOptions.map((option) => (
                    <Box
                      key={option.value}
                      borderWidth="1px"
                      borderRadius="md"
                      p={3}
                      cursor="pointer"
                      bg={emailCount === option.value ? "blue.50" : "white"}
                      borderColor={
                        emailCount === option.value ? "blue.500" : "gray.200"
                      }
                      onClick={() => setEmailCount(option.value)}
                    >
                      <Flex justifyContent="space-between" alignItems="center">
                        <Radio value={option.value.toString()} size="lg">
                          <Text fontWeight="medium">{option.label} emails</Text>
                        </Radio>
                        <Badge
                          colorScheme={option.value === 100 ? "green" : "blue"}
                        >
                          {option.value === 100
                            ? "Recommended"
                            : option.description}
                        </Badge>
                      </Flex>
                    </Box>
                  ))}
                </VStack>
              </RadioGroup>

              <Text fontSize="sm" color="gray.500" mt={4}>
                Note: You can change this setting later from your dashboard.
                Accessing more emails provides better results but initial
                processing takes longer.
              </Text>
            </VStack>
          )}
        </ModalBody>

        <ModalFooter>
          {step === 1 && (
            <Button
              colorScheme="blue"
              onClick={handleSubmit}
              isLoading={isLoading}
              loadingText="Saving..."
            >
              Get Started
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default OnboardingModal;
