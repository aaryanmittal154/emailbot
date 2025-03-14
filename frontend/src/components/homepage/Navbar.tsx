import React, { useState, useEffect, useContext } from "react";
import {
  Box,
  Flex,
  Text,
  IconButton,
  Button,
  useColorModeValue,
  Container,
  Icon,
  HStack,
  useColorMode,
  Link,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaMoon, FaSun, FaBolt } from "react-icons/fa";
import axios from "axios";

// Animation for button glow - updated for continuous border effect
const borderGlow = keyframes`
  0% { border-color: rgba(159, 122, 234, 0.7); }
  50% { border-color: rgba(159, 122, 234, 1); }
  100% { border-color: rgba(159, 122, 234, 0.7); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(159, 122, 234, 0.5); }
  70% { box-shadow: 0 0 30px 10px rgba(159, 122, 234, 0.2); }
  100% { box-shadow: 0 0 0 0 rgba(159, 122, 234, 0); }
`;

const Navbar = () => {
  // First all the context hooks
  const { colorMode, toggleColorMode } = useColorMode();

  // All state hooks
  const [scrolled, setScrolled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Effect hooks
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 60) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Then derived values using hooks
  const bgColor = useColorModeValue(
    scrolled ? "white" : "transparent",
    scrolled ? "gray.900" : "transparent"
  );
  const textColor = useColorModeValue("gray.800", "white");
  const boxShadow = scrolled
    ? useColorModeValue(
        "0 4px 6px rgba(160, 174, 192, 0.1)",
        "0 4px 6px rgba(0, 0, 0, 0.3)"
      )
    : "none";
  const buttonBg = useColorModeValue("purple.400", "purple.500");
  const buttonHoverBg = useColorModeValue("purple.500", "purple.600");
  const buttonActiveBg = useColorModeValue("purple.600", "purple.700");

  // Event handlers after all hooks
  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      // Log the API URL for debugging
      console.log(`Connecting to API at: ${process.env.NEXT_PUBLIC_API_URL}`);
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`
      );
      // Check if the response has auth_url
      if (response.data.auth_url) {
        // Redirect to the Google OAuth URL
        window.location.href = response.data.auth_url;
      } else {
        console.error("No auth_url found in response:", response.data);
      }
    } catch (error) {
      console.error("Error during authentication:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      position="fixed"
      top="0"
      width="100%"
      zIndex={1000}
      bg={bgColor}
      color={textColor}
      boxShadow={boxShadow}
      transition="all 0.3s ease"
      backdropFilter={scrolled ? "blur(10px)" : "none"}
    >
      <Container maxW="container.xl">
        <Flex h={"70px"} py={2} align={"center"} justify={"space-between"}>
          {/* Logo and Name */}
          <Flex align="center">
            <Icon as={FaBolt} w={6} h={6} color="purple.400" mr={2} />
            <Text
              fontSize={"xl"}
              fontWeight="bold"
              bgGradient="linear(to-r, purple.400, purple.600)"
              bgClip="text"
            >
              Superconnector Mail
            </Text>
          </Flex>

          {/* Right side - Dark mode toggle and Sign in button */}
          <HStack spacing={6}>
            <IconButton
              aria-label={"Toggle Color Mode"}
              icon={colorMode === "light" ? <FaMoon /> : <FaSun />}
              onClick={toggleColorMode}
              variant={"ghost"}
              size={"md"}
            />

            <Link
              href={`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`}
              _hover={{ textDecoration: "none" }}
            >
              <Button
                colorScheme="purple"
                size="md"
                rounded="md"
                onClick={handleSignIn}
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </Link>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
