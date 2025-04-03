import React from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  Icon,
  Badge,
  Avatar,
  useColorModeValue,
} from "@chakra-ui/react";
import { AttachmentIcon, StarIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { hoverElevate, tapScale, transitions } from "../../lib/animations";

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

interface EmailCardProps {
  email: Email;
  onClick: () => void;
  colorScheme: string;
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionText = motion(Text);
const MotionHStack = motion(HStack);

export const EmailCard: React.FC<EmailCardProps> = ({
  email,
  onClick,
  colorScheme = "brand",
}) => {
  // Colors for light/dark modes using our space colors
  const bgColor = useColorModeValue("white", "space.800");
  const hoverBgColor = useColorModeValue("space.50", "space.700");
  const textColor = useColorModeValue("space.900", "white");
  const subTextColor = useColorModeValue("space.600", "space.300");
  const borderColor = useColorModeValue("space.100", "space.700");
  const unreadIndicatorColor = `${colorScheme}.500`;

  // Handle both modern and classic email formats
  const senderObject =
    typeof email.sender === "object"
      ? email.sender
      : {
          name:
            typeof email.sender === "string" && email.sender.includes("<")
              ? email.sender.split("<")[0].trim()
              : typeof email.sender === "string"
              ? email.sender.split("@")[0]
              : "Unknown",
          email:
            typeof email.sender === "string" && email.sender.includes("<")
              ? email.sender.match(/<([^>]+)>/)?.[1] || email.sender
              : typeof email.sender === "string"
              ? email.sender
              : "unknown@example.com",
        };

  // Format date for better readability
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (isNaN(date.getTime())) return dateString;

    if (diffDays === 0) {
      // Today, show time
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (diffDays === 1) {
      // Yesterday
      return "Yesterday";
    } else if (diffDays < 7) {
      // This week, show day name
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      // Older, show date
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Determine if email is read
  const isRead = email.is_read ?? email.isRead ?? false;
  const hasAttachment = email.has_attachment ?? email.hasAttachment ?? false;

  // Custom animations for this component
  const customHoverStyle = {
    y: -4,
    boxShadow:
      "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    backgroundColor: hoverBgColor,
    borderColor: isRead ? borderColor : `${colorScheme}.200`,
  };

  return (
    <MotionBox
      as="button"
      width="100%"
      onClick={onClick}
      borderRadius="lg"
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      p={3}
      boxShadow="sm"
      whileHover={customHoverStyle}
      whileTap={tapScale}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 17,
        duration: 0.2,
      }}
      textAlign="left"
      position="relative"
      overflow="hidden"
      _after={
        !isRead
          ? {
              content: '""',
              position: "absolute",
              top: 0,
              right: 0,
              borderStyle: "solid",
              borderWidth: "0 16px 16px 0",
              borderColor: `transparent ${unreadIndicatorColor} transparent transparent`,
            }
          : undefined
      }
    >
      {/* Unread indicator */}
      <MotionBox
        position="absolute"
        left={0}
        top={0}
        bottom={0}
        width="3px"
        bg={unreadIndicatorColor}
        borderLeftRadius="md"
        initial={{ height: "0%", opacity: 0 }}
        animate={{
          height: !isRead ? "100%" : "0%",
          opacity: !isRead ? 1 : 0,
        }}
        transition={{ duration: 0.3 }}
      />

      <MotionFlex
        direction="column"
        animate={{ x: !isRead ? 3 : 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header with sender and date */}
        <Flex justify="space-between" align="center" mb={2}>
          <HStack spacing={2}>
            <MotionBox
              whileHover={{ scale: 1.1 }}
              transition={transitions.fastSpring}
            >
              <Avatar
                size="xs"
                name={senderObject.name}
                bgColor={`${colorScheme}.100`}
                color={`${colorScheme}.700`}
                fontSize="xs"
              />
            </MotionBox>
            <MotionText
              fontWeight={isRead ? "400" : "600"}
              fontSize="sm"
              color={textColor}
              noOfLines={1}
              whileHover={{ color: `${colorScheme}.600` }}
              transition={transitions.subtle}
            >
              {senderObject.name}
            </MotionText>
          </HStack>
          <Text fontSize="xs" color={subTextColor}>
            {formatDate(email.date || email.timestamp)}
          </Text>
        </Flex>

        {/* Subject line */}
        <MotionText
          fontSize="sm"
          fontWeight={isRead ? "400" : "600"}
          mb={1}
          color={textColor}
          noOfLines={1}
          whileHover={{
            color: `${colorScheme}.600`,
            x: 2,
          }}
          transition={transitions.subtle}
        >
          {email.subject || "(No subject)"}
        </MotionText>

        {/* Preview text */}
        <Text
          fontSize="xs"
          color={subTextColor}
          noOfLines={1}
          mb={2}
          opacity={isRead ? 0.8 : 1}
        >
          {email.snippet || email.preview || ""}
        </Text>

        {/* Footer with labels and icons */}
        <Flex justify="space-between" align="center">
          <MotionHStack
            spacing={1}
            whileHover={{ x: 2 }}
            transition={transitions.subtle}
          >
            {email.labels && email.labels.length > 0 && (
              <HStack spacing={1}>
                {email.labels.slice(0, 2).map((label) => (
                  <Badge
                    key={label}
                    colorScheme={colorScheme}
                    variant="subtle"
                    fontSize="2xs"
                    py={0.5}
                    px={1.5}
                    borderRadius="full"
                  >
                    {label}
                  </Badge>
                ))}
                {email.labels.length > 2 && (
                  <Badge
                    colorScheme="gray"
                    variant="subtle"
                    fontSize="2xs"
                    py={0.5}
                    px={1.5}
                    borderRadius="full"
                  >
                    +{email.labels.length - 2}
                  </Badge>
                )}
              </HStack>
            )}
          </MotionHStack>
          <HStack spacing={2}>
            {hasAttachment && (
              <MotionBox
                whileHover={{ rotate: 15, scale: 1.2 }}
                transition={transitions.fastSpring}
              >
                <Icon as={AttachmentIcon} boxSize={3} color={subTextColor} />
              </MotionBox>
            )}
          </HStack>
        </Flex>
      </MotionFlex>
    </MotionBox>
  );
};
