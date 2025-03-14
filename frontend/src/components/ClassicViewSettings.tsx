'use client';

import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Tabs, 
  TabList, 
  Tab, 
  TabPanels, 
  TabPanel,
  useColorModeValue,
  Heading,
  Text,
  FormControl,
  FormLabel,
  Switch,
  Button,
  VStack,
  HStack,
  Input,
  Select,
  Divider,
  useToast,
  Card,
  CardHeader,
  CardBody,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Flex,
  Spacer
} from '@chakra-ui/react';
import { FiUser, FiMail, FiClock, FiCalendar, FiSettings, FiAlertCircle, FiPower } from 'react-icons/fi';
import { 
  getBackgroundServiceStatus, 
  toggleBackgroundService, 
  updateBackgroundServicePreferences 
} from '../lib/backgroundServiceApi';

// Placeholder components for future implementation
const ProfileSettings = () => (
  <Box p={4}>
    <Heading size="md" mb={4}>Profile Settings</Heading>
    <Text>Profile configuration will be available in a future update.</Text>
  </Box>
);

const EmailSettings = () => (
  <Box p={4}>
    <Heading size="md" mb={4}>Email Settings</Heading>
    <Text>Email configuration will be available in a future update.</Text>
  </Box>
);

const NotificationSettings = () => (
  <Box p={4}>
    <Heading size="md" mb={4}>Notification Settings</Heading>
    <Text>Notification configuration will be available in a future update.</Text>
  </Box>
);

const AdvancedSettings = () => (
  <Box p={4}>
    <Heading size="md" mb={4}>Advanced Settings</Heading>
    <Text>Advanced configuration will be available in a future update.</Text>
  </Box>
);

// Background Service Settings Component
const BackgroundServiceSettings = () => {
  const toast = useToast();
  const cardBg = useColorModeValue('white', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');

  // Service status
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState({
    is_enabled: false,
    has_refresh_token: false,
    preferences: {
      schedule_start_time: '09:00:00',
      schedule_end_time: '17:00:00',
      active_days: '1,2,3,4,5',
      max_daily_emails: 50,
    },
    service_status: 'unknown',
    last_run: null,
    activity: []
  });

  // Form state
  const [formState, setFormState] = useState({
    is_enabled: false,
    schedule_start_time: '09:00',
    schedule_end_time: '17:00',
    active_days: ['1', '2', '3', '4', '5'],
    max_daily_emails: 50
  });

  // Load status on mount
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setIsLoading(true);
      const response = await getBackgroundServiceStatus();
      
      if (response.data) {
        setStatus(response.data);
        
        // Convert time format if needed (HH:MM:SS to HH:MM)
        const startTime = response.data.preferences.schedule_start_time?.substring(0, 5) || '09:00';
        const endTime = response.data.preferences.schedule_end_time?.substring(0, 5) || '17:00';
        
        // Parse active days to array
        const activeDays = response.data.preferences.active_days?.split(',') || ['1', '2', '3', '4', '5'];
        
        setFormState({
          is_enabled: response.data.is_enabled,
          schedule_start_time: startTime,
          schedule_end_time: endTime,
          active_days: activeDays,
          max_daily_emails: response.data.preferences.max_daily_emails || 50
        });
      }
    } catch (error) {
      console.error('Error fetching background service status:', error);
      toast({
        title: 'Error',
        description: 'Could not load background service status',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleService = async () => {
    try {
      const newState = !formState.is_enabled;
      await toggleBackgroundService(newState);
      
      setFormState({
        ...formState,
        is_enabled: newState
      });
      
      toast({
        title: newState ? 'Service Enabled' : 'Service Disabled',
        description: newState 
          ? 'Background service will now process emails automatically'
          : 'Background service has been disabled',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
      // Refresh status
      fetchStatus();
      
    } catch (error) {
      console.error('Error toggling background service:', error);
      toast({
        title: 'Error',
        description: 'Could not update background service status',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    }
  };

  const handleSaveSettings = async () => {
    try {
      // Format for API
      const settings = {
        schedule_start_time: formState.schedule_start_time + ':00',
        schedule_end_time: formState.schedule_end_time + ':00',
        active_days: formState.active_days.join(','),
        max_daily_emails: formState.max_daily_emails
      };
      
      await updateBackgroundServicePreferences(settings);
      
      toast({
        title: 'Settings Saved',
        description: 'Background service settings have been updated',
        status: 'success',
        duration: 3000,
        isClosable: true
      });
      
      // Refresh status
      fetchStatus();
      
    } catch (error) {
      console.error('Error saving background service settings:', error);
      toast({
        title: 'Error',
        description: 'Could not save background service settings',
        status: 'error',
        duration: 3000,
        isClosable: true
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormState({
      ...formState,
      [field]: value
    });
  };

  const handleDayToggle = (day) => {
    const currentDays = [...formState.active_days];
    if (currentDays.includes(day)) {
      // Remove the day
      const updatedDays = currentDays.filter(d => d !== day);
      // Ensure we have at least one day selected
      if (updatedDays.length > 0) {
        setFormState({
          ...formState,
          active_days: updatedDays
        });
      }
    } else {
      // Add the day
      setFormState({
        ...formState,
        active_days: [...currentDays, day]
      });
    }
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <Box p={4}>
      <Heading size="lg" mb={6}>Background Service Settings</Heading>
      
      <VStack spacing={6} align="stretch">
        {/* Service Status */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardHeader>
            <Heading size="md">Service Status</Heading>
          </CardHeader>
          <CardBody>
            <HStack spacing={4}>
              <FormControl display="flex" alignItems="center">
                <FormLabel mb="0">
                  Enable Background Email Processing
                </FormLabel>
                <Switch 
                  colorScheme="blue" 
                  isChecked={formState.is_enabled}
                  onChange={handleToggleService}
                />
              </FormControl>
              
              <Button
                leftIcon={<FiPower />}
                colorScheme={status.service_status === 'running' ? 'green' : 'gray'}
                size="sm"
                isDisabled={true}
              >
                {status.service_status === 'running' ? 'Running' : 'Status: ' + status.service_status}
              </Button>
            </HStack>
            
            {!status.has_refresh_token && (
              <Box mt={4} p={2} bg="yellow.100" borderRadius="md">
                <HStack>
                  <FiAlertCircle color="orange" />
                  <Text fontSize="sm">
                    Google authentication token is missing. Please log out and log back in to grant required permissions.
                  </Text>
                </HStack>
              </Box>
            )}
          </CardBody>
        </Card>
        
        {/* Schedule Settings */}
        <Card bg={cardBg} borderColor={borderColor} borderWidth="1px">
          <CardHeader>
            <Heading size="md">Schedule Settings</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={4} align="stretch">
              {/* Time Range */}
              <FormControl>
                <FormLabel>Active Hours</FormLabel>
                <HStack>
                  <Input
                    type="time"
                    value={formState.schedule_start_time}
                    onChange={(e) => handleInputChange('schedule_start_time', e.target.value)}
                    width="150px"
                  />
                  <Text>to</Text>
                  <Input
                    type="time"
                    value={formState.schedule_end_time}
                    onChange={(e) => handleInputChange('schedule_end_time', e.target.value)}
                    width="150px"
                  />
                </HStack>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  The service will only process emails during these hours
                </Text>
              </FormControl>
              
              {/* Active Days */}
              <FormControl mt={4}>
                <FormLabel>Active Days</FormLabel>
                <HStack spacing={2} wrap="wrap">
                  {dayNames.map((day, index) => (
                    <Button
                      key={index}
                      size="sm"
                      colorScheme={formState.active_days.includes((index + 1).toString()) ? 'blue' : 'gray'}
                      onClick={() => handleDayToggle((index + 1).toString())}
                    >
                      {day.substring(0, 3)}
                    </Button>
                  ))}
                </HStack>
              </FormControl>
              
              {/* Daily Email Limit */}
              <FormControl mt={4}>
                <FormLabel>Daily Email Limit: {formState.max_daily_emails}</FormLabel>
                <Slider
                  min={5}
                  max={100}
                  step={5}
                  value={formState.max_daily_emails}
                  onChange={(value) => handleInputChange('max_daily_emails', value)}
                >
                  <SliderTrack>
                    <SliderFilledTrack />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
                <Text fontSize="sm" color="gray.600" mt={1}>
                  Maximum number of auto-replies to send per day
                </Text>
              </FormControl>
            </VStack>
          </CardBody>
        </Card>
        
        <Flex>
          <Spacer />
          <Button colorScheme="blue" onClick={handleSaveSettings}>
            Save Settings
          </Button>
        </Flex>
      </VStack>
    </Box>
  );
};

const ClassicViewSettings: React.FC = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const activeTabBg = useColorModeValue('blue.50', 'blue.900');
  const activeTabColor = useColorModeValue('blue.700', 'blue.200');

  return (
    <Box 
      bg={bgColor} 
      borderRadius="md" 
      p={4} 
      width="100%"
    >
      <Tabs variant="enclosed" colorScheme="blue" isLazy>
        <TabList>
          <Tab><Box as="span" mr={2}><FiUser /></Box> Profile</Tab>
          <Tab><Box as="span" mr={2}><FiMail /></Box> Email</Tab>
          <Tab _selected={{ bg: activeTabBg, color: activeTabColor }}><Box as="span" mr={2}><FiClock /></Box> Background Service</Tab>
          <Tab><Box as="span" mr={2}><FiCalendar /></Box> Notifications</Tab>
          <Tab><Box as="span" mr={2}><FiSettings /></Box> Advanced</Tab>
        </TabList>
        
        <TabPanels>
          <TabPanel>
            <ProfileSettings />
          </TabPanel>
          <TabPanel>
            <EmailSettings />
          </TabPanel>
          <TabPanel>
            <BackgroundServiceSettings />
          </TabPanel>
          <TabPanel>
            <NotificationSettings />
          </TabPanel>
          <TabPanel>
            <AdvancedSettings />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default ClassicViewSettings;
