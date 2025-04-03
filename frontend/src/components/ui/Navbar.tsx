import React from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  useColorModeValue,
  HStack,
  Avatar,
  IconButton,
  useBreakpointValue,
} from "@chakra-ui/react";
import { FiLogOut } from "react-icons/fi";
import { motion } from "framer-motion";

// Define props for the navbar component
interface NavbarProps {
  user: {
    full_name?: string;
    email?: string;
    picture?: string;
  };
  onLogout: () => void;
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionText = motion(Text);

const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  // Color variables
  const bgColor = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.800", "white");
  const shadowColor = useColorModeValue("rgba(0,0,0,0.05)", "rgba(0,0,0,0.2)");

  // Responsive variables
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Get first name for display
  const firstName = user?.full_name?.split(" ")[0] || "User";

  return (
    <MotionFlex
      as="nav"
      align="center"
      justify="space-between"
      wrap="wrap"
      w="100%"
      py={3}
      px={6}
      bg={bgColor}
      color={textColor}
      boxShadow={`0 1px 10px ${shadowColor}`}
      position="sticky"
      top={0}
      zIndex={10}
      backdropFilter="blur(10px)"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left side - Brand name */}
      <MotionBox
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <MotionText
          fontSize="xl"
          fontWeight="800"
          letterSpacing="-0.5px"
          bgGradient="linear(to-r, blue.500, teal.400)"
          bgClip="text"
          whileHover={{ scale: 1.03 }}
          transition={{ duration: 0.2 }}
        >
          Supermail
        </MotionText>
      </MotionBox>

      {/* Center - Username with avatar */}
      <HStack
        spacing={3}
        justifyContent="center"
        position="absolute"
        left="50%"
        transform="translateX(-50%)"
        display={{ base: "none", md: "flex" }}
      >
        <MotionBox
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          whileHover={{ y: -2 }}
        >
          <HStack
            spacing={3}
            p={2}
            borderRadius="full"
            bg={useColorModeValue("gray.50", "gray.700")}
            boxShadow="sm"
          >
            <Avatar
              size="sm"
              name={user?.full_name || "User"}
              src={user?.picture}
              bg="blue.400"
              boxSize="32px"
            />
            <Text fontWeight="500" fontSize="sm" color={textColor}>
              {firstName}
            </Text>
          </HStack>
        </MotionBox>
      </HStack>

      {/* Right side - Logout button */}
      <MotionBox
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        {isMobile ? (
          <IconButton
            aria-label="Logout"
            icon={<FiLogOut />}
            variant="ghost"
            color="blue.500"
            onClick={onLogout}
            borderRadius="full"
            _hover={{ bg: useColorModeValue("gray.100", "gray.700") }}
            size="md"
          />
        ) : (
          <Button
            leftIcon={<FiLogOut />}
            variant="ghost"
            color="blue.500"
            onClick={onLogout}
            borderRadius="full"
            size="sm"
            fontWeight="500"
            _hover={{
              bg: useColorModeValue("gray.100", "gray.700"),
              transform: "translateY(-2px)",
              boxShadow: "sm",
            }}
            _active={{ transform: "translateY(0)" }}
            transition="all 0.2s"
            letterSpacing="0.2px"
          >
            Logout
          </Button>
        )}
      </MotionBox>
    </MotionFlex>
  );
};

export default Navbar;
