import React from "react";
import {
  Box,
  Container,
  Flex,
  VStack,
  HStack,
  Text,
  useColorModeValue,
  Switch,
  FormLabel,
  useBreakpointValue,
  IconButton,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
} from "@chakra-ui/react";
import { HamburgerIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import Navbar from "./Navbar";
import NavigationSidebar from "./NavigationSidebar";

// Define props for the layout component
interface DashboardLayoutProps {
  user: any;
  children: React.ReactNode;
  onSyncEmails: () => void;
  isSyncing: boolean;
  notificationCount?: number;
  onLogout?: () => void;
  isAutoReplyEnabled?: boolean;
  isLoadingAutoReplyStatus?: boolean;
  isTogglingAutoReply?: boolean;
  onToggleAutoReply?: () => void;
  activeTab?: number;
  onTabChange?: (index: number) => void;
  tabCounts?: { [key: string]: number };
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  children,
  onLogout,
  isAutoReplyEnabled = false,
  isLoadingAutoReplyStatus = false,
  isTogglingAutoReply = false,
  onToggleAutoReply = () => {},
  activeTab = 0,
  onTabChange = () => {},
  tabCounts = {},
}) => {
  // Color variables
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const toggleBgColor = useColorModeValue("gray.50", "gray.800");
  const shadowColor = useColorModeValue("rgba(0,0,0,0.04)", "rgba(0,0,0,0.15)");

  // Responsive variables
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box bg={bgColor} minH="100vh">
      {/* Navbar */}
      <Navbar user={user} onLogout={onLogout} />

      {/* Auto-reply toggle below navbar */}
      <MotionFlex
        justify="center"
        py={2}
        px={4}
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
        bg={toggleBgColor}
        boxShadow={`0 1px 5px ${shadowColor}`}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <HStack
          spacing={4}
          align="center"
          p={1}
          borderRadius="full"
          bg={useColorModeValue("white", "gray.700")}
          boxShadow="sm"
          px={4}
        >
          <FormLabel
            htmlFor="auto-reply-toggle"
            mb="0"
            fontWeight="500"
            fontSize="sm"
            color={useColorModeValue("gray.600", "gray.200")}
            cursor="pointer"
            whiteSpace="nowrap"
          >
            Background Auto-Reply
          </FormLabel>
          <Switch
            id="auto-reply-toggle"
            isChecked={isAutoReplyEnabled}
            onChange={onToggleAutoReply}
            isDisabled={isLoadingAutoReplyStatus || isTogglingAutoReply}
            colorScheme="teal"
            size="md"
          />
        </HStack>
      </MotionFlex>

      {/* Main content area with sidebar */}
      <Flex h="calc(100vh - 110px)">
        {/* Mobile menu button - only visible on mobile */}
        {isMobile && (
          <MotionBox
            position="fixed"
            bottom="20px"
            left="20px"
            zIndex="999"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <IconButton
              icon={<HamburgerIcon />}
              aria-label="Open menu"
              colorScheme="blue"
              boxShadow="lg"
              borderRadius="full"
              size="lg"
              onClick={onOpen}
              _hover={{ transform: "translateY(-2px)" }}
              transition="all 0.2s"
            />
          </MotionBox>
        )}

        {/* Desktop sidebar - only visible on desktop */}
        {!isMobile && (
          <NavigationSidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            counts={tabCounts}
          />
        )}

        {/* Mobile drawer */}
        <Drawer isOpen={isOpen} placement="left" onClose={onClose} size="xs">
          <DrawerOverlay backdropFilter="blur(4px)" />
          <DrawerContent borderRightRadius="lg" boxShadow="2xl">
            <DrawerCloseButton size="lg" m={2} />
            <DrawerHeader
              borderBottomWidth="1px"
              borderColor={borderColor}
              fontWeight="600"
              color={useColorModeValue("blue.600", "blue.200")}
              fontSize="md"
            >
              Navigation
            </DrawerHeader>
            <DrawerBody p={0}>
              <NavigationSidebar
                activeTab={activeTab}
                onTabChange={(index) => {
                  onTabChange(index);
                  onClose();
                }}
                counts={tabCounts}
              />
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        {/* Main content area */}
        <Box
          flex="1"
          p={0}
          overflowY="auto"
          width="100%"
          bg={useColorModeValue("gray.50", "gray.900")}
          sx={{
            scrollbarWidth: "thin",
            scrollbarColor: `${borderColor} transparent`,
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-track": {
              background: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              background: borderColor,
              borderRadius: "8px",
            },
          }}
        >
          <Container maxW="100%" p={4}>
            {children}
          </Container>
        </Box>
      </Flex>
    </Box>
  );
};

export default DashboardLayout;
