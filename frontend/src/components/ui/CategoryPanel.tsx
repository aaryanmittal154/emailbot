import React, { useEffect, useState } from 'react';
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
  LinkOverlay
} from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRightIcon, TimeIcon, RepeatIcon } from '@chakra-ui/icons';
import { EmailCard } from './EmailCard';

interface Email {
  id: string;
  thread_id: string;
  subject: string;
  sender: {
    name: string;
    email: string;
  } | string;
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

const CategoryPanel: React.FC<CategoryPanelProps> = ({
  title,
  category,
  emails,
  isLoading,
  onRefresh,
  onEmailSelect,
  emptyMessage = "No emails in this category",
  badgeCount,
  animation = "fadeIn"
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const bgColor = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBgColor = useColorModeValue('gray.50', 'gray.900');
  
  // Get animation variants based on animation type
  const getAnimationVariants = () => {
    switch(animation) {
      case "fadeIn":
        return {
          hidden: { opacity: 0 },
          visible: { 
            opacity: 1,
            transition: { 
              duration: 0.5,
              staggerChildren: 0.1
            }
          }
        };
      case "slideUp":
        return {
          hidden: { opacity: 0, y: 20 },
          visible: { 
            opacity: 1, 
            y: 0,
            transition: { 
              duration: 0.4,
              staggerChildren: 0.1
            }
          }
        };
      case "scale":
        return {
          hidden: { opacity: 0, scale: 0.8 },
          visible: { 
            opacity: 1, 
            scale: 1,
            transition: { 
              duration: 0.3,
              staggerChildren: 0.1
            }
          }
        };
      default:
        return {
          hidden: {},
          visible: {}
        };
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    const categoryColors: {[key: string]: string} = {
      'Job Posting': 'blue',
      'Candidate': 'green',
      'Event': 'purple',
      'Questions': 'orange',
      'Discussion Topics': 'teal',
      'Other': 'gray',
      'All Emails': 'brand'
    };
    
    return categoryColors[category] || 'gray';
  };

  const colorScheme = getCategoryColor(category);

  // Create variants for animations
  const containerVariants = getAnimationVariants();
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    }
  };
  
  return (
    <MotionBox
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="xl"
      bg={bgColor}
      boxShadow={isHovered ? "lg" : "md"}
      overflow="hidden"
      transition="all 0.3s ease"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      height="100%"
      display="flex"
      flexDirection="column"
    >
      {/* Header */}
      <Flex 
        p={4}
        align="center"
        justify="space-between"
        borderBottomWidth="1px"
        borderBottomColor={borderColor}
        bg={headerBgColor}
      >
        <Flex align="center">
          <Heading size="md" fontWeight="semibold">{title}</Heading>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Badge 
              ml={2} 
              colorScheme={colorScheme}
              borderRadius="full"
              px={2}
              py={0.5}
            >
              {badgeCount}
            </Badge>
          )}
        </Flex>
        <Button 
          size="sm"
          leftIcon={<RepeatIcon />}
          onClick={onRefresh}
          colorScheme={colorScheme}
          variant="ghost"
          _hover={{
            bg: `${colorScheme}.50`,
          }}
        >
          Refresh
        </Button>
      </Flex>
      
      {/* Content */}
      <Box 
        flex="1"
        p={4}
        overflowY="auto"
        css={{
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#cbd5e0',
            borderRadius: '24px',
          },
        }}
      >
        <AnimatePresence>
          {isLoading ? (
            <VStack spacing={4} align="stretch">
              {[...Array(3)].map((_, i) => (
                <MotionBox key={i} variants={itemVariants}>
                  <Skeleton height="110px" borderRadius="lg" />
                </MotionBox>
              ))}
            </VStack>
          ) : emails.length > 0 ? (
            <VStack spacing={4} align="stretch">
              {emails.map((email) => {
                // Handle both modern and classic email formats
                const senderObject = typeof email.sender === 'object' 
                  ? email.sender 
                  : {
                      name: typeof email.sender === 'string' && email.sender.includes('<') 
                        ? email.sender.split('<')[0].trim() 
                        : (typeof email.sender === 'string' ? email.sender.split('@')[0] : 'Unknown'),
                      email: typeof email.sender === 'string' && email.sender.includes('<') 
                        ? email.sender.match(/<([^>]+)>/)![1] 
                        : (typeof email.sender === 'string' ? email.sender : 'unknown@example.com')
                    };
                
                return (
                  <MotionBox key={email.id} variants={itemVariants}>
                    <EmailCard 
                      id={email.id}
                      thread_id={email.thread_id}
                      subject={email.subject}
                      sender={senderObject}
                      preview={email.snippet || email.preview || ''}
                      timestamp={email.date || email.timestamp || ''}
                      isRead={email.is_read || email.isRead || false}
                      hasAttachment={email.has_attachment || email.hasAttachment || false}
                      labels={email.labels || []}
                      category={category}
                      onClick={() => onEmailSelect(email)}
                    />
                  </MotionBox>
                );
              })}
            </VStack>
          ) : (
            <Flex 
              direction="column" 
              align="center" 
              justify="center"
              height="200px"
              color="gray.500"
              textAlign="center"
            >
              <Icon as={TimeIcon} boxSize={10} mb={4} />
              <Text>{emptyMessage}</Text>
            </Flex>
          )}
        </AnimatePresence>
      </Box>
    </MotionBox>
  );
};

export default CategoryPanel;
