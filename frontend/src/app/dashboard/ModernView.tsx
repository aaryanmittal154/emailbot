"use client";

import { ChakraProvider, Box, Button, useColorModeValue } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../../components/ui/DashboardLayout";
import DashboardContent from "../../components/ui/DashboardContent";
import theme from "../../styles/theme";
import { getEmails, syncEmails, getEmailsByLabel } from "../../lib/api";

interface ModernViewProps {
  user: any;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  onSwitchBack: () => void;
}

export default function ModernView({ 
  user, 
  isSyncing, 
  setIsSyncing,
  onSwitchBack
}: ModernViewProps) {
  const [emails, setEmails] = useState<any[]>([]);
  const [jobPostings, setJobPostings] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Logout handler
  const handleLogout = () => {
    // Clear authentication data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_id");
    
    // Redirect to login page
    router.push("/");
  };

  // Fetch initial data when component mounts
  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        // Add timestamp for cache busting
        const timestamp = Date.now();
        
        // Fetch all emails
        const emailsResponse = await getEmails({
          page: 1,
          max_results: 20,
          t: timestamp
        });
        
        // Fetch high-priority categories (preserve lazy loading strategy)
        const [
          jobPostingsRes,
          candidatesRes
        ] = await Promise.all([
          getEmailsByLabel("Job Posting", { t: timestamp }),
          getEmailsByLabel("Candidate", { t: timestamp })
        ]);
        
        console.log("Modern UI data fetched:", {
          emails: emailsResponse.data,
          jobPostings: jobPostingsRes.data,
          candidates: candidatesRes.data
        });
        
        // Update state with fetched data - handle different response formats
        // Some endpoints return {emails: [...]} and others return the array directly
        const emailsData = Array.isArray(emailsResponse.data) 
          ? emailsResponse.data 
          : (emailsResponse.data?.emails || []);
          
        const jobPostingsData = Array.isArray(jobPostingsRes.data) 
          ? jobPostingsRes.data 
          : (jobPostingsRes.data?.emails || []);
          
        const candidatesData = Array.isArray(candidatesRes.data) 
          ? candidatesRes.data 
          : (candidatesRes.data?.emails || []);
        
        setEmails(emailsData);
        setJobPostings(jobPostingsData);
        setCandidates(candidatesData);
      } catch (error) {
        console.error("Error fetching data for modern UI:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInitialData();
    
    // Set up automatic refresh
    const refreshInterval = setInterval(() => {
      console.log("Auto-refreshing emails in Modern UI");
      fetchInitialData();
    }, 60000); // 60000ms = 1 minute
    
    return () => {
      clearInterval(refreshInterval);
    };
  }, [user.id]);

  const handleSyncEmails = async () => {
    try {
      setIsSyncing(true);
      await syncEmails();
      // Refetch emails after sync
      setTimeout(async () => {
        const timestamp = Date.now();
        const emailsResponse = await getEmails({
          page: 1,
          max_results: 20,
          t: timestamp
        });
        
        const emailsData = Array.isArray(emailsResponse.data) 
          ? emailsResponse.data 
          : (emailsResponse.data?.emails || []);
        
        setEmails(emailsData);
        setIsSyncing(false);
      }, 3000);
    } catch (error) {
      console.error("Error syncing emails:", error);
      setIsSyncing(false);
    }
  };

  return (
    <ChakraProvider theme={theme}>
      <DashboardLayout
        user={user}
        onSyncEmails={handleSyncEmails}
        isSyncing={isSyncing}
        notificationCount={0}
        onLogout={handleLogout}
      >
        <Box mb={4}>
          <Button 
            onClick={onSwitchBack}
            variant="outline"
            size="sm"
            colorScheme="gray"
          >
            Return to Classic View
          </Button>
        </Box>
        <DashboardContent
          user={user}
          isSyncing={isSyncing}
          setIsSyncing={setIsSyncing}
          emails={emails}
          jobPostings={jobPostings}
          candidates={candidates}
          isLoading={isLoading}
        />
      </DashboardLayout>
    </ChakraProvider>
  );
}
