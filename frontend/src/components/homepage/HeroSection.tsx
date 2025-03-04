import React from "react";
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Image,
  Stack,
  Text,
  VStack,
  useColorModeValue,
  Highlight,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaArrowRight } from "react-icons/fa";
import { TbBrain, TbRobot, TbMailFast } from "react-icons/tb";
import { keyframes } from "@emotion/react";

// Create animation keyframes
const pulse = keyframes`
  0% { transform: scale(0.98); opacity: 0.8; }
  50% { transform: scale(1.02); opacity: 1; }
  100% { transform: scale(0.98); opacity: 0.8; }
`;

const float = keyframes`
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 15px rgba(159, 122, 234, 0.5); }
  50% { box-shadow: 0 0 30px rgba(159, 122, 234, 0.7); }
  100% { box-shadow: 0 0 15px rgba(159, 122, 234, 0.5); }
`;

// Create motion components
const MotionBox = motion(Box);
const MotionImage = motion(Image);

interface HeroSectionProps {
  onLogin: () => void;
  isLoading: boolean;
}

const HeroSection = ({ onLogin, isLoading }: HeroSectionProps) => {
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const textColor = useColorModeValue("gray.800", "gray.100");
  const highlightColor = useColorModeValue("purple.500", "purple.300");
  const buttonBg = useColorModeValue("purple.500", "purple.400");

  const FeatureIcon = ({ icon }: { icon: React.ElementType }) => (
    <Box
      bg="rgba(159, 122, 234, 0.1)"
      borderRadius="full"
      p={2}
      mr={3}
      display="flex"
      alignItems="center"
      justifyContent="center"
      borderWidth="1px"
      borderColor="purple.200"
      boxShadow="0 0 10px rgba(159, 122, 234, 0.3)"
    >
      <Icon as={icon} w={5} h={5} color={highlightColor} />
    </Box>
  );

  return (
    <Box position="relative" bg={bgColor} overflow="hidden">
      {/* Animated background grid */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity="0.05"
        zIndex={0}
        bgImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzY2NiIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')"
      />

      {/* Gradient orbs in background */}
      <Box
        position="absolute"
        top="20%"
        right="-5%"
        width="40%"
        height="40%"
        borderRadius="full"
        bg="purple.400"
        filter="blur(150px)"
        opacity="0.15"
        zIndex={0}
      />

      <Box
        position="absolute"
        bottom="-10%"
        left="-10%"
        width="50%"
        height="50%"
        borderRadius="full"
        bg="purple.500"
        filter="blur(170px)"
        opacity="0.1"
        zIndex={0}
      />

      <Container
        maxW="container.xl"
        pt={{ base: 20, md: 32 }}
        pb={{ base: 24, md: 36 }}
      >
        <Stack
          direction={{ base: "column", lg: "row" }}
          spacing={{ base: 14, lg: 24 }}
          align="center"
          justify="space-between"
          position="relative"
          zIndex={1}
        >
          {/* Left column with text */}
          <VStack
            align="flex-start"
            spacing={8}
            maxW={{ base: "100%", lg: "50%" }}
          >
            <MotionBox
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
            >
              <Box mb={3}>
                <Text
                  as="span"
                  px={3}
                  py={1}
                  rounded="full"
                  fontSize="sm"
                  fontWeight="bold"
                  bg="purple.100"
                  color="purple.600"
                  _dark={{ bg: "purple.900", color: "purple.200" }}
                  letterSpacing="wider"
                  textTransform="uppercase"
                >
                  AI-Powered Email Management
                </Text>
              </Box>
              <Heading
                as="h1"
                size="3xl"
                fontWeight="extrabold"
                lineHeight="1.1"
                letterSpacing="tight"
                mb={6}
                color={textColor}
              >
                <Highlight
                  query={["AI", "Email"]}
                  styles={{ color: highlightColor }}
                >
                  Advanced AI Email Assistant for the Modern Professional
                </Highlight>
              </Heading>
              <Text
                fontSize="xl"
                color={textColor}
                opacity={0.9}
                lineHeight="taller"
              >
                Our neural network powered assistant helps you triage, organize,
                and respond to emails intelligently. Save hours each week with
                our cutting-edge AI technology designed to optimize your
                workflow.
              </Text>
            </MotionBox>

            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
            >
              <Stack direction="column" spacing={5} w="full">
                <Flex align="center">
                  <FeatureIcon icon={TbBrain} />
                  <Text fontSize="lg" fontWeight="medium" color={textColor}>
                    Advanced neural processing for email classification
                  </Text>
                </Flex>
                <Flex align="center">
                  <FeatureIcon icon={TbRobot} />
                  <Text fontSize="lg" fontWeight="medium" color={textColor}>
                    AI-generated responses with your personal style
                  </Text>
                </Flex>
                <Flex align="center">
                  <FeatureIcon icon={TbMailFast} />
                  <Text fontSize="lg" fontWeight="medium" color={textColor}>
                    Optimize your time with smart prioritization
                  </Text>
                </Flex>
              </Stack>
            </MotionBox>

            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              alignSelf={{ base: "center", md: "flex-start" }}
              w={{ base: "full", md: "auto" }}
            >
              <Button
                size="lg"
                bg={buttonBg}
                color="white"
                px={8}
                py={7}
                fontSize="lg"
                fontWeight="bold"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "xl",
                  bg: "purple.600",
                }}
                _active={{ bg: "purple.700" }}
                borderRadius="lg"
                rightIcon={<Icon as={FaArrowRight} />}
                onClick={onLogin}
                isLoading={isLoading}
                loadingText="Authenticating..."
                shadow="md"
                transition="all 0.3s"
                w={{ base: "full", md: "auto" }}
              >
                Begin Your AI Experience
              </Button>
            </MotionBox>
          </VStack>

          {/* Right column with visual element */}
          <MotionBox
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            w={{ base: "full", lg: "50%" }}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <Box
              position="relative"
              width="full"
              height={{ base: "300px", md: "450px" }}
              borderRadius="2xl"
              overflow="hidden"
              boxShadow="2xl"
              sx={{
                animation: `${glow} 5s infinite ease-in-out`,
              }}
            >
              {/* Main image or visualization - replaced with embedded SVG */}
              <Box
                width="100%"
                height="100%"
                position="relative"
                display="flex"
                alignItems="center"
                justifyContent="center"
                bg={useColorModeValue("gray.100", "gray.900")}
                overflow="hidden"
              >
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 900 600"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* Removing background elements entirely */}

                  {/* Email dashboard frame - larger and centered */}
                  <rect
                    x="100"
                    y="70"
                    width="700"
                    height="460"
                    rx="16"
                    fill={useColorModeValue("#805AD5", "#553C9A")}
                  />
                  <rect
                    x="110"
                    y="105"
                    width="680"
                    height="415"
                    rx="12"
                    fill={useColorModeValue("#F5F0FF", "#1A202C")}
                  />

                  {/* Email sidebar */}
                  <rect
                    x="110"
                    y="105"
                    width="210"
                    height="415"
                    fill={useColorModeValue("#E9D8FD", "#2D3748")}
                    opacity="0.9"
                  />

                  {/* Application title */}
                  <rect
                    x="130"
                    y="125"
                    width="170"
                    height="20"
                    rx="3"
                    fill={useColorModeValue("#805AD5", "#9F7AEA")}
                    opacity="0.9"
                  />
                  <circle
                    cx="150"
                    cy="135"
                    r="10"
                    fill={useColorModeValue("#6B46C1", "#B794F4")}
                  />

                  {/* Sidebar menu items - purple tones */}
                  <rect
                    x="130"
                    y="175"
                    width="170"
                    height="14"
                    rx="3"
                    fill={useColorModeValue("#805AD5", "#9F7AEA")}
                    opacity="0.9"
                  />
                  <rect
                    x="130"
                    y="210"
                    width="150"
                    height="12"
                    rx="3"
                    fill={useColorModeValue("#6B46C1", "#B794F4")}
                    opacity="0.8"
                  />
                  <rect
                    x="130"
                    y="245"
                    width="160"
                    height="12"
                    rx="3"
                    fill={useColorModeValue("#6B46C1", "#B794F4")}
                    opacity="0.8"
                  />
                  <rect
                    x="130"
                    y="280"
                    width="140"
                    height="12"
                    rx="3"
                    fill={useColorModeValue("#6B46C1", "#B794F4")}
                    opacity="0.8"
                  />
                  <rect
                    x="130"
                    y="315"
                    width="155"
                    height="12"
                    rx="3"
                    fill={useColorModeValue("#6B46C1", "#B794F4")}
                    opacity="0.8"
                  />

                  {/* Category labels */}
                  <text
                    x="130"
                    y="370"
                    fill={useColorModeValue("#2D3748", "#E2E8F0")}
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="system-ui, sans-serif"
                  >
                    CATEGORIES
                  </text>
                  <rect
                    x="130"
                    y="385"
                    width="60"
                    height="22"
                    rx="11"
                    fill={useColorModeValue("#38B2AC", "#319795")}
                    opacity="0.8"
                  />
                  <rect
                    x="200"
                    y="385"
                    width="60"
                    height="22"
                    rx="11"
                    fill={useColorModeValue("#ED8936", "#DD6B20")}
                    opacity="0.8"
                  />
                  <rect
                    x="130"
                    y="415"
                    width="60"
                    height="22"
                    rx="11"
                    fill={useColorModeValue("#805AD5", "#6B46C1")}
                    opacity="0.8"
                  />
                  <rect
                    x="200"
                    y="415"
                    width="60"
                    height="22"
                    rx="11"
                    fill={useColorModeValue("#9F7AEA", "#805AD5")}
                    opacity="0.8"
                  />

                  {/* Email header */}
                  <rect
                    x="340"
                    y="125"
                    width="430"
                    height="35"
                    rx="4"
                    fill={useColorModeValue("#F5F0FF", "#2D3748")}
                    opacity="0.8"
                  />
                  <rect
                    x="360"
                    y="137"
                    width="200"
                    height="12"
                    rx="2"
                    fill={useColorModeValue("#6B46C1", "#EDF2F7")}
                  />
                  <circle
                    cx="740"
                    cy="142"
                    r="10"
                    fill={useColorModeValue("#805AD5", "#9F7AEA")}
                  />

                  {/* Email list - vibrant content */}
                  <rect
                    x="340"
                    y="175"
                    width="430"
                    height="80"
                    rx="4"
                    fill={useColorModeValue("#F5F0FF", "#2D3748")}
                  />
                  <rect
                    x="360"
                    y="195"
                    width="250"
                    height="14"
                    rx="2"
                    fill={useColorModeValue("#6B46C1", "#EDF2F7")}
                  />
                  <rect
                    x="360"
                    y="220"
                    width="390"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.9"
                  />
                  <rect
                    x="360"
                    y="240"
                    width="350"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.7"
                  />

                  <rect
                    x="340"
                    y="270"
                    width="430"
                    height="80"
                    rx="4"
                    fill={useColorModeValue("#F5F0FF", "#2D3748")}
                  />
                  <rect
                    x="360"
                    y="290"
                    width="230"
                    height="14"
                    rx="2"
                    fill={useColorModeValue("#6B46C1", "#EDF2F7")}
                  />
                  <rect
                    x="360"
                    y="315"
                    width="390"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.9"
                  />
                  <rect
                    x="360"
                    y="335"
                    width="350"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.7"
                  />

                  <rect
                    x="340"
                    y="365"
                    width="430"
                    height="80"
                    rx="4"
                    fill={useColorModeValue("#F5F0FF", "#2D3748")}
                  />
                  <rect
                    x="360"
                    y="385"
                    width="270"
                    height="14"
                    rx="2"
                    fill={useColorModeValue("#6B46C1", "#EDF2F7")}
                  />
                  <rect
                    x="360"
                    y="410"
                    width="390"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.9"
                  />
                  <rect
                    x="360"
                    y="430"
                    width="350"
                    height="10"
                    rx="2"
                    fill={useColorModeValue("#805AD5", "#A0AEC0")}
                    opacity="0.7"
                  />

                  {/* Neural circuit animations - more vibrant */}
                  <path
                    d="M340 480 L440 480 L460 460 L540 460 L560 480 L640 480"
                    stroke={useColorModeValue("#6B46C1", "#B794F4")}
                    strokeWidth="3"
                    opacity="0.9"
                    strokeDasharray="6,4"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="100"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </path>

                  <path
                    d="M640 175 L590 175 L570 195 L490 195 L470 175 L390 175"
                    stroke={useColorModeValue("#805AD5", "#D6BCFA")}
                    strokeWidth="3"
                    opacity="0.9"
                    strokeDasharray="6,4"
                  >
                    <animate
                      attributeName="stroke-dashoffset"
                      from="0"
                      to="-100"
                      dur="4s"
                      repeatCount="indefinite"
                    />
                  </path>

                  {/* AI status indicators - brighter and more vibrant */}
                  <circle
                    cx="740"
                    cy="365"
                    r="15"
                    fill="url(#purple-pulse-bright)"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.7;1;0.7"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  <circle
                    cx="740"
                    cy="415"
                    r="10"
                    fill="url(#purple-pulse-bright2)"
                  >
                    <animate
                      attributeName="opacity"
                      values="0.7;1;0.7"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* AI Brain icon - purple colors */}
                  <g transform="translate(680, 480) scale(0.6)">
                    <path
                      d="M50 20 C80 10, 70 0, 100 0 C130 0, 120 10, 150 20 C160 30, 160 40, 150 50 C180 60, 180 80, 150 90 C160 100, 160 110, 150 120 C120 130, 130 140, 100 140 C70 140, 80 130, 50 120 C40 110, 40 100, 50 90 C20 80, 20 60, 50 50 C40 40, 40 30, 50 20Z"
                      fill="url(#brain-gradient-purple)"
                      opacity="0.9"
                    >
                      <animate
                        attributeName="opacity"
                        values="0.8;1;0.8"
                        dur="4s"
                        repeatCount="indefinite"
                      />
                    </path>
                    <path
                      d="M100 20 L100 50 M100 70 L100 90 M100 110 L100 120 M70 40 L130 40 M60 70 L140 70 M70 100 L130 100"
                      stroke={useColorModeValue("#805AD5", "#B794F4")}
                      strokeWidth="3"
                      opacity="0.9"
                    />
                  </g>

                  {/* Define purple gradients */}
                  <defs>
                    <linearGradient
                      id="purple-gradient"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        stopColor={useColorModeValue("#9F7AEA", "#805AD5")}
                      />
                      <stop
                        offset="100%"
                        stopColor={useColorModeValue("#6B46C1", "#553C9A")}
                      />
                    </linearGradient>

                    <radialGradient
                      id="purple-pulse-bright"
                      cx="50%"
                      cy="50%"
                      r="50%"
                      fx="50%"
                      fy="50%"
                    >
                      <stop
                        offset="0%"
                        stopColor={useColorModeValue("#D6BCFA", "#B794F4")}
                      />
                      <stop
                        offset="100%"
                        stopColor={useColorModeValue("#805AD5", "#6B46C1")}
                      />
                    </radialGradient>

                    <radialGradient
                      id="purple-pulse-bright2"
                      cx="50%"
                      cy="50%"
                      r="50%"
                      fx="50%"
                      fy="50%"
                    >
                      <stop
                        offset="0%"
                        stopColor={useColorModeValue("#E9D8FD", "#D6BCFA")}
                      />
                      <stop
                        offset="100%"
                        stopColor={useColorModeValue("#9F7AEA", "#805AD5")}
                      />
                    </radialGradient>

                    <linearGradient
                      id="brain-gradient-purple"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop
                        offset="0%"
                        stopColor={useColorModeValue("#9F7AEA", "#805AD5")}
                      />
                      <stop
                        offset="50%"
                        stopColor={useColorModeValue("#805AD5", "#6B46C1")}
                      />
                      <stop
                        offset="100%"
                        stopColor={useColorModeValue("#D6BCFA", "#B794F4")}
                      />
                    </linearGradient>
                  </defs>
                </svg>
              </Box>
            </Box>
          </MotionBox>
        </Stack>
      </Container>
    </Box>
  );
};

export default HeroSection;
