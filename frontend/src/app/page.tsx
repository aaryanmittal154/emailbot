"use client";

import {
  Box,
  Button,
  Container,
  Heading,
  Text,
  VStack,
  useToast,
  Link,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  useDisclosure,
  UnorderedList,
  ListItem,
} from "@chakra-ui/react";
import { useState } from "react";
import axios from "axios";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      // Get Google auth URL from backend
      const response = await axios.get("/api/auth/login");
      // Redirect to Google auth page
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Authentication error",
        description: "Unable to connect to Google authentication service.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearLocalStorageAndCookies = () => {
    // Clear localStorage
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Notify user
    toast({
      title: "Application data cleared",
      description:
        "Local application data has been cleared. Please follow the instructions to clear browser cookies.",
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  };

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={8} align="center">
        <Heading as="h1" size="2xl">
          Superconnector Email
        </Heading>

        <Text fontSize="lg" textAlign="center">
          A secure application for managing and analyzing your Gmail
          communications.
        </Text>

        <Box
          p={8}
          borderWidth={1}
          borderRadius="lg"
          boxShadow="lg"
          width="100%"
          textAlign="center"
        >
          <VStack spacing={4}>
            <Heading as="h2" size="lg">
              Sign in with Google
            </Heading>
            <Text>
              Connect securely with your Gmail account to get started. We only
              request minimal permissions needed for the application.
            </Text>
            <Button
              colorScheme="blue"
              size="lg"
              onClick={handleLogin}
              isLoading={isLoading}
              loadingText="Connecting..."
            >
              Sign in with Google
            </Button>

            <Button
              variant="outline"
              colorScheme="red"
              size="md"
              onClick={onOpen}
              mt={2}
            >
              Troubleshoot: Clear Cache & Cookies
            </Button>

            <Text fontSize="sm" color="gray.500">
              We never store your emails, only metadata to help you analyze
              communication patterns.
            </Text>
          </VStack>
        </Box>
      </VStack>

      {/* Cache clearing instructions modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Clear Cache and Cookies</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={4}>
              Having trouble with authentication? Clear your browser cache and
              cookies to fix many common issues:
            </Text>

            <Text fontWeight="bold" mt={4}>
              Step 1: Clear application data
            </Text>
            <Button
              colorScheme="red"
              size="sm"
              onClick={clearLocalStorageAndCookies}
              mb={4}
            >
              Clear Application Data
            </Button>

            <Text fontWeight="bold" mt={4}>
              Step 2: Clear browser cookies and cache
            </Text>
            <UnorderedList spacing={3} mt={2}>
              <ListItem>
                <Text fontWeight="bold">Chrome:</Text> Settings → Privacy and
                security → Clear browsing data
              </ListItem>
              <ListItem>
                <Text fontWeight="bold">Firefox:</Text> Settings → Privacy &
                Security → Cookies and Site Data → Clear Data
              </ListItem>
              <ListItem>
                <Text fontWeight="bold">Safari:</Text> Preferences → Privacy →
                Manage Website Data → Remove All
              </ListItem>
              <ListItem>
                <Text fontWeight="bold">Edge:</Text> Settings → Privacy, search,
                and services → Clear browsing data
              </ListItem>
            </UnorderedList>

            <Text mt={4}>
              After clearing, close and reopen your browser before trying again.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
