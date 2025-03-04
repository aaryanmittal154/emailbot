"use client";

import { useState } from "react";
import axios from "axios";
import { Box, useToast, useDisclosure } from "@chakra-ui/react";

// Import our new components
import Navbar from "../components/homepage/Navbar";
import HeroSection from "../components/homepage/HeroSection";
import FeaturesSection from "../components/homepage/FeaturesSection";
import HowItWorksSection from "../components/homepage/HowItWorksSection";
import FAQSection from "../components/homepage/FAQSection";
import CTASection from "../components/homepage/CTASection";
import Footer from "../components/homepage/Footer";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Handle Google login
  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`
      );
      window.location.href = response.data.auth_url;
    } catch (error) {
      console.error("Error during authentication:", error);
      toast({
        title: "Authentication Error",
        description: "Failed to initiate Google login. Please try again.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setIsLoading(false);
    }
  };

  // Clear local storage and cookies
  const clearLocalStorageAndCookies = () => {
    localStorage.clear();
    // Show instructions for clearing cookies manually
    onOpen();
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
    <Box minH="100vh">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section - add a bit of top padding to account for fixed navbar */}
      <Box pt="70px">
        <HeroSection onLogin={handleLogin} isLoading={isLoading} />
      </Box>

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorksSection />

      {/* FAQ Section */}
      <FAQSection />

      {/* Call to Action Section */}
      <CTASection onLogin={handleLogin} isLoading={isLoading} />

      {/* Footer */}
      <Footer />
    </Box>
  );
}
