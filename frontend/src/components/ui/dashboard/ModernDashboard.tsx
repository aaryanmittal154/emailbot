"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  ChakraProvider,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import axios from "axios";
import OnboardingModal from "../../OnboardingModal";
import DashboardLayout from "../DashboardLayout";
import DashboardContent from "../DashboardContent";
import theme from "../../../styles/theme";

// Import API functions to maintain existing functionality
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
} from "../../../lib/api";

// Preserve all interfaces from original dashboard
interface UserData {
  id: number;
  email: string;
  full_name: string;
  picture: string;
  is_onboarded: boolean;
}

export default function ModernDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Add state for onboarding modal (preserved from original)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Handler for when onboarding completes (preserved from original)
  const handleOnboardingComplete = () => {
    // Update user data to reflect onboarding is complete
    if (user) {
      setUser({ ...user, is_onboarded: true });
    }
    setShowOnboardingModal(false);
    
    // Toast notification for better UX
    toast({
      title: "Onboarding complete!",
      description: "Your email dashboard is ready to use.",
      status: "success",
      duration: 5000,
      isClosable: true,
    });
  };

  // Close the onboarding modal (preserved from original)
  const closeOnboardingModal = () => {
    setShowOnboardingModal(false);
  };

  // User data fetching (preserved from original)
  const fetchUserData = async () => {
    try {
      const response = await axios.get("/api/users/me");
      console.log("User data:", response.data);
      setUser(response.data);

      // Check if user needs onboarding (preserved from original)
      if (!response.data.is_onboarded) {
        console.log("User needs onboarding");
        setShowOnboardingModal(true);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching user data:", error);
      // Handle authentication errors (preserved from original)
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log("Authentication error, redirecting to login");
        localStorage.removeItem("auth_token");
        router.push("/");
      }
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      console.log("No token found in localStorage, redirecting to login");
      router.push("/");
      return;
    }

    console.log("Token found in localStorage:", token.substring(0, 15) + "...");

    // Set up axios with the token (preserved from original)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    console.log("API Base URL:", apiBaseUrl);

    axios.defaults.baseURL = apiBaseUrl;
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Fetch user data
    fetchUserData();
  }, [router]);

  // Beautiful loading screen with animation
  if (isLoading) {
    return (
      <ChakraProvider theme={theme}>
        <Box 
          display="flex" 
          height="100vh" 
          width="100%" 
          alignItems="center" 
          justifyContent="center"
          bg="gray.50"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 0, 0],
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Spinner 
              thickness="4px"
              speed="0.75s"
              emptyColor="gray.200"
              color="brand.500"
              size="xl"
            />
          </motion.div>
        </Box>
      </ChakraProvider>
    );
  }

  return (
    <ChakraProvider theme={theme}>
      {/* Onboarding Modal (preserved from original) */}
      {showOnboardingModal && (
        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={closeOnboardingModal}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Modern Dashboard UI */}
      <DashboardLayout
        user={user}
        onSyncEmails={() => {
          setIsSyncing(true);
        }}
        isSyncing={isSyncing}
        notificationCount={0}
      >
        <DashboardContent
          user={user}
          isSyncing={isSyncing}
          setIsSyncing={setIsSyncing}
        />
      </DashboardLayout>
    </ChakraProvider>
  );
}
