"use client";

import { useState } from "react";
import { Button, Box, useToast } from "@chakra-ui/react";
import ModernView from "./ModernView";

interface UIToggleProps {
  user: any;
  isSyncing: boolean;
  setIsSyncing: (value: boolean) => void;
}

export default function UIToggle({ user, isSyncing, setIsSyncing }: UIToggleProps) {
  const [usingModernUI, setUsingModernUI] = useState(false);
  const toast = useToast();

  const enableModernUI = () => {
    setUsingModernUI(true);
    toast({
      title: "Modern UI enabled",
      description: "Experiencing the new design. You can switch back at any time.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  const disableModernUI = () => {
    setUsingModernUI(false);
    toast({
      title: "Classic UI restored",
      description: "Returned to the classic dashboard view.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  if (usingModernUI) {
    return (
      <>
        <Box position="fixed" top="20px" right="20px" zIndex="1000">
          <Button
            colorScheme="blue"
            variant="outline"
            size="sm"
            onClick={disableModernUI}
          >
            Return to Classic View
          </Button>
        </Box>
        <ModernView 
          user={user}
          isSyncing={isSyncing}
          setIsSyncing={setIsSyncing}
          onSwitchBack={disableModernUI}
        />
      </>
    );
  }

  return (
    <Box position="fixed" bottom="20px" right="20px" zIndex="1000">
      <Button
        colorScheme="blue"
        size="sm"
        onClick={enableModernUI}
        rightIcon={<span role="img" aria-label="sparkles">✨</span>}
        boxShadow="lg"
      >
        Try Modern UI
      </Button>
    </Box>
  );
}
