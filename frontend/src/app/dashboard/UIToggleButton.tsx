"use client";

import { Button, Box, useToast } from "@chakra-ui/react";

interface UIToggleButtonProps {
  onEnableModernUI: () => void;
}

export default function UIToggleButton({ onEnableModernUI }: UIToggleButtonProps) {
  const toast = useToast();

  const handleClick = () => {
    onEnableModernUI();
    toast({
      title: "Modern UI enabled",
      description: "Experiencing the new design. You can switch back anytime.",
      status: "info",
      duration: 3000,
      isClosable: true,
    });
  };

  return (
    <Box position="fixed" bottom="20px" right="20px" zIndex="1000">
      <Button
        colorScheme="blue"
        size="md"
        onClick={handleClick}
        rightIcon={<span role="img" aria-label="sparkles">✨</span>}
        boxShadow="lg"
        borderRadius="full"
        px={4}
      >
        Try Modern UI
      </Button>
    </Box>
  );
}
