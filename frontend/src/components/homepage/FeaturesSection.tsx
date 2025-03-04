import React, { useRef } from "react";
import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  SimpleGrid,
  VStack,
  Icon,
  useColorModeValue,
  HStack,
  Divider,
  Tag,
  Code,
  Badge,
  chakra,
  shouldForwardProp,
} from "@chakra-ui/react";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { isValidMotionProp } from "framer-motion";
import {
  FaChartLine,
  FaRobot,
  FaShieldAlt,
  FaBrain,
  FaFingerprint,
  FaNetworkWired,
  FaMagic,
  FaAtom,
  FaLightbulb,
  FaMicrochip,
  FaCircle,
} from "react-icons/fa";
import { keyframes } from "@emotion/react";

// Create Chakra-Framer-Motion components
const ChakraBox = chakra(motion.div, {
  shouldForwardProp: (prop) =>
    isValidMotionProp(prop) || shouldForwardProp(prop),
});

// Animation keyframes
const float = keyframes`
  0% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(1deg); }
  100% { transform: translateY(0) rotate(0deg); }
`;

const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.4); }
  70% { box-shadow: 0 0 0 15px rgba(66, 153, 225, 0); }
  100% { box-shadow: 0 0 0 0 rgba(66, 153, 225, 0); }
`;

const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
  hover: {
    y: -10,
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    transition: { duration: 0.3 },
  },
};

// Particle component for background effect
interface ParticleProps {
  size: number;
  color: string;
  top: string;
  left: string;
  delay: number;
  duration: number;
}

const Particle = ({
  size,
  color,
  top,
  left,
  delay,
  duration,
}: ParticleProps) => (
  <ChakraBox
    position="absolute"
    width={`${size}px`}
    height={`${size}px`}
    borderRadius="full"
    bg={color}
    top={top}
    left={left}
    opacity="0.3"
    initial={{ y: 0, opacity: 0.2 }}
    animate={{
      y: [0, -100, 0],
      opacity: [0.2, 0.8, 0.2],
      scale: [1, 1.2, 1],
    }}
    transition={{
      duration: duration,
      delay: delay,
      ease: "easeInOut",
    }}
  />
);

// TypeScript interfaces
interface Feature {
  icon: any;
  secondaryIcon: any;
  title: string;
  description: string;
  color: string;
  tag: string;
  codeSnippet: string;
}

const FeaturesSection = () => {
  // References for scroll animations
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const headerOpacity = useTransform(scrollYProgress, [0, 0.2], [0.6, 1]);
  const headerY = useTransform(scrollYProgress, [0, 0.2], [50, 0]);

  // Define colors
  const cardBg = useColorModeValue("white", "gray.800");
  const cardBorder = useColorModeValue("gray.100", "gray.700");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const headingColor = useColorModeValue("gray.800", "white");
  const sectionBg = useColorModeValue("gray.50", "gray.900");
  const codeBg = useColorModeValue("gray.50", "gray.700");
  const codeColor = useColorModeValue("blue.800", "blue.200");

  // Features data
  const features: Feature[] = [
    {
      icon: FaBrain,
      secondaryIcon: FaMicrochip,
      title: "Quantum Neural Processing",
      description:
        "Our lattice-based neural architecture leverages quantum algorithms to process your communication patterns at unprecedented speed, enabling real-time hyper-personalization.",
      color: "blue.400",
      tag: "QUANTUM AI",
      codeSnippet: "EmailLLM.process(user.patterns, context)",
    },
    {
      icon: FaRobot,
      secondaryIcon: FaLightbulb,
      title: "Synthetic Intelligence Layer",
      description:
        "Self-evolving algorithms that autonomously refine their understanding of your communication style, creating a symbiotic relationship between your intentions and automated actions.",
      color: "purple.400",
      tag: "SYMBIOTIC ML",
      codeSnippet: "SyntLayer.adapt(user_style, 0.9523)",
    },
    {
      icon: FaNetworkWired,
      secondaryIcon: FaCircle,
      title: "Neuromorphic Network Fabric",
      description:
        "A biomimetic processing grid that identifies key relationship patterns and constructs a multidimensional vector space of your professional connections.",
      color: "teal.400",
      tag: "MULTI-VECTOR MAPPING",
      codeSnippet: "NeuralGraph.embed(connections, 512)",
    },
    {
      icon: FaFingerprint,
      secondaryIcon: FaAtom,
      title: "Cognitive Signature Matrix",
      description:
        "Your unique digital fingerprint evolves through continuous learning, creating a cognitive extension that authentically represents your professional identity.",
      color: "orange.400",
      tag: "COGNITIVE EXTENSION",
      codeSnippet: "CogSig.generate(user.history, depth=12)",
    },
    {
      icon: FaMagic,
      secondaryIcon: FaLightbulb,
      title: "Predictive Intention Engine",
      description:
        "Our bayesian inference framework anticipates communication needs before they arise, providing contextually relevant suggestions with 97.3% accuracy.",
      color: "pink.400",
      tag: "BAYESIAN INTELLIGENCE",
      codeSnippet: "IntentEngine.predict(p=0.973)",
    },
    {
      icon: FaShieldAlt,
      secondaryIcon: FaCircle,
      title: "Zero-Knowledge Security Mesh",
      description:
        "End-to-end homomorphic encryption with post-quantum cryptography ensures your data remains private while still enabling our AI to learn from patterns.",
      color: "green.400",
      tag: "HOMOMORPHIC ENCRYPTION",
      codeSnippet: "ZKSecurity.encrypt(user.data, PQ_KEY)",
    },
  ];

  return (
    <Box
      py={24}
      position="relative"
      bg={sectionBg}
      overflow="hidden"
      ref={containerRef}
    >
      {/* Dynamic background elements */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        opacity="0.03"
        backgroundImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIwMjAyMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')"
        zIndex={0}
      />

      {/* Animated particles */}
      <Box position="absolute" width="100%" height="100%" zIndex={0}>
        {Array.from({ length: 20 }).map((_, i) => (
          <Particle
            key={i}
            size={Math.random() * 8 + 2}
            color={
              i % 2 === 0 ? "blue.400" : i % 3 === 0 ? "purple.400" : "teal.400"
            }
            top={`${Math.random() * 100}%`}
            left={`${Math.random() * 100}%`}
            delay={Math.random() * 5}
            duration={Math.random() * 10 + 15}
          />
        ))}
      </Box>

      {/* Gradient orbs for background effect */}
      <Box
        position="absolute"
        top="20%"
        right="-10%"
        width="40%"
        height="40%"
        borderRadius="full"
        bg="blue.400"
        filter="blur(150px)"
        opacity="0.07"
        zIndex={0}
        animation={`${float} 25s infinite ease-in-out`}
      />

      <Box
        position="absolute"
        bottom="10%"
        left="-5%"
        width="30%"
        height="30%"
        borderRadius="full"
        bg="purple.400"
        filter="blur(130px)"
        opacity="0.05"
        zIndex={0}
        animation={`${float} 20s 2s infinite ease-in-out`}
      />

      <Container maxW="container.xl" position="relative" zIndex={2}>
        <ChakraBox style={{ opacity: headerOpacity, y: headerY }} mb={20}>
          <VStack spacing={6} textAlign="center" maxW="container.md" mx="auto">
            <Badge
              px={3}
              py={2}
              colorScheme="blue"
              variant="subtle"
              rounded="full"
              fontSize="sm"
              textTransform="uppercase"
              fontWeight="bold"
              letterSpacing="wider"
              bgGradient="linear(to-r, blue.100, purple.100)"
              color={useColorModeValue("blue.800", "blue.200")}
            >
              Cutting-Edge Intelligence
            </Badge>

            <Heading
              as="h2"
              fontSize={{ base: "4xl", lg: "5xl" }}
              fontWeight="extrabold"
              lineHeight="1.2"
              bgGradient="linear(to-r, blue.400, purple.500, teal.400)"
              bgClip="text"
              letterSpacing="tight"
              sx={{
                animation: `${gradientShift} 8s ease infinite`,
                backgroundSize: "300% 100%",
              }}
            >
              Advanced Neural Technology
            </Heading>

            <Text fontSize="xl" color={textColor} maxW="2xl">
              Our proprietary AI system operates at the intersection of natural
              language processing, cognitive computing, and deep learning to
              revolutionize how professionals manage communication.
            </Text>

            <Box
              width="80px"
              height="4px"
              bgGradient="linear(to-r, blue.400, purple.500)"
              borderRadius="full"
              mt={4}
              animation={`${pulse} 2s infinite`}
            />
          </VStack>
        </ChakraBox>

        <ChakraBox
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 3 }}
            spacing={{ base: 10, lg: 14 }}
            mt={16}
          >
            {features.map((feature, index) => (
              <ChakraBox
                key={index}
                variants={itemVariants}
                whileHover="hover"
                position="relative"
                height="100%"
                borderRadius="2xl"
                overflow="hidden"
                transition="all 0.3s"
              >
                {/* Glowing border effect */}
                <Box
                  position="absolute"
                  top="0"
                  left="0"
                  right="0"
                  bottom="0"
                  borderRadius="2xl"
                  padding="1px"
                  bgGradient={`linear(to-br, ${feature.color}, purple.500)`}
                  sx={{
                    animation: `${gradientShift} 4s ease infinite`,
                    backgroundSize: "200% 200%",
                  }}
                />

                <Flex
                  direction="column"
                  bg={cardBg}
                  borderRadius="2xl"
                  p={8}
                  position="relative"
                  height="100%"
                  zIndex={1}
                >
                  {/* Top tag and icons */}
                  <HStack justifyContent="space-between" mb={6}>
                    <Tag
                      size="sm"
                      variant="subtle"
                      bg={`${feature.color}20`}
                      color={feature.color}
                      fontFamily="mono"
                      fontWeight="bold"
                      px={3}
                      py={1}
                      borderRadius="full"
                    >
                      {feature.tag}
                    </Tag>

                    <HStack spacing={2}>
                      <Circle
                        icon={feature.secondaryIcon}
                        color={feature.color}
                        size="32px"
                      />
                      <Circle
                        icon={feature.icon}
                        color={feature.color}
                        size="40px"
                      />
                    </HStack>
                  </HStack>

                  {/* Content */}
                  <VStack align="flex-start" spacing={4}>
                    <Heading
                      as="h3"
                      fontSize="2xl"
                      color={headingColor}
                      fontWeight="bold"
                      _after={{
                        content: '""',
                        display: "block",
                        width: "40px",
                        height: "3px",
                        mt: 2,
                        bg: feature.color,
                        borderRadius: "full",
                      }}
                    >
                      {feature.title}
                    </Heading>

                    <Text color={textColor}>{feature.description}</Text>

                    <Code
                      colorScheme="blue"
                      bg={codeBg}
                      color={codeColor}
                      p={3}
                      borderRadius="md"
                      fontSize="sm"
                      fontFamily="mono"
                      width="100%"
                    >
                      {feature.codeSnippet}
                    </Code>
                  </VStack>

                  {/* Corner decorative element */}
                  <Box
                    position="absolute"
                    bottom={4}
                    right={4}
                    width="60px"
                    height="60px"
                    opacity={0.1}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        stroke="currentColor"
                        strokeWidth="2"
                        fill="none"
                      />
                      <path
                        d="M30,50 L70,50"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M50,30 L50,70"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="10"
                        fill="currentColor"
                        opacity="0.5"
                      />
                    </svg>
                  </Box>
                </Flex>
              </ChakraBox>
            ))}
          </SimpleGrid>
        </ChakraBox>

        {/* Bottom code-like element for extra futuristic feel */}
        <ChakraBox
          maxW="lg"
          mx="auto"
          mt={20}
          p={4}
          bg={codeBg}
          borderRadius="lg"
          fontFamily="mono"
          fontSize="xs"
          color={codeColor}
          textAlign="center"
          opacity="0.8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 0.8 }}
          viewport={{ once: true }}
        >
          <Text>
            neural_engine.initialize(version=4.2.1) # Advanced inference system
            active
          </Text>
        </ChakraBox>
      </Container>
    </Box>
  );
};

// Helper component for icon circles
const Circle = ({ icon, color, size }) => (
  <Flex
    width={size}
    height={size}
    borderRadius="full"
    align="center"
    justify="center"
    bg={`${color}15`}
    color={color}
    border="1px solid"
    borderColor={`${color}30`}
    boxShadow={`0 0 15px ${color}30`}
  >
    <Icon as={icon} boxSize={size === "40px" ? 5 : 4} />
  </Flex>
);

export default FeaturesSection;
