import { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Badge,
  Icon,
  IconButton,
  Heading,
  useColorModeValue,
  useDisclosure
} from '@chakra-ui/react';
import { StarIcon, AttachmentIcon, CheckCircleIcon, ViewIcon } from '@chakra-ui/icons';
import { motion } from 'framer-motion';

// Define the email data interface
interface EmailCardProps {
  id: string;
  thread_id: string;
  subject: string;
  sender: {
    name: string;
    email: string;
  };
  preview: string;
  timestamp: string;
  isRead: boolean;
  hasAttachment: boolean;
  isStarred?: boolean;
  labels?: string[];
  category?: string;
  onClick: () => void;
}

const MotionBox = motion(Box);

export const EmailCard: React.FC<EmailCardProps> = ({
  subject,
  sender,
  preview,
  timestamp,
  isRead,
  hasAttachment,
  isStarred = false,
  labels = [],
  category,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // Dynamic background colors based on read status and hover state
  const bgColor = useColorModeValue(
    isRead ? 'white' : 'brand.50',
    isRead ? 'gray.800' : 'brand.900'
  );
  
  const hoverBgColor = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const textColor = useColorModeValue('gray.800', 'white');
  const mutedColor = useColorModeValue('gray.500', 'gray.400');
  
  // Format relative time (e.g., "2 hours ago", "Yesterday")
  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    
    if (diffHrs < 24) {
      return diffHrs < 1 
        ? 'Just now' 
        : `${Math.floor(diffHrs)} hour${Math.floor(diffHrs) === 1 ? '' : 's'} ago`;
    } else if (diffHrs < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  // Get category color
  const getCategoryColor = (category?: string) => {
    if (!category) return 'gray';
    
    const categoryColors: {[key: string]: string} = {
      'Job Posting': 'blue',
      'Candidate': 'green',
      'Event': 'purple',
      'Questions': 'orange',
      'Discussion Topics': 'teal',
      'Other': 'gray'
    };
    
    return categoryColors[category] || 'gray';
  };

  return (
    <MotionBox
      as="article"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      bg={isHovered ? hoverBgColor : bgColor}
      borderWidth="1px"
      borderColor={borderColor}
      borderRadius="lg"
      overflow="hidden"
      mb={3}
      cursor="pointer"
      transition="all 0.2s"
      position="relative"
      _hover={{
        transform: 'translateY(-2px)',
        boxShadow: 'md',
        borderColor: 'brand.200',
      }}
      role="group"
    >
      {/* Email card content */}
      <Flex p={4} align="center">
        {/* Left side - Read status */}
        <Box mr={4}>
          {!isRead && (
            <Box 
              w="8px" 
              h="8px" 
              borderRadius="full" 
              bg="brand.500" 
              position="absolute"
              left="10px"
              top="50%"
              transform="translateY(-50%)"
            />
          )}
        </Box>
        
        {/* Main content */}
        <Box flex="1" overflow="hidden">
          <Flex justify="space-between" align="center" mb={1}>
            <Text fontWeight={isRead ? "medium" : "bold"} noOfLines={1} fontSize="sm">
              {sender.name || sender.email}
            </Text>
            <Text fontSize="xs" color={mutedColor}>
              {formatRelativeTime(timestamp)}
            </Text>
          </Flex>
          
          <Heading 
            as="h3" 
            size="sm" 
            mb={1} 
            noOfLines={1}
            color={textColor}
            fontWeight={isRead ? "medium" : "semibold"}
          >
            {subject || "(No subject)"}
          </Heading>
          
          <Text 
            fontSize="sm" 
            color={mutedColor} 
            noOfLines={1}
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {preview}
          </Text>
          
          {/* Labels and indicators */}
          <Flex mt={2} flexWrap="wrap" gap={2}>
            {category && (
              <Badge 
                colorScheme={getCategoryColor(category)}
                fontSize="xs"
                borderRadius="full"
                px={2}
                py={0.5}
              >
                {category}
              </Badge>
            )}
            
            {labels.map((label, index) => (
              <Badge 
                key={index}
                colorScheme="gray"
                fontSize="xs"
                borderRadius="full"
                px={2}
                py={0.5}
              >
                {label}
              </Badge>
            ))}
            
            {hasAttachment && (
              <Icon as={AttachmentIcon} color={mutedColor} ml={1} />
            )}
            
            {isStarred && (
              <Icon as={StarIcon} color="warning.400" ml={1} />
            )}
          </Flex>
        </Box>
        
        {/* Right side actions (visible on hover) */}
        <Flex 
          opacity={isHovered ? 1 : 0} 
          transition="opacity 0.2s"
          align="center"
          gap={2}
        >
          <IconButton
            aria-label="Mark as read"
            icon={<CheckCircleIcon />}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              // Mark as read action
            }}
          />
          <IconButton
            aria-label="View email"
            icon={<ViewIcon />}
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          />
        </Flex>
      </Flex>
    </MotionBox>
  );
};

export default EmailCard;
