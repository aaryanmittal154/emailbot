import React, { useState, useEffect } from "react";
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
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaMoon, FaSun, FaBolt } from "react-icons/fa";

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
  const { colorMode, toggleColorMode } = useColorMode();
  const [scrolled, setScrolled] = useState(false);

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

  // Button styles
  const buttonBg = useColorModeValue("purple.400", "purple.500");
  const buttonHoverBg = useColorModeValue("purple.500", "purple.600");
  const buttonActiveBg = useColorModeValue("purple.600", "purple.700");

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

            <Button
              px={8}
              py={6}
              fontSize={"lg"}
              fontWeight={600}
              color={"white"}
              bg={buttonBg}
              borderWidth="2px"
              borderColor="purple.400"
              borderRadius="md"
              _hover={{
                bg: buttonHoverBg,
                transform: "translateY(-2px)",
              }}
              _active={{
                bg: buttonActiveBg,
              }}
              sx={{
                animation: `${borderGlow} 1.5s infinite, ${pulse} 2s infinite`,
                position: "relative",
              }}
            >
              Sign In
            </Button>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Navbar;
