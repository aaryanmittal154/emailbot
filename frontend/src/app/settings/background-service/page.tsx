'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Button,
  Container,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  Switch,
  Text,
  VStack,
  Checkbox,
  Badge,
  Divider,
  useToast,
  Spinner,
  Card,
  CardBody,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { ArrowBackIcon } from '@chakra-ui/icons';
import {
  getBackgroundServiceStatus,
  toggleBackgroundService,
  disableBackgroundServiceCompletely,
  pauseBackgroundService,
  resumeBackgroundService,
  updateBackgroundServicePreferences,
  getBackgroundServicePreferences,
  getBackgroundServiceOAuthUrl,
} from '../../../lib/backgroundServiceApi';
import { getOfflineAccessUrl } from '../../../lib/api';

const BackgroundServiceSettings = () => {
  const router = useRouter();
  const toast = useToast();
  
  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({
    is_enabled: false,
    has_refresh_token: false,
    preferences: {
      schedule_start_time: '09:00',
      schedule_end_time: '17:00',
      active_days: '1,2,3,4,5',
      max_daily_emails: 50,
      send_summary: true,
      notify_important: true,
      auto_pause_days: 7,
    },
    today_email_count: 0,
  });

  // Form state
  const [formValues, setFormValues] = useState({
    background_enabled: false,
    schedule_start_time: '09:00',
    schedule_end_time: '17:00',
    active_days: '1,2,3,4,5',
    max_daily_emails: 50,
    send_summary: true,
    notify_important: true,
    auto_pause_days: 7,
  });
  
  // Define pulse animation keyframes  
  const pulseAnimation = `
    @keyframes pulse {
      0% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
      100% {
        opacity: 1;
      }
    }
  `;

  // Refresh status function
  const refreshStatus = async () => {
    setLoading(true);
    try {
      const response = await getBackgroundServiceStatus();
      setStatus(response.data);
      setFormValues({
        background_enabled: response.data.is_enabled,
        schedule_start_time: response.data.preferences.schedule_start_time || '09:00',
        schedule_end_time: response.data.preferences.schedule_end_time || '17:00',
        active_days: response.data.preferences.active_days || '1,2,3,4,5',
        max_daily_emails: response.data.preferences.max_daily_emails || 50,
        send_summary: response.data.preferences.send_summary || true,
        notify_important: response.data.preferences.notify_important || true,
        auto_pause_days: response.data.preferences.auto_pause_days || 7,
      });
    } catch (error) {
      console.error('Error fetching service status:', error);
      toast({
        title: 'Error',
        description: 'Could not fetch service status',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Load initial data
  useEffect(() => {
    const loadServiceStatus = async () => {
      try {
        setLoading(true);
        const response = await getBackgroundServiceStatus();
        setStatus(response.data);
        
        // Initialize form with current preferences and ensure no null values
        setFormValues({
          background_enabled: response.data.is_enabled,
          schedule_start_time: response.data.preferences?.schedule_start_time || '09:00',
          schedule_end_time: response.data.preferences?.schedule_end_time || '17:00',
          active_days: response.data.preferences?.active_days || '1,2,3,4,5',
          max_daily_emails: response.data.preferences?.max_daily_emails || 50,
          send_summary: response.data.preferences?.send_summary ?? true,
          notify_important: response.data.preferences?.notify_important ?? true,
          auto_pause_days: response.data.preferences?.auto_pause_days || 7,
        });
      } catch (error) {
        console.error('Error loading service status:', error);
        toast({
          title: 'Error loading settings',
          description: 'Could not load your background service settings. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadServiceStatus();
  }, [toast]);
  
  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormValues({ ...formValues, [field]: value });
  };
  
  // Handle saving preferences
  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      await updateBackgroundServicePreferences(formValues);
      toast({
        title: 'Settings updated',
        description: 'Your background service settings have been updated successfully.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Update failed',
        description: 'Could not update your settings. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Handle toggle service
  const handleToggleService = async () => {
    setSaving(true);
    
    try {
      if (status.is_enabled) {
        // If we're turning it off, use the complete disable function to ensure it stops completely
        const response = await disableBackgroundServiceCompletely();
        
        if (response.data.success) {
          toast({
            title: 'Success',
            description: 'Background service completely disabled',
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
          
          // Force refresh status immediately to update UI
          await refreshStatus();
        }
      } else {
        // Use the direct toggle endpoint when enabling
        const response = await toggleBackgroundService();
        
        if (response.data.success) {
          toast({
            title: 'Success',
            description: response.data.message,
            status: 'success',
            duration: 5000,
            isClosable: true,
          });
          
          // Force refresh status immediately to update UI
          await refreshStatus();
        } else {
          // If auth is needed, redirect to auth flow
          if (response.data.needs_auth) {
            try {
              const authResponse = await getBackgroundServiceOAuthUrl();
              window.location.href = authResponse.data.auth_url;
              return;  // Early return as we're redirecting
            } catch (error) {
              console.error('Failed to get auth URL:', error);
              toast({
                title: 'Authentication Failed',
                description: 'Could not start the authentication process',
                status: 'error',
                duration: 5000,
                isClosable: true,
              });
            }
          } else {
            // Other error
            toast({
              title: 'Error',
              description: response.data.message || 'Failed to toggle service',
              status: 'error',
              duration: 5000,
              isClosable: true,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error toggling service:', error);
      toast({
        title: 'Error',
        description: 'Could not toggle background service',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
      
      // Double-check status again after a short delay
      setTimeout(() => {
        refreshStatus();
      }, 1000);
    }
  };
  
  // Enhanced status refresh to ensure UI is in sync with backend
  useEffect(() => {
    // Initial load
    refreshStatus();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      refreshStatus();
    }, 5000); // Refresh every 5 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Check for query parameters (from OAuth callback) on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const enabled = params.get('enabled');
    const error = params.get('error');
    
    // If we have either parameter, we came from the OAuth callback
    if (enabled || error) {
      // Remove the parameters from the URL without refreshing
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Show appropriate toast
      if (enabled === 'true') {
        toast({
          title: 'Background Service Enabled',
          description: 'Your background email processing has been successfully enabled.',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        
        // Force immediate status refresh
        refreshStatus();
      } else if (error === 'true') {
        toast({
          title: 'Authentication Failed',
          description: 'There was a problem enabling background service. Please try again.',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    }
  }, [toast]);
  
  // Parse active days into array of day indexes
  const activeDaysArray = formValues.active_days.split(',').map(day => parseInt(day.trim()));
  
  // Day of week helpers
  const daysOfWeek = [
    { name: 'Mon', value: 1 },
    { name: 'Tue', value: 2 },
    { name: 'Wed', value: 3 },
    { name: 'Thu', value: 4 },
    { name: 'Fri', value: 5 },
    { name: 'Sat', value: 6 },
    { name: 'Sun', value: 0 },
  ];
  
  // Toggle day selection
  const toggleDay = (dayValue) => {
    const currentDays = formValues.active_days.split(',').map(day => parseInt(day.trim()));
    let newDays;
    
    if (currentDays.includes(dayValue)) {
      // Remove day
      newDays = currentDays.filter(day => day !== dayValue);
    } else {
      // Add day
      newDays = [...currentDays, dayValue].sort();
    }
    
    setFormValues({
      ...formValues,
      active_days: newDays.join(','),
    });
  };

  return (
    <Container maxW="container.md" py={8}>
      <style jsx global>{`
        ${pulseAnimation}
      `}</style>
      <Box mb={6}>
        <Button 
          leftIcon={<ArrowBackIcon />} 
          variant="outline"
          onClick={() => router.back()}
          mb={4}
        >
          Back to Dashboard
        </Button>
        <Heading size="lg" mb={2}>Background Service Settings</Heading>
        <Text color="gray.600">
          Configure how your email assistant works in the background, even when you're offline
        </Text>
      </Box>
      
      {loading ? (
        <Flex justify="center" py={10}>
          <Spinner size="xl" />
        </Flex>
      ) : (
        <Card variant="outline" bg="white">
          <CardBody>
            <VStack spacing={6} align="stretch">
              {/* Service Status Section */}
              <Box>
                {/* New Status Badge Section */}
                <Box mb={4} p={3} borderRadius="md" bg={status.is_enabled ? 'green.50' : 'gray.50'}>
                  <Flex justifyContent="space-between" alignItems="center">
                    <Flex alignItems="center">
                      <Box 
                        w={3} 
                        h={3} 
                        borderRadius="full" 
                        bg={status.is_enabled ? 'green.500' : 'gray.400'} 
                        mr={2}
                        animation={status.is_enabled ? "pulse 2s infinite" : "none"}
                      />
                      <Heading size="md" color={status.is_enabled ? 'green.700' : 'gray.700'}>
                        {status.is_enabled ? 'ACTIVE' : 'PAUSED'}
                      </Heading>
                    </Flex>
                    <Text fontSize="sm" color="gray.600">
                      Last refreshed: {new Date().toLocaleTimeString()} {' '}
                      <Button 
                        size="xs" 
                        variant="ghost" 
                        onClick={refreshStatus} 
                        isLoading={loading}
                      >
                        Refresh
                      </Button>
                    </Text>
                  </Flex>
                </Box>
                
                <Flex justifyContent="space-between" alignItems="flex-start" mb={4}>
                  <Box flex="1">
                    <Heading size="md" mb={2}>Service Status</Heading>
                    <Text fontSize="sm" color="gray.600" mb={4}>
                      {status.is_enabled 
                        ? 'Your assistant is actively monitoring and responding to emails in the background.' 
                        : 'Enable background processing to allow your assistant to answer emails when you\'re away.'}
                    </Text>
                  </Box>
                  
                  {/* Today's Stats */}
                  <Box textAlign="center" p={3} borderRadius="md" bg="blue.50" ml={4}>
                    <Text fontSize="sm" color="blue.700">Today's Activity</Text>
                    <Text fontSize="2xl" fontWeight="bold" color="blue.700">{status.today_email_count}</Text>
                    <Text fontSize="xs" color="blue.600">Emails Processed</Text>
                  </Box>
                </Flex>
                
                {/* Authentication Status */}
                <Box mb={4}>
                  <Flex alignItems="center" mb={2}>
                    <Box 
                      w={2} 
                      h={2} 
                      borderRadius="full" 
                      bg={status.has_refresh_token ? 'green.500' : 'yellow.500'} 
                      mr={2}
                    />
                    <Text fontWeight="medium">
                      Gmail Connection: {status.has_refresh_token ? 'Connected' : 'Not Connected'}
                    </Text>
                  </Flex>
                  
                  {!status.has_refresh_token && (
                    <Box bg="yellow.50" p={3} borderRadius="md" mt={2}>
                      <Text fontSize="sm" color="yellow.800">
                        ⚠️ Authentication token missing. You need to connect your Gmail account first to use the background service.
                      </Text>
                      <Button 
                        mt={2} 
                        size="sm" 
                        colorScheme="yellow" 
                        onClick={async () => {
                          try {
                            const response = await getBackgroundServiceOAuthUrl();
                            window.location.href = response.data.auth_url;
                          } catch (error) {
                            console.error('Error getting auth URL:', error);
                            toast({
                              title: 'Authentication Failed',
                              description: 'Could not start the authentication process. Please try again.',
                              status: 'error',
                              duration: 5000,
                              isClosable: true,
                            });
                          }
                        }}
                      >
                        Connect Gmail
                      </Button>
                    </Box>
                  )}
                </Box>
                
                {/* Service Control Buttons - Replace switch with buttons */}
                <Box mt={4}>
                  {status.is_enabled ? (
                    <Button
                      colorScheme="orange"
                      leftIcon={<span>⏸️</span>}
                      onClick={handleToggleService}
                      isLoading={saving}
                      width="100%"
                      mb={3}
                    >
                      Pause Background Service
                    </Button>
                  ) : (
                    <Button
                      colorScheme="green"
                      leftIcon={<span>▶️</span>}
                      onClick={handleToggleService}
                      isLoading={saving}
                      width="100%"
                      mb={3}
                      isDisabled={!status.has_refresh_token}
                    >
                      Enable Background Service
                    </Button>
                  )}
                  <Text fontSize="xs" color="gray.500">
                    {status.is_enabled 
                      ? 'The service is running according to your schedule settings below.' 
                      : 'Click to enable automatic email processing when you\'re not online.'}
                  </Text>
                </Box>
                
                {/* Hidden legacy switch for backward compatibility */}
                <FormControl display="none">
                  <Switch 
                    id="service-toggle"
                    isChecked={status.is_enabled}
                    onChange={handleToggleService}
                  />
                </FormControl>
                
                {/* Activity Log */}
                {status.is_enabled && (
                  <Box mt={6} p={3} borderRadius="md" bg="gray.50">
                    <Heading size="sm" mb={3}>Recent Activity</Heading>
                    <VStack align="stretch" spacing={2}>
                      <Flex fontSize="sm">
                        <Text color="gray.500" minWidth="100px">{new Date().toLocaleTimeString()}</Text>
                        <Text>Status refreshed</Text>
                      </Flex>
                      {status.today_email_count > 0 && (
                        <Flex fontSize="sm">
                          <Text color="gray.500" minWidth="100px">Today</Text>
                          <Text>Processed {status.today_email_count} emails</Text>
                        </Flex>
                      )}
                      <Flex fontSize="sm">
                        <Text color="gray.500" minWidth="100px">Today</Text>
                        <Text>{status.is_enabled ? 'Service active' : 'Service paused'}</Text>
                      </Flex>
                    </VStack>
                  </Box>
                )}
              </Box>
              
              <Divider />
              
              {/* Schedule Settings */}
              <Box>
                <Heading size="md" mb={4}>Schedule Settings</Heading>
                
                <HStack spacing={6} mb={6} wrap="wrap">
                  <FormControl width={{ base: "100%", md: "45%" }}>
                    <FormLabel htmlFor="start-time">Start Time</FormLabel>
                    <Input
                      id="start-time"
                      type="time"
                      value={formValues.schedule_start_time || '09:00'}
                      onChange={e => handleInputChange('schedule_start_time', e.target.value || '09:00')}
                      isDisabled={saving}
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      The service will start checking emails at this time
                    </Text>
                  </FormControl>
                  
                  <FormControl width={{ base: "100%", md: "45%" }}>
                    <FormLabel htmlFor="end-time">End Time</FormLabel>
                    <Input
                      id="end-time"
                      type="time"
                      value={formValues.schedule_end_time || '17:00'}
                      onChange={e => handleInputChange('schedule_end_time', e.target.value || '17:00')}
                      isDisabled={saving}
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      The service will stop checking emails at this time
                    </Text>
                  </FormControl>
                </HStack>
                
                <Box mb={6}>
                  <FormLabel>Active Days</FormLabel>
                  <Flex gap={2} wrap="wrap">
                    {daysOfWeek.map(day => (
                      <Button
                        key={day.value}
                        size="sm"
                        colorScheme={activeDaysArray.includes(day.value) ? 'blue' : 'gray'}
                        variant={activeDaysArray.includes(day.value) ? 'solid' : 'outline'}
                        onClick={() => toggleDay(day.value)}
                        isDisabled={saving}
                      >
                        {day.name}
                      </Button>
                    ))}
                  </Flex>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    The service will only run on selected days
                  </Text>
                </Box>
                
                <FormControl mb={6}>
                  <FormLabel htmlFor="max-emails">Maximum Daily Emails</FormLabel>
                  <NumberInput
                    id="max-emails"
                    min={1}
                    max={500}
                    value={formValues.max_daily_emails || 50}
                    onChange={(valueString) => handleInputChange('max_daily_emails', parseInt(valueString) || 50)}
                    isDisabled={saving}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Maximum number of emails the service will process per day
                  </Text>
                </FormControl>
              </Box>
              
              <Divider />
              
              {/* Notification Settings */}
              <Box>
                <Heading size="md" mb={4}>Notification Settings</Heading>
                
                <FormControl display="flex" alignItems="center" mb={4}>
                  <Switch
                    id="send-summary"
                    isChecked={formValues.send_summary}
                    onChange={(e) => handleInputChange('send_summary', e.target.checked)}
                    colorScheme="blue"
                    mr={3}
                    isDisabled={saving}
                  />
                  <FormLabel htmlFor="send-summary" mb="0">
                    Send daily summary email
                  </FormLabel>
                </FormControl>
                
                <FormControl display="flex" alignItems="center">
                  <Switch
                    id="notify-important"
                    isChecked={formValues.notify_important}
                    onChange={(e) => handleInputChange('notify_important', e.target.checked)}
                    colorScheme="blue"
                    mr={3}
                    isDisabled={saving}
                  />
                  <FormLabel htmlFor="notify-important" mb="0">
                    Notify me about important emails
                  </FormLabel>
                </FormControl>
              </Box>
              
              <Divider />
              
              {/* Auto-Pause Settings */}
              <Box>
                <Heading size="md" mb={4}>Auto-Pause Settings</Heading>
                
                <FormControl mb={6}>
                  <FormLabel htmlFor="auto-pause">Auto-Pause After Inactivity (Days)</FormLabel>
                  <NumberInput
                    id="auto-pause"
                    min={1}
                    max={90}
                    value={formValues.auto_pause_days || 7}
                    onChange={(valueString) => handleInputChange('auto_pause_days', parseInt(valueString) || 7)}
                    isDisabled={saving}
                  >
                    <NumberInputField />
                    <NumberInputStepper>
                      <NumberIncrementStepper />
                      <NumberDecrementStepper />
                    </NumberInputStepper>
                  </NumberInput>
                  <Text fontSize="xs" color="gray.500" mt={1}>
                    Automatically pause the service if you haven't logged in for this many days
                  </Text>
                </FormControl>
              </Box>
              
              {/* Save Button */}
              <Flex justify="flex-end">
                <Button
                  colorScheme="blue"
                  isLoading={saving}
                  loadingText="Saving"
                  onClick={handleSavePreferences}
                  size="md"
                >
                  Save Settings
                </Button>
              </Flex>
            </VStack>
          </CardBody>
        </Card>
      )}
    </Container>
  );
};

export default BackgroundServiceSettings;
