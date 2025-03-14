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
  Divider
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
import { motion } from 'framer-motion';
import { ThreadLabels } from '../../components/EmailLabels';

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

const EmailThreadViewer: React.FC<EmailThreadViewerProps> = ({
  thread,
  onBack,
  onRefresh,
  onReply
}) => {
  const [expandedMessages, setExpandedMessages] = useState<{[key: string]: boolean}>({});
  
  // Theme colors
  const messageBg = useColorModeValue('white', 'gray.800');
  const messageBorder = useColorModeValue('gray.200', 'gray.700');
  const headerBg = useColorModeValue('gray.50', 'gray.900');
  
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
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }
    return parts[0][0] || '?';
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
  
  return (
    <Box 
      borderWidth="1px"
      borderRadius="xl"
      borderColor={messageBorder}
      overflow="hidden"
      boxShadow="lg"
      bg={messageBg}
    >
      {/* Thread Header */}
      <Box 
        p={4}
        borderBottomWidth="1px"
        borderBottomColor={messageBorder}
        bg={headerBg}
      >
        <Flex justify="space-between" align="center" mb={3}>
          <Button 
            leftIcon={<ArrowBackIcon />} 
            variant="ghost" 
            size="sm"
            onClick={onBack}
          >
            Back
          </Button>
          
          <HStack spacing={2}>
            <Tooltip label="Refresh thread">
              <IconButton
                aria-label="Refresh thread"
                icon={<RepeatIcon />}
                size="sm"
                variant="ghost"
                onClick={onRefresh}
              />
            </Tooltip>
            <Tooltip label="Reply">
              <IconButton
                aria-label="Reply"
                icon={<EmailIcon />}
                size="sm"
                variant="ghost"
                onClick={onReply}
              />
            </Tooltip>
          </HStack>
        </Flex>
        
        <Heading as="h2" size="lg" mb={2}>
          {thread.subject || "(No subject)"}
        </Heading>
        
        <Flex align="center" wrap="wrap" gap={2} mb={2}>
          <Badge colorScheme="blue" px={2} py={1} borderRadius="full">
            {thread.message_count} {thread.message_count === 1 ? 'message' : 'messages'}
          </Badge>
          
          <Badge colorScheme="gray" px={2} py={1} borderRadius="full">
            {thread.participants.length} participants
          </Badge>
          
          <Text fontSize="sm" color="gray.500">
            Last updated: {formatDate(thread.last_updated)}
          </Text>
        </Flex>
        
        {/* Display thread labels if any */}
        <Box mt={2}>
          <ThreadLabels threadId={thread.thread_id} onLabelRemoved={() => onRefresh()} />
        </Box>
      </Box>
      
      {/* Thread Messages */}
      <VStack spacing={0} align="stretch" p={0}>
        {thread.messages.map((message, index) => {
          const isExpanded = expandedMessages[message.id] ?? false;
          const senderName = extractName(message.sender);
          const isLast = index === thread.messages.length - 1;
          
          return (
            <MotionBox
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              borderBottomWidth={isLast ? "0px" : "1px"}
              borderBottomColor={messageBorder}
              className="thread-message"
            >
              {/* Message header */}
              <Flex 
                p={4} 
                onClick={() => toggleMessage(message.id)}
                cursor="pointer"
                align="center"
                _hover={{ bg: useColorModeValue('gray.50', 'gray.700') }}
              >
                <Avatar 
                  name={senderName} 
                  size="sm" 
                  mr={4}
                  bg="brand.500"
                  color="white"
                />
                
                <Box flex="1">
                  <Flex justify="space-between" align="baseline">
                    <HStack>
                      <Text fontWeight="bold">{senderName}</Text>
                      <Text fontSize="sm" color="gray.500">
                        {formatDate(message.date)}
                      </Text>
                    </HStack>
                    <IconButton
                      aria-label={isExpanded ? "Collapse" : "Expand"}
                      icon={isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMessage(message.id);
                      }}
                    />
                  </Flex>
                  
                  <Text color="gray.600" noOfLines={isExpanded ? undefined : 1}>
                    {message.snippet}
                  </Text>
                </Box>
              </Flex>
              
              {/* Message body */}
              <Collapse in={isExpanded} animateOpacity>
                <Box 
                  p={6} 
                  pt={0} 
                  ml={12} 
                  className="email-body"
                  borderTop="1px dashed"
                  borderTopColor={messageBorder}
                  bg={useColorModeValue('gray.50', 'gray.700')}
                >
                  {message.has_attachment && (
                    <Flex 
                      p={3} 
                      bg={useColorModeValue('blue.50', 'blue.900')} 
                      borderRadius="md"
                      align="center"
                      mb={4}
                    >
                      <Icon as={AttachmentIcon} mr={2} color="blue.500" />
                      <Text fontSize="sm">This message has attachments.</Text>
                      <Button 
                        ml="auto" 
                        size="xs" 
                        leftIcon={<DownloadIcon />}
                        colorScheme="blue"
                        variant="ghost"
                      >
                        View attachments
                      </Button>
                    </Flex>
                  )}
                  
                  <Box 
                    dangerouslySetInnerHTML={{
                      __html: message.body || `<p>${message.snippet}</p>`
                    }}
                  />
                  
                  <Flex justify="flex-end" mt={4} gap={2}>
                    <Button
                      size="sm"
                      leftIcon={<EmailIcon />}
                      colorScheme="brand"
                      variant="outline"
                    >
                      Reply
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="brand"
                      variant="ghost"
                    >
                      Forward
                    </Button>
                  </Flex>
                </Box>
              </Collapse>
            </MotionBox>
          );
        })}
      </VStack>
      
      {/* Quick reply at the bottom */}
      <Box 
        p={4} 
        borderTopWidth="1px" 
        borderTopColor={messageBorder}
        bg={useColorModeValue('gray.50', 'gray.700')}
      >
        <Button
          leftIcon={<EmailIcon />}
          colorScheme="brand"
          width="full"
          onClick={onReply}
        >
          Reply to this thread
        </Button>
      </Box>
    </Box>
  );
};

export default EmailThreadViewer;
