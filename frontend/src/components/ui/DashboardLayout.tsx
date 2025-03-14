import React from 'react';
import {
  Box,
  Container,
  Flex,
  VStack,
  HStack,
  Heading,
  Text,
  useColorModeValue,
  useBreakpointValue,
  IconButton,
  Button,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Avatar,
  Divider,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  useDisclosure,
  Icon
} from '@chakra-ui/react';
import { 
  HamburgerIcon, 
  EmailIcon, 
  BellIcon, 
  SearchIcon, 
  SettingsIcon,
  ChevronDownIcon,
  InfoIcon
} from '@chakra-ui/icons';
import { motion } from 'framer-motion';

// Define props for the layout component
interface DashboardLayoutProps {
  user: any;
  children: React.ReactNode;
  onSyncEmails: () => void;
  isSyncing: boolean;
  notificationCount?: number;
  onLogout?: () => void;
}

const MotionBox = motion(Box);

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  user,
  children,
  onSyncEmails,
  isSyncing,
  notificationCount = 0,
  onLogout
}) => {
  // Mobile sidebar controller
  const { isOpen, onOpen, onClose } = useDisclosure();
  
  // Color variables
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const headerBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const sidebarBg = useColorModeValue('white', 'gray.800');
  
  // Responsive variables
  const isMobile = useBreakpointValue({ base: true, lg: false });
  
  // Sidebar items with icons
  const sidebarItems = [
    { name: 'Inbox', icon: EmailIcon, path: '/dashboard' },
    { name: 'Settings', icon: SettingsIcon, path: '/settings' },
    { name: 'Help & FAQ', icon: InfoIcon, path: '/help' },
  ];
  
  // Sidebar component (used for both drawer and permanent sidebar)
  const SidebarContent = () => (
    <VStack spacing={6} align="stretch" w="full" py={6}>
      <Box px={4}>
        <Heading size="md" color="brand.500">EmailBot</Heading>
      </Box>
      
      <VStack spacing={1} align="stretch">
        {sidebarItems.map((item) => (
          <Button
            key={item.name}
            leftIcon={<Icon as={item.icon} />}
            justifyContent="flex-start"
            variant="ghost"
            size="lg"
            borderRadius="xl"
            px={4}
            m={2}
            _hover={{ bg: 'brand.50', color: 'brand.500' }}
          >
            {item.name}
          </Button>
        ))}
      </VStack>
      
      <Divider />
      
      <VStack px={4} spacing={4} mt={2}>
        <Button
          leftIcon={<RepeatIcon />}
          colorScheme="brand"
          variant="outline"
          w="full"
          onClick={onSyncEmails}
          isLoading={isSyncing}
          loadingText="Syncing..."
        >
          Sync Emails
        </Button>
      </VStack>
    </VStack>
  );
  
  return (
    <Box bg={bgColor} minH="100vh">
      {/* Header */}
      <Flex
        as="header"
        bg={headerBg}
        boxShadow="sm"
        p={4}
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
        position="sticky"
        top={0}
        zIndex={10}
      >
        {/* Left side with menu and title */}
        <HStack spacing={4}>
          {isMobile && (
            <IconButton
              icon={<HamburgerIcon />}
              variant="ghost"
              aria-label="Open menu"
              onClick={onOpen}
            />
          )}
          <MotionBox
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Heading size="md" display={{ base: 'none', md: 'block' }}>Email Dashboard</Heading>
          </MotionBox>
        </HStack>
        
        {/* Right side with actions */}
        <HStack spacing={2}>
          <IconButton
            aria-label="Search"
            icon={<SearchIcon />}
            variant="ghost"
            borderRadius="full"
          />
          
          <Box position="relative">
            <IconButton
              aria-label="Notifications"
              icon={<BellIcon />}
              variant="ghost"
              borderRadius="full"
            />
            {notificationCount > 0 && (
              <Box
                position="absolute"
                top={0}
                right={0}
                bg="red.500"
                borderRadius="full"
                w={4}
                h={4}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Text fontSize="xs" fontWeight="bold" color="white">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </Box>
            )}
          </Box>
          
          <Menu>
            <MenuButton
              as={Button}
              variant="ghost"
              rightIcon={<ChevronDownIcon />}
              borderRadius="full"
            >
              <HStack>
                <Avatar
                  size="sm"
                  src={user?.picture}
                  name={user?.full_name || user?.email || 'User'}
                />
                <Text display={{ base: 'none', md: 'block' }}>
                  {user?.full_name || user?.email || 'User'}
                </Text>
              </HStack>
            </MenuButton>
            <MenuList>
              <MenuItem icon={<SettingsIcon />}>Account Settings</MenuItem>
              <MenuItem 
                onClick={onLogout}
                icon={<Icon boxSize={4} viewBox="0 0 24 24">
                  <path fill="currentColor" d="M16 17v-3H9v-4h7V7l5 5-5 5M14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9z" />
                </Icon>}
              >
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Flex>
      
      {/* Main layout */}
      <Flex>
        {/* Sidebar for desktop */}
        {!isMobile && (
          <Box
            as="aside"
            w="250px"
            bg={sidebarBg}
            borderRightWidth="1px"
            borderRightColor={borderColor}
            height="calc(100vh - 73px)"
            position="sticky"
            top="73px"
            overflowY="auto"
          >
            <SidebarContent />
          </Box>
        )}
        
        {/* Mobile sidebar drawer */}
        <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton />
            <DrawerHeader>Menu</DrawerHeader>
            <DrawerBody p={0}>
              <SidebarContent />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        
        {/* Main content */}
        <Box flex="1" p={[4, 6, 8]} maxW="100%" overflowX="hidden">
          <Container maxW="8xl" px={0}>
            {children}
          </Container>
        </Box>
      </Flex>
    </Box>
  );
};

export default DashboardLayout;

// Import the RepeatIcon which was missed in the imports
const RepeatIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor" />
  </svg>
);
