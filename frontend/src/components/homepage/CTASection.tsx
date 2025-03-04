import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  useColorModeValue,
  Icon,
  Highlight,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { keyframes } from "@emotion/react";
import { FaRobot, FaArrowRight } from "react-icons/fa";

// Helper function for infinite repeats that satisfies Framer Motion's type requirements
const infiniteRepeat = () => {
  const repeatFn = (count: number) => "Infinity";
  return repeatFn;
};

// Animation keyframes
const float = keyframes`
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-20px) rotate(5deg); }
  100% { transform: translateY(0px) rotate(0deg); }
`;

const glow = keyframes`
  0% { box-shadow: 0 0 10px rgba(66, 153, 225, 0.3); }
  50% { box-shadow: 0 0 30px rgba(159, 122, 234, 0.7); }
  100% { box-shadow: 0 0 10px rgba(66, 153, 225, 0.3); }
`;

const MotionBox = motion(Box);

interface CTASectionProps {
  onLogin: () => void;
  isLoading: boolean;
}

const CTASection = ({ onLogin, isLoading }: CTASectionProps) => {
  // Colors
  const bgColor = useColorModeValue("gray.900", "gray.900");
  const textColor = useColorModeValue("gray.100", "gray.100");
  const buttonBg = useColorModeValue("blue.400", "blue.400");

  return (
    <Box
      py={32}
      bg={bgColor}
      position="relative"
      overflow="hidden"
      color={textColor}
    >
      {/* Background grid pattern */}
      <Box
        position="absolute"
        top="0"
        right="0"
        bottom="0"
        left="0"
        opacity="0.05"
        zIndex={0}
        bgImage="url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgeD0iMCIgeT0iMCIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjAuNSIgLz48L3N2Zz4=')"
        backgroundSize="20px 20px"
      />

      {/* Decorative glowing orbs */}
      <Box
        position="absolute"
        top="20%"
        left="5%"
        width="200px"
        height="200px"
        borderRadius="full"
        bg="blue.500"
        filter="blur(80px)"
        opacity="0.2"
        zIndex={0}
      />

      <Box
        position="absolute"
        bottom="10%"
        right="10%"
        width="300px"
        height="300px"
        borderRadius="full"
        bg="purple.500"
        filter="blur(120px)"
        opacity="0.15"
        zIndex={0}
      />

      <Container maxW="container.lg" position="relative" zIndex={1}>
        <Flex
          direction="column"
          align="center"
          textAlign="center"
          position="relative"
        >
          {/* AI Robot Icon with animation */}
          <MotionBox
            initial={{ y: 0 }}
            animate={{
              y: [0, -20, 0],
            }}
            transition={{
              repeat: infiniteRepeat(),
              repeatType: "reverse",
              duration: 4,
            }}
            mb={10}
          >
            <Box
              width="100px"
              height="100px"
              bg="rgba(66, 153, 225, 0.1)"
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="2px solid rgba(66, 153, 225, 0.3)"
              boxShadow="0 0 20px rgba(66, 153, 225, 0.5)"
              sx={{
                animation: `${glow} 3s infinite`,
              }}
            >
              <Icon as={FaRobot} w={12} h={12} color="blue.400" />
            </Box>
          </MotionBox>

          <VStack spacing={8} maxW="800px" mx="auto">
            <Heading
              as="h2"
              fontSize={{ base: "4xl", md: "5xl", lg: "6xl" }}
              fontWeight="extrabold"
              lineHeight="1.1"
              letterSpacing="tight"
              bgGradient="linear(to-r, blue.300, purple.400, blue.300)"
              bgClip="text"
            >
              Transform Your Email Experience Today
            </Heading>

            <Text fontSize="xl" maxW="2xl" color="gray.300">
              <Highlight
                query={["neural networks", "AI"]}
                styles={{ fontWeight: "bold", color: "blue.300" }}
              >
                Join thousands of professionals using neural networks and AI to
                reclaim hours of their week. The future of email management is
                here.
              </Highlight>
            </Text>

            <Button
              size="lg"
              bg={buttonBg}
              color="white"
              px={10}
              py={8}
              fontSize="xl"
              fontWeight="bold"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "xl",
                bg: "blue.500",
              }}
              _active={{ bg: "blue.600" }}
              onClick={onLogin}
              isLoading={isLoading}
              loadingText="Connecting..."
              rightIcon={<Icon as={FaArrowRight} />}
              transition="all 0.3s"
              borderRadius="full"
              boxShadow="lg"
            >
              Begin AI Integration
            </Button>

            <Text fontSize="sm" color="gray.400" pt={3}>
              No credit card required. Secure OAuth authentication.
            </Text>
          </VStack>
        </Flex>
      </Container>
    </Box>
  );
};

export default CTASection;
