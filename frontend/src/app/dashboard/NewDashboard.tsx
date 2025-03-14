"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { ChakraProvider } from "@chakra-ui/react";
import OnboardingModal from "../../components/OnboardingModal";
import DashboardLayout from "../../components/ui/DashboardLayout";
import DashboardContent from "../../components/ui/DashboardContent";
import theme from "../../styles/theme";

interface UserData {
  id: number;
  email: string;
  full_name: string;
  picture: string;
  is_onboarded: boolean;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Add state for onboarding modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Handler for when onboarding completes
  const handleOnboardingComplete = () => {
    // Update user data to reflect onboarding is complete
    if (user) {
      setUser({ ...user, is_onboarded: true });
    }
  };

  // Close the onboarding modal
  const closeOnboardingModal = () => {
    setShowOnboardingModal(false);
  };

  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem("auth_token");
    
    // Redirect to login page
    router.push("/");
  };

  useEffect(() => {
    const token = localStorage.getItem("auth_token");

    if (!token) {
      console.log("No token found in localStorage, redirecting to login");
      router.push("/");
      return;
    }

    console.log("Token found in localStorage:", token.substring(0, 15) + "...");

    // Set up axios with the token
    const apiBaseUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    console.log("API Base URL:", apiBaseUrl);

    axios.defaults.baseURL = apiBaseUrl;
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Fetch user data
    fetchUserData();
  }, [router]);

  const fetchUserData = async () => {
    try {
      const response = await axios.get("/api/users/me");
      console.log("User data:", response.data);
      setUser(response.data);

      // Check if user needs onboarding
      if (!response.data.is_onboarded) {
        console.log("User needs onboarding");
        setShowOnboardingModal(true);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching user data:", error);
      // Handle authentication errors
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        console.log("Authentication error, redirecting to login");
        localStorage.removeItem("auth_token");
        router.push("/");
      }
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <ChakraProvider theme={theme}>
        <div className="flex h-screen w-full items-center justify-center">
          <div className="animate-bounce text-4xl">📧</div>
        </div>
      </ChakraProvider>
    );
  }

  return (
    <ChakraProvider theme={theme}>
      {/* Onboarding Modal */}
      {showOnboardingModal && (
        <OnboardingModal
          isOpen={showOnboardingModal}
          onClose={closeOnboardingModal}
          onComplete={handleOnboardingComplete}
        />
      )}

      {/* Main Dashboard */}
      <DashboardLayout
        user={user}
        onSyncEmails={() => {
          // This will be handled by child component
          setIsSyncing(true);
        }}
        isSyncing={isSyncing}
        notificationCount={0}
        onLogout={handleLogout}
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
