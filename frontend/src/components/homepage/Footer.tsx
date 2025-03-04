import React from "react";
import {
  Box,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Link,
  SimpleGrid,
  Stack,
  Text,
  VStack,
  useColorModeValue,
  Divider,
  Button,
  IconButton,
  Image,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";
import {
  FaTwitter,
  FaLinkedin,
  FaGithub,
  FaEnvelope,
  FaArrowRight,
  FaRobot,
  FaBrain,
} from "react-icons/fa";
import { BsLightningChargeFill } from "react-icons/bs";
import { RiRobot2Fill } from "react-icons/ri";

// Animation keyframes
const pulse = keyframes`
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
`;

const flow = keyframes`
  0% { stroke-dashoffset: 1000; }
  100% { stroke-dashoffset: 0; }
`;

const gridAnimation = keyframes`
  0% { opacity: 0.1; }
  50% { opacity: 0.3; }
  100% { opacity: 0.1; }
`;

// Motion components
const MotionBox = motion(Box);
const MotionFlex = motion(Flex);

const Footer = () => {
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const textColor = useColorModeValue("gray.600", "gray.400");
  const headingColor = useColorModeValue("gray.800", "white");
  const linkColor = useColorModeValue("blue.500", "blue.300");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const accentColor = useColorModeValue("blue.500", "blue.400");
  const cardBg = useColorModeValue("white", "gray.800");
  const iconBg = useColorModeValue("blue.50", "gray.700");

  const linkHoverStyles = {
    color: linkColor,
    transition: "all 0.3s",
    _hover: {
      color: useColorModeValue("blue.600", "blue.200"),
      textDecoration: "none",
    },
  };

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#" },
        { name: "Integrations", href: "#" },
        { name: "AI Capabilities", href: "#" },
        { name: "Pricing", href: "#" },
        { name: "API Access", href: "#" },
      ],
    },
    {
      title: "Resources",
      links: [
        { name: "Documentation", href: "#" },
        { name: "Tutorials", href: "#" },
        { name: "Community", href: "#" },
        { name: "Blog", href: "#" },
        { name: "Support", href: "#" },
      ],
    },
    {
      title: "Company",
      links: [
        { name: "About Us", href: "#" },
        { name: "Careers", href: "#" },
        { name: "Our Team", href: "#" },
        { name: "Press", href: "#" },
        { name: "Contact", href: "#" },
      ],
    },
  ];

  const socialLinks = [
    { icon: FaTwitter, href: "#", label: "Twitter" },
    { icon: FaLinkedin, href: "#", label: "LinkedIn" },
    { icon: FaGithub, href: "#", label: "GitHub" },
  ];

  return (
    <Box bg={bgColor} color={textColor} position="relative" overflow="hidden">
      {/* Neural Network Background Pattern */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity={0.02}
        zIndex={0}
        backgroundImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMjAyMDIwIiBzdHJva2Utd2lkdGg9IjEiPjxjaXJjbGUgY3g9IjMwIiBjeT0iMzAiIHI9IjIiLz48Y2lyY2xlIGN4PSIzMCIgY3k9IjE1IiByPSIxIi8+PGNpcmNsZSBjeD0iMTUiIGN5PSIzMCIgcj0iMSIvPjxjaXJjbGUgY3g9IjQ1IiBjeT0iMzAiIHI9IjEiLz48Y2lyY2xlIGN4PSIzMCIgY3k9IjQ1IiByPSIxIi8+PGxpbmUgeDE9IjMwIiB5MT0iMzAiIHgyPSIzMCIgeTI9IjE1Ii8+PGxpbmUgeDE9IjMwIiB5MT0iMzAiIHgyPSIxNSIgeTI9IjMwIi8+PGxpbmUgeDE9IjMwIiB5MT0iMzAiIHgyPSI0NSIgeTI9IjMwIi8+PGxpbmUgeDE9IjMwIiB5MT0iMzAiIHgyPSIzMCIgeTI9IjQ1Ii8+PC9nPjwvc3ZnPg==')"
      />

      {/* Animated Neural Network Lines */}
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        bottom="0"
        zIndex={1}
        pointerEvents="none"
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
          style={{ position: "absolute", opacity: "0.05" }}
        >
          <defs>
            <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4299E1" />
              <stop offset="100%" stopColor="#805AD5" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#gradient1)" strokeWidth="1">
            {/* Neural network connections */}
            <path
              d="M100,100 C300,50 700,150 900,100"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 30s linear infinite` }}
            />
            <path
              d="M100,300 C400,250 600,350 900,300"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 25s linear infinite` }}
            />
            <path
              d="M100,500 C300,450 700,550 900,500"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 35s linear infinite` }}
            />
            <path
              d="M100,100 C150,300 50,400 100,500"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 28s linear infinite` }}
            />
            <path
              d="M900,100 C850,300 950,400 900,500"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 32s linear infinite` }}
            />
            <path
              d="M300,50 C400,200 300,400 400,550"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 22s linear infinite` }}
            />
            <path
              d="M700,50 C600,200 700,400 600,550"
              strokeDasharray="5,5"
              style={{ animation: `${flow} 26s linear infinite` }}
            />
          </g>
        </svg>
      </Box>

      {/* Gradient background */}
      <Box
        position="absolute"
        top="-20%"
        right="-10%"
        width="40%"
        height="40%"
        bg="blue.400"
        filter="blur(150px)"
        opacity="0.03"
        borderRadius="full"
        zIndex={0}
      />

      <Box
        position="absolute"
        bottom="-30%"
        left="-10%"
        width="50%"
        height="50%"
        bg="purple.500"
        filter="blur(180px)"
        opacity="0.03"
        borderRadius="full"
        zIndex={0}
      />

      {/* Newsletter section */}
      <Box py={16} position="relative" zIndex={2}>
        <Container maxW="container.xl">
          <MotionFlex
            direction={{ base: "column", lg: "row" }}
            bg={cardBg}
            borderRadius="2xl"
            overflow="hidden"
            boxShadow="xl"
            position="relative"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Decorative circuit board pattern */}
            <Box
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              opacity="0.03"
              zIndex={0}
              bgImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iODAiIGhlaWdodD0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48Y2lyY2xlIGN4PSI2MCIgY3k9IjYwIiByPSIxMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjxsaW5lIHgxPSI2MCIgeTE9IjIwIiB4Mj0iNjAiIHkyPSI0MCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjxsaW5lIHgxPSIyMCIgeTE9IjYwIiB4Mj0iNDAiIHkyPSI2MCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIvPjxsaW5lIHgxPSI4MCIgeTE9IjYwIiB4Mj0iMTAwIiB5Mj0iNjAiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iNjAiIHkxPSI4MCIgeDI9IjYwIiB5Mj0iMTAwIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+PHJlY3QgeD0iMTIwIiB5PSI0MCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+PGNpcmNsZSBjeD0iMTQwIiBjeT0iNjAiIHI9IjUiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48bGluZSB4MT0iMTQwIiB5MT0iMTAwIiB4Mj0iMTQwIiB5Mj0iODAiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=')"
              backgroundSize="100px 100px"
              animation={`${gridAnimation} 10s infinite ease-in-out`}
            />

            {/* Left part */}
            <VStack
              align="flex-start"
              spacing={6}
              p={{ base: 8, md: 12 }}
              flex="1.5"
              position="relative"
              zIndex={1}
            >
              <Flex align="center" mb={2}>
                <Icon
                  as={RiRobot2Fill}
                  color={accentColor}
                  boxSize={6}
                  mr={3}
                />
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color={accentColor}
                >
                  AI Insights Weekly
                </Text>
              </Flex>

              <Heading
                as="h3"
                fontSize={{ base: "2xl", md: "3xl" }}
                fontWeight="bold"
                color={headingColor}
                lineHeight="1.2"
              >
                Get the Latest in AI Email Technology
              </Heading>

              <Text fontSize="lg" maxW="md">
                Join our newsletter for AI advancements, productivity tips, and
                exclusive early access to new features.
              </Text>

              {/* Email signup */}
              <HStack
                spacing={4}
                mt={4}
                width="full"
                flexDir={{ base: "column", md: "row" }}
                align={{ base: "stretch", md: "center" }}
                spacing={{ base: 4, md: 4 }}
              >
                <Box
                  as="input"
                  type="email"
                  placeholder="Enter your email"
                  px={4}
                  py={3}
                  borderRadius="md"
                  borderWidth="1px"
                  borderColor={borderColor}
                  bg={useColorModeValue("white", "gray.700")}
                  _placeholder={{ color: "gray.400" }}
                  _hover={{ borderColor: "blue.300" }}
                  _focus={{
                    outline: "none",
                    borderColor: "blue.400",
                    boxShadow: `0 0 0 1px ${useColorModeValue(
                      "blue.400",
                      "blue.300"
                    )}`,
                  }}
                  width={{ base: "full", md: "320px" }}
                />

                <Button
                  bg={accentColor}
                  color="white"
                  px={8}
                  py={6}
                  _hover={{ bg: "blue.600" }}
                  _active={{ bg: "blue.700" }}
                  rightIcon={<Icon as={FaArrowRight} />}
                  width={{ base: "full", md: "auto" }}
                >
                  Subscribe
                </Button>
              </HStack>

              <Text fontSize="sm" color="gray.500" mt={2}>
                We respect your privacy. Unsubscribe at any time.
              </Text>
            </VStack>

            {/* Right part with AI visual */}
            <Flex
              display={{ base: "none", lg: "flex" }}
              flex="1"
              justifyContent="center"
              alignItems="center"
              bg={useColorModeValue("blue.50", "blue.900")}
              p={8}
              position="relative"
              overflow="hidden"
            >
              {/* Background animation */}
              <Box
                position="absolute"
                top="0"
                left="0"
                width="100%"
                height="100%"
                bgGradient="linear(to-br, blue.400, purple.500)"
                opacity="0.1"
              />

              {/* Animated brain icon */}
              <MotionBox
                initial={{ scale: 0.9, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  repeat: Infinity as number,
                  repeatType: "reverse",
                  duration: 3,
                  times: [0, 0.5, 1],
                }}
              >
                <Flex
                  width="180px"
                  height="180px"
                  bg="rgba(66, 153, 225, 0.1)"
                  borderRadius="full"
                  align="center"
                  justify="center"
                  border="1px solid"
                  borderColor="rgba(66, 153, 225, 0.3)"
                  position="relative"
                >
                  <Icon
                    as={FaBrain}
                    boxSize="80px"
                    color={accentColor}
                    opacity={0.8}
                  />

                  {/* Pulsing rings */}
                  <Box
                    position="absolute"
                    width="140%"
                    height="140%"
                    borderRadius="full"
                    border="1px solid"
                    borderColor="rgba(66, 153, 225, 0.2)"
                    opacity={0.6}
                    animation={`${pulse} 3s infinite ease-in-out`}
                  />
                  <Box
                    position="absolute"
                    width="180%"
                    height="180%"
                    borderRadius="full"
                    border="1px solid"
                    borderColor="rgba(66, 153, 225, 0.1)"
                    opacity={0.4}
                    animation={`${pulse} 3s 1s infinite ease-in-out`}
                  />
                </Flex>
              </MotionBox>

              {/* Decorative elements */}
              <Box
                position="absolute"
                top="15%"
                right="15%"
                width="30px"
                height="30px"
                borderRadius="full"
                bg={accentColor}
                opacity="0.2"
                animation={`${pulse} 2s infinite`}
              />
              <Box
                position="absolute"
                bottom="20%"
                left="20%"
                width="20px"
                height="20px"
                borderRadius="full"
                bg="purple.400"
                opacity="0.2"
                animation={`${pulse} 2.5s 0.5s infinite`}
              />
            </Flex>
          </MotionFlex>
        </Container>
      </Box>

      {/* Main footer content */}
      <Container maxW="container.xl" position="relative" zIndex={2}>
        <Box py={16}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={12}>
            {/* Brand column */}
            <GridItem colSpan={1} mr={{ lg: 8 }}>
              <VStack align="flex-start" spacing={6}>
                <HStack align="center">
                  <Icon
                    as={BsLightningChargeFill}
                    color={accentColor}
                    boxSize={6}
                    mr={2}
                  />
                  <Heading
                    as="h2"
                    fontSize="2xl"
                    fontWeight="bold"
                    color={headingColor}
                  >
                    EmailAI
                  </Heading>
                </HStack>

                <Text fontSize="md" lineHeight="tall">
                  Advanced AI technology to transform your email experience,
                  saving you time and enhancing productivity.
                </Text>

                {/* Social media icons */}
                <HStack spacing={4} mt={4}>
                  {socialLinks.map((social, index) => (
                    <IconButton
                      key={index}
                      aria-label={social.label}
                      icon={<Icon as={social.icon} />}
                      size="md"
                      variant="ghost"
                      color={textColor}
                      _hover={{
                        bg: iconBg,
                        color: accentColor,
                      }}
                      borderRadius="full"
                    />
                  ))}
                </HStack>
              </VStack>
            </GridItem>

            {/* Link columns */}
            {footerLinks.map((category, idx) => (
              <GridItem key={idx}>
                <VStack align="flex-start" spacing={4}>
                  <Heading
                    as="h3"
                    fontSize="md"
                    fontWeight="bold"
                    color={headingColor}
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    {category.title}
                  </Heading>

                  <VStack align="flex-start" spacing={3}>
                    {category.links.map((link, linkIdx) => (
                      <Link
                        key={linkIdx}
                        href={link.href}
                        fontSize="sm"
                        fontWeight="medium"
                        {...linkHoverStyles}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </VStack>
                </VStack>
              </GridItem>
            ))}
          </SimpleGrid>
        </Box>

        <Divider borderColor={borderColor} />

        {/* Bottom footer */}
        <Flex
          py={8}
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "center", md: "center" }}
          textAlign={{ base: "center", md: "left" }}
          spacing={4}
        >
          <Text fontSize="sm" color={textColor}>
            © 2023 EmailAI. All rights reserved.
          </Text>

          <HStack spacing={6} mt={{ base: 4, md: 0 }}>
            <Link href="#" fontSize="sm" {...linkHoverStyles}>
              Privacy Policy
            </Link>
            <Link href="#" fontSize="sm" {...linkHoverStyles}>
              Terms of Service
            </Link>
            <Link href="#" fontSize="sm" {...linkHoverStyles}>
              Cookie Policy
            </Link>
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default Footer;
