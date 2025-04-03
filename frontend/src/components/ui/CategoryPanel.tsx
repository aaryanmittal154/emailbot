import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  Skeleton,
  VStack,
  useColorModeValue,
  Icon,
  LinkBox,
  LinkOverlay,
  HStack,
} from "@chakra-ui/react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRightIcon, TimeIcon, RepeatIcon } from "@chakra-ui/icons";
import { EmailCard } from "./EmailCard";
import {
  staggerContainer,
  listItem,
  fadeIn,
  fadeInUp,
  scaleIn,
  buttonHover,
  buttonTap,
  transitions,
} from "../../lib/animations";

interface Email {
  id: string;
  thread_id: string;
  subject: string;
  sender:
    | {
        name: string;
        email: string;
      }
    | string;
  recipients: string[];
  snippet?: string;
  preview?: string;
  date?: string;
  timestamp?: string;
  labels: string[];
  has_attachment?: boolean;
  is_read?: boolean;
  hasAttachment?: boolean;
  isRead?: boolean;
  internal_date?: number;
}

interface CategoryPanelProps {
  title: string;
  category: string;
  emails: Email[];
  isLoading: boolean;
  onRefresh: () => void;
  onEmailSelect: (email: Email) => void;
  emptyMessage?: string;
  badgeCount?: number;
  animation?: "fadeIn" | "slideUp" | "scale" | "none";
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionButton = motion(Button);
const MotionVStack = motion(VStack);

const CategoryPanel: React.FC<CategoryPanelProps> = ({
  title,
  category,
  emails,
  isLoading,
  onRefresh,
  onEmailSelect,
  emptyMessage = "No emails in this category",
  badgeCount,
  animation = "fadeIn",
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Updated color variables with new space color palette
  const bgColor = useColorModeValue("white", "space.800");
  const borderColor = useColorModeValue("space.100", "space.700");
  const headerBgColor = useColorModeValue("space.50", "space.900");
  const emptyStateBg = useColorModeValue("space.50", "space.800");

  // Add debugging for emails array
  useEffect(() => {
    if (!emails || !Array.isArray(emails)) {
      console.error(`[${category}] Invalid emails array:`, emails);
    } else if (emails.length === 0) {
      console.log(`[${category}] Empty emails array, showing empty state`);
    } else {
      console.log(`[${category}] Rendering ${emails.length} emails`);
    }
  }, [emails, category]);

  // Get animation variants based on animation type
  const getAnimationVariants = () => {
    switch (animation) {
      case "fadeIn":
        return fadeIn;
      case "slideUp":
        return fadeInUp;
      case "scale":
        return scaleIn;
      default:
        return {};
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const categoryColors: { [key: string]: string } = {
      "Job Posting": "blue",
      Candidate: "green",
      Event: "purple",
      Questions: "orange",
      "Discussion Topics": "teal",
      Other: "gray",
      "All Emails": "brand",
      Irrelevant: "gray",
    };

    return categoryColors[category] || "gray";
  };

  const colorScheme = getCategoryColor(category);

  // Animation variants
  const containerVariants = getAnimationVariants();

  // Custom hover styles for the panel
  const panelHoverStyle = {
    y: -4,
    boxShadow: "xl",
    borderColor: `${colorScheme}.200`,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
    },
  };

  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={containerVariants}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      bg={bgColor}
      boxShadow={isHovered ? "xl" : "lg"}
      overflow="hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      height="100%"
      display="flex"
      flexDirection="column"
      position="relative"
      whileHover={panelHoverStyle}
    >
      {/* Header */}
      <Flex
        p={5}
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
        bg={headerBgColor}
        position="relative"
      >
        <Flex align="center">
          <Heading size="md" fontWeight="400" letterSpacing="0.01em">
            {title}
          </Heading>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge
              ml={2}
              colorScheme={colorScheme}
              borderRadius="full"
              px={2}
              py={1}
              fontWeight="500"
            >
              {badgeCount}
            </Badge>
          )}
        </Flex>

        <MotionButton
          rightIcon={<RepeatIcon />}
          size="sm"
          variant="ghost"
          onClick={onRefresh}
          borderRadius="full"
          fontWeight="400"
          color="space.600"
          _hover={{ bg: "space.50", color: "brand.500" }}
          whileHover={buttonHover}
          whileTap={buttonTap}
        >
          Refresh
        </MotionButton>
      </Flex>

      {/* Content */}
      <Box flex="1" overflowY="auto" px={3} py={3}>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <MotionVStack
              spacing={3}
              align="stretch"
              py={2}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {[...Array(3)].map((_, i) => (
                <MotionBox
                  key={`skeleton-${i}`}
                  variants={listItem}
                  mb={3}
                  px={2}
                >
                  <Skeleton height="80px" width="100%" borderRadius="lg" />
                </MotionBox>
              ))}
            </MotionVStack>
          ) : emails && emails.length > 0 ? (
            <MotionVStack
              spacing={3}
              align="stretch"
              py={2}
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {emails.map((email) => (
                <MotionBox
                  key={email.id || email.thread_id}
                  variants={listItem}
                >
                  <EmailCard
                    email={email}
                    onClick={() => onEmailSelect(email)}
                    colorScheme={colorScheme}
                  />
                </MotionBox>
              ))}
            </MotionVStack>
          ) : (
            <MotionFlex
              direction="column"
              align="center"
              justify="center"
              p={6}
              my={4}
              h="200px"
              bg={emptyStateBg}
              borderRadius="xl"
              textAlign="center"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
            >
              <Icon
                as={TimeIcon}
                boxSize={8}
                color={`${colorScheme}.300`}
                mb={4}
              />
              <Text color="space.500" fontWeight="400">
                {emptyMessage}
              </Text>
              <MotionButton
                mt={4}
                size="sm"
                variant="outline"
                colorScheme={colorScheme}
                onClick={onRefresh}
                borderRadius="full"
                fontWeight="400"
                leftIcon={<RepeatIcon />}
                whileHover={buttonHover}
                whileTap={buttonTap}
              >
                Refresh
              </MotionButton>
            </MotionFlex>
          )}
        </AnimatePresence>
      </Box>

      {/* Footer */}
      {!isLoading && emails && emails.length > 0 && (
        <Box
          p={4}
          borderTopWidth="1px"
          borderTopColor={borderColor}
          textAlign="center"
        >
          <MotionButton
            rightIcon={<ChevronRightIcon />}
            variant="ghost"
            size="sm"
            width="full"
            onClick={() => {}}
            borderRadius="full"
            fontWeight="400"
            color="space.600"
            _hover={{ bg: "space.50", color: "brand.500" }}
            whileHover={buttonHover}
            whileTap={buttonTap}
          >
            View All
          </MotionButton>
        </Box>
      )}
    </MotionBox>
  );
};

export default CategoryPanel;
