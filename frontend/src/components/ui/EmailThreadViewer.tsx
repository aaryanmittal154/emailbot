import React, { useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  Badge,
  Avatar,
  Button,
  Icon,
  IconButton,
  useColorModeValue,
  VStack,
  HStack,
  Collapse,
  Tooltip,
  Divider,
  Spacer
} from '@chakra-ui/react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowBackIcon,
  StarIcon,
  RepeatIcon,
  DownloadIcon,
  EmailIcon,
  AttachmentIcon
} from '@chakra-ui/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { ThreadLabels } from '../../components/EmailLabels';
import {
  staggerContainer,
  listItem,
  fadeIn,
  fadeInUp,
  buttonHover,
  buttonTap,
  transitions,
  slideInLeft,
  slideInRight
} from '../../lib/animations';

interface EmailData {
  id: string;
  gmail_id: string;
  thread_id: string;
  sender: string;
  recipients: string[];
  subject: string;
  snippet: string;
  date: string;
  labels: string[];
  has_attachment: boolean;
  is_read: boolean;
  body?: string;
  internal_date?: number;
}

interface ThreadData {
  thread_id: string;
  messages: EmailData[];
  subject: string;
  participants: string[];
  message_count: number;
  last_updated: string;
}

interface EmailThreadViewerProps {
  thread: ThreadData;
  onBack: () => void;
  onRefresh: () => void;
  onReply?: () => void;
}

const MotionBox = motion(Box);
const MotionFlex = motion(Flex);
const MotionVStack = motion(VStack);
const MotionButton = motion(Button);
const MotionIconButton = motion(IconButton);
const MotionText = motion(Text);

const EmailThreadViewer: React.FC<EmailThreadViewerProps> = ({
  thread,
  onBack,
  onRefresh,
  onReply
}) => {
  const [expandedMessages, setExpandedMessages] = useState<{[key: string]: boolean}>({});

  // Theme colors with new space palette
  const messageBg = useColorModeValue('white', 'space.800');
  const messageBorder = useColorModeValue('space.100', 'space.700');
  const headerBg = useColorModeValue('space.50', 'space.900');
  const threadLineBg = useColorModeValue('space.200', 'space.600');
  const textColor = useColorModeValue('space.800', 'white');
  const metaTextColor = useColorModeValue('space.500', 'space.300');

  // Toggle message expansion
  const toggleMessage = (id: string) => {
    setExpandedMessages(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Format date for better readability
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;

    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  // Generate initial for avatar
  const getInitials = (name: string) => {
    const parts = name.split(/[ <>@]/);
    const filteredParts = parts.filter(part => part.length > 0);

    if (filteredParts.length >= 2) {
      return `${filteredParts[0][0]}${filteredParts[1][0]}`.toUpperCase();
    }
    return filteredParts[0]?.[0]?.toUpperCase() || '?';
  };

  // Extract name from email address
  const extractName = (sender: string) => {
    // If format is "Name <email@example.com>"
    const nameMatch = sender.match(/^([^<]+)/);
    if (nameMatch && nameMatch[1].trim()) {
      return nameMatch[1].trim();
    }

    // If it's just an email address
    const emailMatch = sender.match(/<([^>]+)>/) || [null, sender];
    const email = emailMatch[1];
    return email.split('@')[0] || 'Unknown';
  };

  // Get sender email for avatar color
  const getSenderEmail = (sender: string) => {
    const emailMatch = sender.match(/<([^>]+)>/) || [null, sender];
    return emailMatch[1] || sender;
  };

  // Get avatar color based on sender email
  const getAvatarColor = (email: string) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'teal', 'pink', 'cyan'];
    let hash = 0;

    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  return (
    <MotionBox
      borderWidth="1px"
      borderRadius="xl"
      borderColor={messageBorder}
      overflow="hidden"
      boxShadow="lg"
      bg={messageBg}
      height="100%"
      display="flex"
      flexDirection="column"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Thread Header */}
      <MotionBox
        p={5}
        borderBottomWidth="1px"
        borderBottomColor={messageBorder}
        bg={headerBg}
        variants={fadeInUp}
      >
        <Flex justify="space-between" align="center" mb={4}>
          <MotionButton
            leftIcon={<ArrowBackIcon />}
            variant="ghost"
            size="sm"
            onClick={onBack}
            borderRadius="full"
            fontWeight="400"
            whileHover={buttonHover}
            whileTap={buttonTap}
            variants={slideInLeft}
          >
            Back
          </MotionButton>

          <HStack spacing={2}>
            <Tooltip label="Refresh thread">
              <MotionIconButton
                aria-label="Refresh thread"
                icon={<RepeatIcon />}
                size="sm"
                variant="ghost"
                onClick={onRefresh}
                borderRadius="full"
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.5 }}
              />
            </Tooltip>
            <Tooltip label="Reply">
              <MotionIconButton
                aria-label="Reply"
                icon={<EmailIcon />}
                size="sm"
                variant="ghost"
                onClick={onReply}
                borderRadius="full"
                colorScheme="brand"
                whileHover={buttonHover}
                whileTap={buttonTap}
              />
            </Tooltip>
          </HStack>
        </Flex>

        <MotionText
          as="h2"
          fontSize="xl"
          mb={3}
          fontWeight="400"
          letterSpacing="0.01em"
          variants={fadeInUp}
        >
          {thread.subject || "(No subject)"}
        </MotionText>

        <Flex align="center" wrap="wrap" gap={2} mb={3}>
          <Badge colorScheme="brand" px={2} py={1} borderRadius="full" fontWeight="500">
            {thread.message_count} {thread.message_count === 1 ? 'message' : 'messages'}
          </Badge>

          <Badge colorScheme="gray" px={2} py={1} borderRadius="full" fontWeight="500">
            {thread.participants.length} participants
          </Badge>

          <Text fontSize="sm" color={metaTextColor} fontWeight="400">
            Last updated: {formatDate(thread.last_updated)}
          </Text>
        </Flex>

        {/* Display thread labels if any */}
        <Box mt={2}>
          <ThreadLabels threadId={thread.thread_id} onLabelRemoved={() => onRefresh()} />
        </Box>
      </MotionBox>

      {/* Thread Messages with Timeline Visualization */}
      <Box flex="1" overflowY="auto" p={5} position="relative">
        {/* Timeline connector */}
        <MotionBox
          position="absolute"
          left="40px"
          top="0"
          bottom="0"
          width="2px"
          bg={threadLineBg}
          zIndex={0}
          initial={{ height: "0%" }}
          animate={{ height: "100%" }}
          transition={{ duration: 0.8, delay: 0.3 }}
        />

        <MotionVStack
          spacing={6}
          align="stretch"
          position="relative"
          zIndex={1}
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <AnimatePresence>
            {thread.messages.map((message, index) => {
              const isExpanded = expandedMessages[message.id] ?? index === thread.messages.length - 1;
              const senderName = extractName(message.sender);
              const senderEmail = getSenderEmail(message.sender);
              const avatarColor = getAvatarColor(senderEmail);

              return (
                <MotionBox
                  key={message.id}
                  variants={listItem}
                  custom={index}
                  position="relative"
                  bg={messageBg}
                  borderRadius="xl"
                  boxShadow="sm"
                  borderWidth="1px"
                  borderColor={messageBorder}
                  whileHover={{
                    boxShadow: "md",
                    y: -2,
                    transition: transitions.spring
                  }}
                  className="thread-message"
                >
                  {/* Message header */}
                  <Flex p={4} align="center" onClick={() => toggleMessage(message.id)} cursor="pointer">
                    {/* Avatar with timeline dot */}
                    <Box position="relative" mr={4}>
                      <MotionBox
                        whileHover={{ scale: 1.1 }}
                        transition={transitions.fastSpring}
                      >
                        <Avatar
                          size="sm"
                          name={senderName}
                          bgColor={`${avatarColor}.100`}
                          color={`${avatarColor}.700`}
                        />
                      </MotionBox>

                      <MotionBox
                        position="absolute"
                        left="-22px"
                        top="50%"
                        transform="translateY(-50%)"
                        width="10px"
                        height="10px"
                        borderRadius="full"
                        bg={`${avatarColor}.500`}
                        borderWidth="2px"
                        borderColor={messageBg}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: index * 0.15 + 0.5,
                          type: "spring",
                          stiffness: 500,
                          damping: 15
                        }}
                      />
                    </Box>

                    <Flex flex="1" direction="column">
                      <Flex justify="space-between" align="center" width="100%">
                        <MotionText
                          fontWeight="500"
                          fontSize="sm"
                          color={textColor}
                          whileHover={{ color: `${avatarColor}.600` }}
                          transition={transitions.subtle}
                        >
                          {senderName}
                        </MotionText>
                        <HStack>
                          <Text fontSize="xs" color={metaTextColor}>
                            {formatDate(message.date)}
                          </Text>
                          <MotionIconButton
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                            icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                            size="xs"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMessage(message.id);
                            }}
                            whileHover={{ y: isExpanded ? -2 : 2 }}
                            transition={transitions.subtle}
                          />
                        </HStack>
                      </Flex>

                      {!isExpanded && (
                        <MotionText
                          fontSize="sm"
                          color={metaTextColor}
                          noOfLines={1}
                          mt={1}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          {message.snippet}
                        </MotionText>
                      )}
                    </Flex>
                  </Flex>

                  {/* Message body */}
                  <AnimatePresence>
                    {isExpanded && (
                      <MotionBox
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={transitions.spring}
                      >
                        <Divider borderColor={messageBorder} opacity={0.5} />
                        <Box p={4} className="email-body">
                          {message.body ? (
                            <Box
                              dangerouslySetInnerHTML={{ __html: message.body }}
                              fontSize="sm"
                              color={textColor}
                              lineHeight="tall"
                            />
                          ) : (
                            <Text fontSize="sm" color={metaTextColor} fontStyle="italic">
                              No content available
                            </Text>
                          )}
                        </Box>

                        {/* Message footer with actions */}
                        {message.has_attachment && (
                          <MotionFlex
                            p={4}
                            borderTopWidth="1px"
                            borderColor={messageBorder}
                            bg={useColorModeValue('space.50', 'space.700')}
                            borderBottomRadius="xl"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <HStack spacing={2}>
                              <MotionBox
                                whileHover={{ rotate: 15, scale: 1.2 }}
                                transition={transitions.fastSpring}
                              >
                                <Icon as={AttachmentIcon} color={metaTextColor} />
                              </MotionBox>
                              <Text fontSize="sm" color={metaTextColor}>
                                This message has attachments
                              </Text>
                            </HStack>
                            <Spacer />
                            <MotionButton
                              size="sm"
                              variant="ghost"
                              leftIcon={<DownloadIcon />}
                              borderRadius="full"
                              fontWeight="400"
                              whileHover={buttonHover}
                              whileTap={buttonTap}
                            >
                              View
                            </MotionButton>
                          </MotionFlex>
                        )}
                      </MotionBox>
                    )}
                  </AnimatePresence>
                </MotionBox>
              );
            })}
          </AnimatePresence>
        </MotionVStack>
      </Box>

      {/* Thread Actions Footer */}
      <MotionFlex
        p={4}
        borderTopWidth="1px"
        borderTopColor={messageBorder}
        justify="flex-end"
        bg={headerBg}
        variants={fadeInUp}
      >
        <MotionButton
          leftIcon={<EmailIcon />}
          colorScheme="brand"
          onClick={onReply}
          borderRadius="full"
          fontWeight="500"
          whileHover={{
            scale: 1.05,
            boxShadow: "0 0 15px var(--chakra-colors-brand-200)",
          }}
          whileTap={buttonTap}
        >
          Reply
        </MotionButton>
      </MotionFlex>
    </MotionBox>
  );
};

export default EmailThreadViewer;
