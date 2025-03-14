"use client";

import React, { useEffect, useState } from "react";
import { Box, Button, useToast } from "@chakra-ui/react";
import DashboardLayout from "../DashboardLayout";
import DashboardContent from "../DashboardContent";

// Types to ensure compatibility with existing dashboard functionality
interface EmailData {
  id: string;
  gmail_id: string;
  thread_id: string;
  sender: string;
  recipients: string[];
  subject: string;
  snippet: string;
  date: string;
  labels: string[];
  has_attachment: boolean;
  is_read: boolean;
  body?: string;
  internal_date?: number;
}

interface ThreadData {
  thread_id: string;
  messages: EmailData[];
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
}

interface DashboardAdapterProps {
  // Core props from original dashboard
  user: any;
  emails: EmailData[];
  fetchEmails: (page?: number, pageSize?: number) => Promise<void>;
  selectedThread: ThreadData | null;
  setSelectedThread: (thread: ThreadData | null) => void;
  fetchThread: (threadId: string) => Promise<void>;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
  handleSyncEmails: () => Promise<void>;
  
  // Category data from original dashboard
  jobPostings: any[];
  candidates: any[];
  events: any[];
  questions: any[];
  discussionTopics: any[];
  other: any[];
  
  // Category management functions
  fetchLabeledEmails: (initialLoad?: boolean) => Promise<void>;
  handleRefreshCategory: (category: string) => Promise<void>;
  loadedCategories: string[];
  
  // Search functionality
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: () => Promise<void>;
  searchResults: any | null;
  isSearching: boolean;
}

/**
 * This adapter component connects the existing dashboard functionality
 * to our new UI components while preserving all optimizations.
 */
const DashboardAdapter: React.FC<DashboardAdapterProps> = ({
  user,
  emails,
  fetchEmails,
  selectedThread,
  setSelectedThread,
  fetchThread,
  isSyncing,
  setIsSyncing,
  handleSyncEmails,
  jobPostings,
  candidates,
  events,
  questions,
  discussionTopics,
  other,
  fetchLabeledEmails,
  handleRefreshCategory,
  loadedCategories,
  searchQuery,
  setSearchQuery,
  handleSearch,
  searchResults,
  isSearching,
}) => {
  const toast = useToast();
  const [isUsingNewUI, setIsUsingNewUI] = useState(true);
  
  // Map the categories to our new DashboardContent format
  const getEmails = async (page = 1, pageSize = 20) => {
    await fetchEmails(page, pageSize);
    return emails;
  };
  
  // Handle email selection through the adapter
  const handleSelectEmail = (email: EmailData) => {
    fetchThread(email.thread_id);
  };
  
  // Sync emails through the adapter
  const handleSyncEmailsAdapter = async () => {
    setIsSyncing(true);
    await handleSyncEmails();
    
    toast({
      title: "Emails synced",
      description: "Your inbox has been updated with the latest emails.",
      status: "success",
      duration: 3000,
      isClosable: true,
    });
  };
  
  return (
    <>
      {isUsingNewUI ? (
        <DashboardLayout
          user={user}
          onSyncEmails={handleSyncEmailsAdapter}
          isSyncing={isSyncing}
          notificationCount={0}
        >
          <DashboardContent
            user={user}
            isSyncing={isSyncing}
            setIsSyncing={setIsSyncing}
          />
        </DashboardLayout>
      ) : (
        <Box position="fixed" right="20px" bottom="20px" zIndex={999}>
          <Button
            colorScheme="brand"
            onClick={() => setIsUsingNewUI(true)}
          >
            Switch to Modern UI
          </Button>
        </Box>
      )}
    </>
  );
};

export default DashboardAdapter;
