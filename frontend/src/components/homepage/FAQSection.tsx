import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useColorModeValue,
  Icon,
  Flex,
  SimpleGrid,
  Badge,
  Divider,
  HStack,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import {
  FaRobot,
  FaBrain,
  FaMicrochip,
  FaFingerprint,
  FaShieldAlt,
  FaClock,
} from "react-icons/fa";
import { keyframes } from "@emotion/react";

interface FAQ {
  question: string;
  answer: string;
  icon: any;
}

const MotionBox = motion(Box);

// Define animations - simplified and more subtle
const pulse = keyframes`
  0% { opacity: 0.7; }
  50% { opacity: 1; }
  100% { opacity: 0.7; }
`;

const FAQSection = () => {
  // Colors - using the purple scheme
  const bgColor = useColorModeValue("white", "gray.900");
  const textColor = useColorModeValue("gray.700", "gray.300");
  const accordionBg = useColorModeValue("gray.50", "gray.800");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const accentColor = useColorModeValue("purple.500", "purple.300");

  // FAQ data - simplified without individual colors
  const faqs: FAQ[] = [
    {
      question: "How does Superconnector Mail's AI technology work?",
      answer:
        "Superconnector Mail uses advanced neural networks to analyze communication patterns and optimize your email workflow. Our proprietary quantum neural processing architecture creates a digital cognitive extension that understands your unique communication style while ensuring complete privacy and security.",
      icon: FaBrain,
    },
    {
      question:
        "What makes Superconnector Mail different from other AI email tools?",
      answer:
        "Unlike basic AI assistants, Superconnector Mail employs a multi-layered neuromorphic network that adapts to your specific needs. Our system combines predictive intention analysis, cognitive fingerprinting, and zero-knowledge privacy protocols to deliver an experience that truly feels like an extension of your professional self.",
      icon: FaRobot,
    },
    {
      question: "Is my data secure with your advanced AI systems?",
      answer:
        "Absolutely. We employ end-to-end homomorphic encryption with post-quantum cryptography that ensures your data remains completely private while still enabling our AI to learn from patterns. Our zero-knowledge security mesh means not even our systems can access the actual content of your communications.",
      icon: FaShieldAlt,
    },
    {
      question: "Can I customize how the AI interacts with my emails?",
      answer:
        "Yes! Our synthetic intelligence layer allows unprecedented customization. You can adjust parameters for response tone, writing style, priority assessment, and more. The system continuously adapts based on your feedback, creating a truly symbiotic relationship between you and the AI.",
      icon: FaFingerprint,
    },
    {
      question: "What kind of productivity gains can I expect?",
      answer:
        "Our users report an average time savings of 7.8 hours weekly after full integration. The AI's bayesian inference framework anticipates your communication needs with 97.3% accuracy, while our neuromorphic network fabric identifies optimal communication patterns that strengthen your professional relationships.",
      icon: FaClock,
    },
    {
      question: "How quickly can I get started with Superconnector Mail?",
      answer:
        "Our neural onboarding process takes just minutes. After connecting your email account, our AI will begin initial pattern analysis immediately. You'll experience basic benefits within hours, while the full cognitive signature matrix develops over 1-2 weeks as it learns your unique communication patterns.",
      icon: FaMicrochip,
    },
  ];

  return (
    <Box
      py={24}
      bg={bgColor}
      position="relative"
      id="faq"
      borderTop="1px solid"
      borderColor={borderColor}
    >
      {/* Subtle grid background - minimal */}
      <Box
        position="absolute"
        top="0"
        left="0"
        width="100%"
        height="100%"
        opacity="0.02"
        backgroundImage="linear-gradient(to right, rgba(159, 122, 234, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(159, 122, 234, 0.1) 1px, transparent 1px)"
        backgroundSize="40px 40px"
        zIndex={0}
      />

      {/* Accent line at top */}
      <Box
        position="absolute"
        top="0"
        left="50%"
        transform="translateX(-50%)"
        width="100px"
        height="3px"
        bg={accentColor}
        zIndex={1}
      />

      <Container maxW="container.xl" position="relative" zIndex={1}>
        <VStack spacing={16}>
          {/* Section header - minimalist */}
          <MotionBox
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <VStack
              spacing={4}
              textAlign="center"
              maxW="container.md"
              mx="auto"
            >
              <Text
                fontSize="sm"
                letterSpacing="2px"
                textTransform="uppercase"
                fontWeight="bold"
                color={accentColor}
              >
                Knowledge Base
              </Text>

              <Heading
                as="h2"
                fontSize={{ base: "3xl", lg: "4xl" }}
                fontWeight="bold"
                lineHeight="1.2"
                color={useColorModeValue("gray.800", "white")}
              >
                Frequently Asked Questions
              </Heading>

              <Text fontSize="lg" color={textColor} maxW="2xl">
                Everything you need to know about our AI-powered email assistant
              </Text>
            </VStack>
          </MotionBox>

          {/* FAQ accordion - clean, minimal design */}
          <Accordion
            allowMultiple
            width="100%"
            borderRadius="md"
            bg={accordionBg}
            boxShadow="sm"
          >
            {faqs.map((faq, index) => (
              <AccordionItem key={index} border="0" mb={2} overflow="hidden">
                {({ isExpanded }) => (
                  <>
                    <AccordionButton
                      p={6}
                      _hover={{
                        bg: useColorModeValue("gray.100", "gray.700"),
                      }}
                      transition="all 0.2s"
                      borderRadius={isExpanded ? "md md 0 0" : "md"}
                    >
                      <HStack flex="1" textAlign="left" spacing={4}>
                        <Icon
                          as={faq.icon}
                          color={accentColor}
                          boxSize={5}
                          opacity={isExpanded ? 1 : 0.7}
                          transition="all 0.3s"
                        />
                        <Text
                          fontSize="lg"
                          fontWeight="medium"
                          color={useColorModeValue("gray.800", "white")}
                        >
                          {faq.question}
                        </Text>
                      </HStack>
                      <AccordionIcon />
                    </AccordionButton>
                    <AccordionPanel
                      pb={6}
                      px={6}
                      bg={useColorModeValue("white", "gray.900")}
                      borderBottomRadius="md"
                      borderLeft="1px solid"
                      borderRight="1px solid"
                      borderBottom="1px solid"
                      borderColor={borderColor}
                    >
                      <Text
                        color={textColor}
                        fontSize="md"
                        lineHeight="1.7"
                        pl={9}
                      >
                        {faq.answer}
                      </Text>
                    </AccordionPanel>
                  </>
                )}
              </AccordionItem>
            ))}
          </Accordion>

          {/* Minimal footer element */}
          <MotionBox
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Flex
              align="center"
              justify="center"
              direction="column"
              textAlign="center"
              mt={8}
            >
              <Box
                width="40px"
                height="40px"
                borderRadius="full"
                bg={useColorModeValue("purple.50", "purple.900")}
                display="flex"
                alignItems="center"
                justifyContent="center"
                mb={4}
                sx={{
                  animation: `${pulse} 3s infinite ease-in-out`,
                }}
              >
                <Icon as={FaRobot} color={accentColor} boxSize={5} />
              </Box>
              <Text color={textColor} fontSize="md" maxW="md">
                Need more help? Our AI support is available 24/7.
              </Text>
            </Flex>
          </MotionBox>
        </VStack>
      </Container>
    </Box>
  );
};

export default FAQSection;
