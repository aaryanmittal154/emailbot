import React from "react";
import {
  Box,
  Container,
  Flex,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useColorModeValue,
  Icon,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FaClock, FaRobot, FaUserFriends, FaChartLine } from "react-icons/fa";
import { keyframes } from "@emotion/react";

// Define animation keyframes
const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.03); }
  100% { transform: scale(1); }
`;

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
};

const MotionBox = motion(Box);

const StatisticsSection = () => {
  const bg = useColorModeValue("blue.50", "gray.800");
  const statBg = useColorModeValue("white", "gray.700");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const headingColor = useColorModeValue("gray.800", "white");
  const accentColor = useColorModeValue("blue.500", "blue.300");
  const iconBg = useColorModeValue("blue.100", "blue.900");

  const stats = [
    {
      id: 1,
      label: "Time Saved Weekly",
      value: "7.8 hrs",
      icon: FaClock,
      description: "Average time saved per user with our AI email management",
    },
    {
      id: 2,
      label: "Neural Parameters",
      value: "1.2B+",
      icon: FaRobot,
      description: "Advanced neural network powering email intelligence",
    },
    {
      id: 3,
      label: "Active Users",
      value: "24,000+",
      icon: FaUserFriends,
      description: "Professionals using our AI assistant daily",
    },
    {
      id: 4,
      label: "Efficiency Gain",
      value: "41%",
      icon: FaChartLine,
      description: "Average increase in email productivity",
    },
  ];

  return (
    <Box py={24} bg={bg} position="relative" overflow="hidden">
      {/* Grid background for futuristic feel */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        opacity="0.03"
        zIndex={0}
        bgImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzIwMjAyMCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')"
      />

      {/* Decorative elements */}
      <Box
        position="absolute"
        top="-5%"
        right="-5%"
        width="300px"
        height="300px"
        borderRadius="full"
        bg="blue.400"
        filter="blur(80px)"
        opacity="0.1"
        zIndex={0}
      />

      <Box
        position="absolute"
        bottom="-10%"
        left="-10%"
        width="400px"
        height="400px"
        borderRadius="full"
        bg="purple.400"
        filter="blur(100px)"
        opacity="0.07"
        zIndex={0}
      />

      <Container maxW="container.xl" position="relative" zIndex={1}>
        <VStack spacing={16}>
          <MotionBox
            initial={{ opacity: 0, y: -20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true }}
            textAlign="center"
            maxW="800px"
            mx="auto"
          >
            <Heading
              as="h2"
              size="xl"
              fontWeight="bold"
              mb={6}
              color={headingColor}
              lineHeight="1.2"
            >
              Transforming Email Management with{" "}
              <Text
                as="span"
                bgGradient="linear(to-r, blue.400, purple.500, blue.500)"
                bgClip="text"
                fontWeight="extrabold"
              >
                Advanced AI Technology
              </Text>
            </Heading>
            <Text fontSize="lg" color={textColor} lineHeight="tall">
              Our neural networks process thousands of emails every second,
              learning and adapting to your communication patterns. The result
              is a truly intelligent assistant that saves you time and enhances
              your productivity.
            </Text>
          </MotionBox>

          <SimpleGrid
            columns={{ base: 1, md: 2, lg: 4 }}
            spacing={8}
            width="full"
          >
            {stats.map((stat, index) => (
              <MotionBox
                key={stat.id}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
                variants={fadeInUp}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Flex
                  direction="column"
                  align="center"
                  p={8}
                  bg={statBg}
                  boxShadow="lg"
                  borderRadius="2xl"
                  border="1px solid"
                  borderColor={useColorModeValue("gray.100", "gray.700")}
                  position="relative"
                  overflow="hidden"
                  height="100%"
                  _hover={{
                    transform: "translateY(-5px)",
                    boxShadow: "xl",
                    borderColor: useColorModeValue("blue.200", "blue.500"),
                  }}
                  transition="all 0.3s"
                >
                  <Box
                    position="absolute"
                    top={0}
                    left={0}
                    height="4px"
                    width="100%"
                    bgGradient="linear(to-r, blue.400, purple.500)"
                  />

                  <Box
                    width="60px"
                    height="60px"
                    bg={iconBg}
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    mb={4}
                    sx={{
                      animation: `${pulse} 3s infinite ease-in-out`,
                    }}
                  >
                    <Icon as={stat.icon} w={6} h={6} color={accentColor} />
                  </Box>

                  <Stat textAlign="center">
                    <StatLabel
                      fontSize="md"
                      fontWeight="semibold"
                      color={textColor}
                      mb={2}
                    >
                      {stat.label}
                    </StatLabel>
                    <StatNumber
                      fontSize="4xl"
                      fontWeight="bold"
                      color={headingColor}
                      mb={3}
                      letterSpacing="tight"
                    >
                      {stat.value}
                    </StatNumber>
                    <Text
                      fontSize="sm"
                      color={textColor}
                      mt={2}
                      fontWeight="medium"
                      lineHeight="short"
                    >
                      {stat.description}
                    </Text>
                  </Stat>
                </Flex>
              </MotionBox>
            ))}
          </SimpleGrid>

          <MotionBox
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            viewport={{ once: true }}
            width="100%"
            maxW="900px"
            mx="auto"
            mt={8}
          >
            <Box
              p={6}
              borderRadius="xl"
              bg={useColorModeValue("blue.50", "blue.900")}
              borderWidth="1px"
              borderColor={useColorModeValue("blue.100", "blue.700")}
              textAlign="center"
            >
              <Text
                fontSize="lg"
                fontStyle="italic"
                color={useColorModeValue("gray.700", "gray.300")}
              >
                "Our AI model trains on over 10 million email interactions
                daily, ensuring our algorithms stay at the cutting edge of
                natural language processing technology."
              </Text>
              <Text
                mt={4}
                fontWeight="bold"
                color={useColorModeValue("gray.800", "white")}
              >
                — Our Lead AI Scientist
              </Text>
            </Box>
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
};

export default StatisticsSection;
