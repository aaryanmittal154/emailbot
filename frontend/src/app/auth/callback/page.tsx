"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Center, Spinner, Text, VStack, useToast } from "@chakra-ui/react";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get token from URL
    const token = searchParams.get("token");
    const userId = searchParams.get("user_id");

    console.log("Auth callback received params:", {
      token: token ? `${token.substring(0, 10)}...` : "null",
      userId,
    });

    if (token && userId) {
      // Store token in localStorage
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_id", userId);
      console.log("Token and user ID stored in localStorage");

      toast({
        title: "Login successful",
        description: "You have been successfully authenticated.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      // Redirect to dashboard or home
      setTimeout(() => {
        console.log("Redirecting to dashboard...");
        router.push("/dashboard");
      }, 2000);
    } else {
      console.error("Authentication failed: Missing token or user ID");
      setError("Authentication failed. Please try again.");
    }
  }, [searchParams, router, toast]);

  return (
    <Center h="100vh">
      <VStack spacing={4}>
        {error ? (
          <Text color="red.500">{error}</Text>
        ) : (
          <>
            <Spinner size="xl" color="blue.500" />
            <Text>Completing authentication...</Text>
          </>
        )}
      </VStack>
    </Center>
  );
}
