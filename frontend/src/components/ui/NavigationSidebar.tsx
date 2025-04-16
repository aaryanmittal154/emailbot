import React from "react";
import {
  Box,
  VStack,
  Heading,
  Flex,
  Icon,
  Text,
  Badge,
  useColorModeValue,
  Collapse,
  Divider,
  IconButton,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import {
  FiBriefcase,
  FiUser,
  FiMail,
  FiHelpCircle,
  FiClock,
  FiCommand,
  FiFolder,
  FiFilter,
  FiCalendar,
} from "react-icons/fi";

// Define props
interface NavigationSidebarProps {
  activeTab: number;
  onTabChange: (index: number) => void;
  counts?: { [key: string]: number };
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionHeading = motion(Heading);

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  activeTab,
  onTabChange,
  counts = {},
}) => {
  // State for collapsible sections
  const [recruitmentOpen, setRecruitmentOpen] = React.useState(true);
  const [communicationsOpen, setCommunicationsOpen] = React.useState(true);
  const [managementOpen, setManagementOpen] = React.useState(true);

  // Color variables
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const hoverBgColor = useColorModeValue("gray.50", "gray.700");
  const textColor = useColorModeValue("gray.700", "gray.200");
  const shadowColor = useColorModeValue("rgba(0,0,0,0.05)", "rgba(0,0,0,0.2)");

  // Category styles
  const recruitmentGradient = "linear(to-r, blue.400, blue.500)";
  const communicationsGradient = "linear(to-r, teal.400, cyan.400)";
  const managementGradient = "linear(to-r, purple.400, pink.400)";

  // Navigation items grouped by category
  const navigationItems = [
    {
      category: "Recruitment Hub",
      gradient: recruitmentGradient,
      isOpen: recruitmentOpen,
      setIsOpen: setRecruitmentOpen,
      items: [
        { name: "Job Postings", icon: FiBriefcase, tabIndex: 1 },
        { name: "Candidates", icon: FiUser, tabIndex: 2 },
      ],
    },
    {
      category: "Communications",
      gradient: communicationsGradient,
      isOpen: communicationsOpen,
      setIsOpen: setCommunicationsOpen,
      items: [
        { name: "Prompts", icon: FiCommand, tabIndex: 9 },
        { name: "Inbox", icon: FiMail, tabIndex: 0 },
        { name: "Questions", icon: FiHelpCircle, tabIndex: 3 },
        { name: "Discussion Topics", icon: FiClock, tabIndex: 4 },
      ],
    },
    {
      category: "Management",
      gradient: managementGradient,
      isOpen: managementOpen,
      setIsOpen: setManagementOpen,
      items: [
        { name: "Events", icon: FiCalendar, tabIndex: 5 },
        { name: "Resources", icon: FiFolder, tabIndex: 6 },
        { name: "Other", icon: FiFolder, tabIndex: 7 },
        { name: "Irrelevant", icon: FiFilter, tabIndex: 8 },
      ],
    },
  ];

  // Render a single navigation item
  const renderNavItem = (
    name: string,
    icon: any,
    tabIndex: number,
    count: number = 0
  ) => {
    const isActive = activeTab === tabIndex;
    return (
      <MotionBox
        key={name}
        onClick={() => onTabChange(tabIndex)}
        cursor="pointer"
        borderRadius="lg"
        p={3}
        mb={2}
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
        bg={isActive ? useColorModeValue("white", "gray.700") : "transparent"}
        borderLeftWidth={isActive ? "3px" : "0px"}
        borderLeftColor={isActive ? "blue.400" : "transparent"}
        boxShadow={isActive ? `0 2px 8px ${shadowColor}` : "none"}
        pl={isActive ? 3 : 3}
        _hover={{ bg: hoverBgColor }}
        position="relative"
      >
        <Flex align="center" justify="space-between">
          <Flex align="center">
            <Icon
              as={icon}
              boxSize={5}
              color={isActive ? "blue.400" : textColor}
              mr={3}
              opacity={isActive ? 1 : 0.8}
            />
            <Text
              fontWeight={isActive ? "600" : "400"}
              fontSize="sm"
              letterSpacing="0.2px"
              color={isActive ? "blue.500" : textColor}
            >
              {name}
            </Text>
          </Flex>
          {count > 0 && (
            <Badge
              colorScheme={isActive ? "blue" : "gray"}
              borderRadius="full"
              fontSize="xs"
              px={2}
              py={0.5}
              fontWeight="500"
              variant={isActive ? "solid" : "subtle"}
            >
              {count}
            </Badge>
          )}
        </Flex>
      </MotionBox>
    );
  };

  // Render a category header
  const renderCategoryHeader = (
    category: string,
    gradient: string,
    isOpen: boolean,
    setIsOpen: (value: boolean) => void
  ) => {
    return (
      <MotionFlex
        justify="space-between"
        align="center"
        mb={3}
        cursor="pointer"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ x: 2 }}
        transition={{ duration: 0.2 }}
        px={1}
      >
        <MotionHeading
          size="xs"
          bgGradient={gradient}
          bgClip="text"
          fontWeight="700"
          letterSpacing="1px"
          textTransform="uppercase"
          opacity={0.9}
          whileHover={{ opacity: 1 }}
        >
          {category}
        </MotionHeading>
        <IconButton
          icon={isOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          variant="ghost"
          size="sm"
          borderRadius="full"
          aria-label={isOpen ? "Collapse section" : "Expand section"}
          _hover={{ bg: "transparent", transform: "scale(1.1)" }}
          opacity={0.7}
        />
      </MotionFlex>
    );
  };

  return (
    <Box
      w="250px"
      h="100%"
      bg={bgColor}
      p={5}
      borderRightWidth="1px"
      borderRightColor={borderColor}
      overflowY="auto"
      boxShadow={`inset -1px 0 0 ${borderColor}`}
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
      <VStack align="stretch" spacing={6}>
        {navigationItems.map((category) => (
          <Box key={category.category}>
            {renderCategoryHeader(
              category.category,
              category.gradient,
              category.isOpen,
              category.setIsOpen
            )}
            <Collapse in={category.isOpen} animateOpacity>
              <VStack align="stretch" mt={1} spacing={1}>
                {category.items.map((item) =>
                  renderNavItem(
                    item.name,
                    item.icon,
                    item.tabIndex,
                    counts[item.name.toLowerCase()] || 0
                  )
                )}
              </VStack>
            </Collapse>
            <Divider mt={3} opacity={0.3} />
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default NavigationSidebar;
