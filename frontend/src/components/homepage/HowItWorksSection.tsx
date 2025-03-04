import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  useColorModeValue,
  Icon,
  Circle,
  Divider,
  SimpleGrid,
  Stack,
  Badge,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";
import { FaPlug, FaDatabase, FaLaptopCode, FaRobot, FaBrain, FaChartLine } from "react-icons/fa";

// Step interface
interface Step {
  number: number;
  title: string;
  description: string;
  icon: any;
  color: string;
  secondaryIcon: any;
}

// Animation variants
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.3,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } }
};

// Animation keyframes
const pulse = keyframes`
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.05); opacity: 1; }
  100% { transform: scale(1); opacity: 0.8; }
`;

const MotionBox = motion(Box);
const MotionVStack = motion(VStack);
const MotionCircle = motion(Circle);

const HowItWorksSection = () => {
  // Colors
  const bgColor = useColorModeValue("white", "gray.800");
  const titleColor = useColorModeValue("gray.800", "white");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const dividerColor = useColorModeValue("gray.200", "gray.600");
  const pulseAnimation = `${pulse} 3s infinite`;

  // Steps data
  const steps: Step[] = [
    {
      number: 1,
      title: "Connect Securely",
      description: "Integrate with your email provider through OAuth 2.0 protocol. Zero credentials stored, only secure tokens with minimized permission scope.",
      icon: FaPlug,
      color: "blue.500",
      secondaryIcon: FaDatabase,
    },
    {
      number: 2,
      title: "Neural Processing",
      description: "Our AI begins analyzing your communication patterns, generating an intelligent model of your email behavior and preferences.",
      icon: FaBrain,
      color: "purple.500",
      secondaryIcon: FaChartLine,
    },
    {
      number: 3,
      title: "Experience Augmentation",
      description: "The system activates personalized AI features, enhancing your productivity through intelligent automation and insights.",
      icon: FaRobot,
      color: "teal.500",
      secondaryIcon: FaLaptopCode,
    }
  ];

  return (
    <Box py={24} bg={bgColor} position="relative" overflow="hidden">
      {/* Decorative background elements */}
      <Box
        position="absolute"
        top="0"
        left="0"
        right="0"
        height="100%"
        opacity="0.03"
        zIndex={0}
        bgImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAgMGg2MHY2MEgweiIgZmlsbD0ibm9uZSIvPgo8Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPGNpcmNsZSBjeD0iMTUiIGN5PSIzMCIgcj0iMSIgZmlsbD0iY3VycmVudENvbG9yIi8+CjxjaXJjbGUgY3g9IjQ1IiBjeT0iMzAiIHI9IjEiIGZpbGw9ImN1cnJlbnRDb2xvciIvPgo8Y2lyY2xlIGN4PSIzMCIgY3k9IjE1IiByPSIxIiBmaWxsPSJjdXJyZW50Q29sb3IiLz4KPGNpcmNsZSBjeD0iMzAiIGN5PSI0NSIgcj0iMSIgZmlsbD0iY3VycmVudENvbG9yIi8+Cjwvc3ZnPg==')"
        backgroundSize="60px 60px"
      />

      <Container maxW="container.xl" position="relative" zIndex={1}>
        <VStack spacing={20}>
          {/* Section header */}
          <VStack spacing={6} textAlign="center" maxW="container.md" mx="auto">
            <Badge
              px={4}
              py={2}
              colorScheme="blue"
              fontWeight="bold"
              borderRadius="full"
              textTransform="uppercase"
              letterSpacing="wider"
              fontSize="xs"
            >
              Streamlined Process
            </Badge>

            <Heading
              as="h2"
              size="3xl"
              fontWeight="bold"
              color={titleColor}
              lineHeight="1.2"
              bgGradient="linear(to-r, blue.400, purple.400)"
              bgClip="text"
            >
              Intelligent Integration
            </Heading>

            <Text fontSize="xl" color={textColor} maxW="2xl">
              Our advanced system integrates seamlessly with your existing workflow,
              requiring minimal setup while delivering maximum impact.
            </Text>
          </VStack>

          {/* Steps for desktop */}
          <MotionVStack
            spacing={0}
            width="100%"
            display={{ base: "none", md: "flex" }}
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Flex width="100%" position="relative" height="300px">
              {/* Central connector line */}
              <Divider
                orientation="horizontal"
                position="absolute"
                top="50%"
                left="5%"
                width="90%"
                borderColor={dividerColor}
                borderWidth="2px"
                borderStyle="dashed"
                zIndex={0}
              />

              <Stack
                direction="row"
                width="100%"
                spacing={0}
                justify="space-between"
                position="relative"
                zIndex={1}
              >
                {steps.map((step, index) => (
                  <MotionBox
                    key={index}
                    variants={item}
                    width="33.333%"
                    position="relative"
                  >
                    <VStack spacing={6}>
                      {/* Step number circle */}
                      <MotionCircle
                        size="80px"
                        bg={step.color}
                        color="white"
                        fontWeight="bold"
                        fontSize="3xl"
                        boxShadow="xl"
                        position="relative"
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.2 }}
                      >
                        {step.number}

                        {/* Pulsing ring */}
                        <Circle
                          size="100px"
                          position="absolute"
                          border="1px solid"
                          borderColor={step.color}
                          opacity={0.6}
                          sx={{ animation: pulseAnimation }}
                        />
                      </MotionCircle>

                      {/* Secondary tech icon */}
                      <Circle
                        size="40px"
                        bg={useColorModeValue("white", "gray.700")}
                        color={step.color}
                        boxShadow="md"
                        position="absolute"
                        top="0"
                        right={{ base: '20%', lg: '30%' }}
                        zIndex={2}
                      >
                        <Icon as={step.secondaryIcon} boxSize={5} />
                      </Circle>

                      <VStack
                        spacing={3}
                        maxW="280px"
                        mx="auto"
                        textAlign="center"
                        mt={6}
                      >
                        <Flex
                          align="center"
                          justify="center"
                          width="50px"
                          height="50px"
                          bg={`${step.color}15`}
                          color={step.color}
                          borderRadius="xl"
                          mb={2}
                        >
                          <Icon as={step.icon} boxSize={6} />
                        </Flex>

                        <Heading
                          as="h3"
                          size="lg"
                          color={titleColor}
                          fontWeight="bold"
                        >
                          {step.title}
                        </Heading>

                        <Text color={textColor}>
                          {step.description}
                        </Text>
                      </VStack>
                    </VStack>
                  </MotionBox>
                ))}
              </Stack>
            </Flex>
          </MotionVStack>

          {/* Mobile version */}
          <SimpleGrid
            columns={1}
            spacing={16}
            width="100%"
            display={{ base: "grid", md: "none" }}
          >
            {steps.map((step, index) => (
              <Box
                key={index}
                position="relative"
              >
                {/* Vertical connector */}
                {index < steps.length - 1 && (
                  <Box
                    position="absolute"
                    top="80px"
                    left="40px"
                    height="calc(100% + 60px)"
                    width="2px"
                    bg={dividerColor}
                    borderLeftWidth="2px"
                    borderStyle="dashed"
                    borderColor={dividerColor}
                    zIndex={0}
                  />
                )}

                <HStack spacing={6} align="flex-start" position="relative">
                  <MotionCircle
                    size="80px"
                    bg={step.color}
                    color="white"
                    fontWeight="bold"
                    fontSize="3xl"
                    boxShadow="xl"
                    flexShrink={0}
                    zIndex={1}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    {step.number}
                  </MotionCircle>

                  <Circle
                    size="40px"
                    bg={useColorModeValue("white", "gray.700")}
                    color={step.color}
                    boxShadow="md"
                    position="absolute"
                    left="70px"
                    top="0"
                    zIndex={2}
                  >
                    <Icon as={step.secondaryIcon} boxSize={5} />
                  </Circle>

                  <VStack align="flex-start" spacing={4}>
                    <Flex
                      align="center"
                      justify="center"
                      width="50px"
                      height="50px"
                      bg={`${step.color}15`}
                      color={step.color}
                      borderRadius="xl"
                      mb={1}
                    >
                      <Icon as={step.icon} boxSize={6} />
                    </Flex>

                    <Heading as="h3" size="lg" color={titleColor} fontWeight="bold">
                      {step.title}
                    </Heading>

                    <Text color={textColor}>
                      {step.description}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ))}
          </SimpleGrid>
        </VStack>
      </Container>
    </Box>
  );
};

export default HowItWorksSection;
