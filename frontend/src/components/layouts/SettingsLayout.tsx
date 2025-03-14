import React, { ReactNode } from 'react';
import { Box, Container, Flex, Heading, Link, VStack, HStack, useColorModeValue } from '@chakra-ui/react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { FiSettings, FiUser, FiMail, FiCalendar, FiClock } from 'react-icons/fi';

interface SettingsLayoutProps {
  children: ReactNode;
}

interface NavItemProps {
  href: string;
  icon: React.ReactElement;
  title: string;
  isActive: boolean;
}

const NavItem = ({ href, icon, title, isActive }: NavItemProps) => {
  const activeBg = useColorModeValue('blue.50', 'blue.900');
  const activeColor = useColorModeValue('blue.700', 'blue.200');
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  
  return (
    <NextLink href={href} passHref legacyBehavior>
      <Link
        _hover={{ textDecoration: 'none' }}
        w="100%"
      >
        <HStack
          px={4}
          py={3}
          borderRadius="md"
          bg={isActive ? activeBg : 'transparent'}
          color={isActive ? activeColor : undefined}
          _hover={!isActive ? { bg: hoverBg } : undefined}
          transition="all 0.2s"
        >
          <Box color={isActive ? activeColor : 'gray.500'}>
            {icon}
          </Box>
          <Box fontWeight={isActive ? 'semibold' : 'normal'}>
            {title}
          </Box>
        </HStack>
      </Link>
    </NextLink>
  );
};

const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const borderColor = useColorModeValue('gray.200', 'gray.700');
  
  const navigationItems = [
    { href: '/settings/profile', icon: <FiUser />, title: 'Profile' },
    { href: '/settings/email', icon: <FiMail />, title: 'Email Settings' },
    { href: '/settings/background-service', icon: <FiClock />, title: 'Background Service' },
    { href: '/settings/notifications', icon: <FiCalendar />, title: 'Notifications' },
    { href: '/settings/advanced', icon: <FiSettings />, title: 'Advanced Settings' },
  ];

  return (
    <Box minH="100vh" bg={bgColor}>
      <Container maxW="container.xl" py={8}>
        <Heading as="h1" size="xl" mb={8}>
          Settings
        </Heading>
        
        <Flex
          direction={{ base: 'column', md: 'row' }}
          gap={8}
        >
          <Box
            width={{ base: 'full', md: '250px' }}
            borderRadius="md"
            borderWidth="1px"
            borderColor={borderColor}
            p={4}
            bg={useColorModeValue('white', 'gray.800')}
          >
            <VStack align="stretch" spacing={1}>
              {navigationItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={item.title}
                  isActive={pathname === item.href}
                />
              ))}
            </VStack>
          </Box>
          
          <Box flex={1}>{children}</Box>
        </Flex>
      </Container>
    </Box>
  );
};

export default SettingsLayout;
