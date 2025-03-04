// THIS COMPONENT WILL BE REMOVED AS PER USER REQUEST
// This file is no longer used in the application

import {
  Box,
  Container,
  Flex,
  Heading,
  Text,
  VStack,
  HStack,
  Avatar,
  Icon,
  useColorModeValue,
  Divider,
  Button,
} from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FaQuoteLeft,
  FaChevronLeft,
  FaChevronRight,
  FaStar,
} from "react-icons/fa";

// Testimonial interface
interface Testimonial {
  name: string;
  position: string;
  company: string;
  testimonial: string;
  avatar: string;
  rating: number;
}

const MotionBox = motion(Box);

const TestimonialsSection = () => {
  // Colors
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("white", "gray.800");
  const textColor = useColorModeValue("gray.600", "gray.300");
  const accentColor = useColorModeValue("blue.500", "blue.300");

  // State for carousel
  const [currentIndex, setCurrentIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (carouselRef.current) {
      setWidth(
        carouselRef.current.scrollWidth - carouselRef.current.offsetWidth
      );
    }
  }, []);

  // Testimonials data
  const testimonials: Testimonial[] = [
    {
      name: "Sarah Johnson",
      position: "Marketing Director",
      company: "TechCorp Inc.",
      testimonial:
        "This email platform has completely transformed how our team handles communications. The AI-powered analytics have given us insights we never knew existed, and the automation tools save us hours every week.",
      avatar:
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=250&q=80",
      rating: 5,
    },
    {
      name: "Michael Chen",
      position: "CEO",
      company: "StartUp Ventures",
      testimonial:
        "As a startup founder, I'm constantly overwhelmed by emails. This platform has been a game-changer, helping me prioritize communications and ensuring nothing important falls through the cracks.",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=250&q=80",
      rating: 5,
    },
    {
      name: "Emily Rodriguez",
      position: "Customer Success Manager",
      company: "CloudServices",
      testimonial:
        "The smart reply suggestions are incredible - they sound just like me! Our customer response times have decreased by 45% since implementing this email solution. I'd recommend it to anyone who deals with high email volume.",
      avatar:
        "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=250&q=80",
      rating: 4,
    },
    {
      name: "David Wilson",
      position: "Sales Executive",
      company: "Global Enterprises",
      testimonial:
        "The email analytics have helped me understand my clients better and time my communications perfectly. My response rates have improved by 30% and our sales team has seen measurable improvements in conversion.",
      avatar:
        "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=250&q=80",
      rating: 5,
    },
  ];

  const handlePrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? testimonials.length - 1 : prev - 1
    );
  };

  const handleNext = () => {
    setCurrentIndex((prev) =>
      prev === testimonials.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <Box py={20} bg={bgColor} position="relative" overflow="hidden">
      {/* Background decorative elements */}
      <Box
        position="absolute"
        top="-10%"
        left="-5%"
        width="300px"
        height="300px"
        bg={useColorModeValue("blue.50", "blue.900")}
        borderRadius="full"
        filter="blur(60px)"
        opacity="0.4"
        zIndex={0}
      />

      <Container maxW="container.xl" position="relative" zIndex={1}>
        <VStack spacing={16}>
          {/* Section header */}
          <VStack spacing={4} textAlign="center" maxW="container.md" mx="auto">
            <Text
              color="blue.500"
              fontWeight="bold"
              fontSize="md"
              textTransform="uppercase"
              letterSpacing="wide"
            >
              Testimonials
            </Text>

            <Heading as="h2" size="3xl" fontWeight="bold" lineHeight="1.2">
              What Our Users Say
            </Heading>

            <Text fontSize="xl" color={textColor} maxW="2xl">
              Discover how our platform has transformed email management for
              professionals across industries.
            </Text>
          </VStack>

          {/* Testimonials carousel - desktop */}
          <Box
            width="100%"
            position="relative"
            display={{ base: "none", md: "block" }}
          >
            <MotionBox
              ref={carouselRef}
              overflow="hidden"
              whileTap={{ cursor: "grabbing" }}
            >
              <MotionBox
                display="flex"
                animate={{
                  x: -(currentIndex * (carouselRef.current?.offsetWidth || 0)),
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                dragConstraints={{ right: 0, left: -width }}
                drag="x"
                pl={4}
                pb={8}
              >
                {testimonials.map((testimonial, index) => (
                  <Box
                    key={index}
                    minW="calc(33.333% - 32px)"
                    width="calc(33.333% - 32px)"
                    mr={8}
                    flex="none"
                  >
                    <Flex
                      direction="column"
                      bg={cardBg}
                      p={8}
                      borderRadius="2xl"
                      boxShadow="xl"
                      height="100%"
                      position="relative"
                      borderWidth="1px"
                      borderColor={useColorModeValue("gray.100", "gray.700")}
                    >
                      <Icon
                        as={FaQuoteLeft}
                        color={`${accentColor}30`}
                        w={10}
                        h={10}
                        mb={4}
                      />

                      <Text fontSize="md" color={textColor} flex="1" mb={6}>
                        "{testimonial.testimonial}"
                      </Text>

                      <Divider mb={6} />

                      <HStack spacing={4}>
                        <Avatar
                          src={testimonial.avatar}
                          name={testimonial.name}
                          size="md"
                          border="2px solid"
                          borderColor={accentColor}
                        />

                        <Box>
                          <Text fontWeight="bold" fontSize="md">
                            {testimonial.name}
                          </Text>
                          <Text fontSize="sm" color={textColor}>
                            {testimonial.position}, {testimonial.company}
                          </Text>
                        </Box>
                      </HStack>

                      <HStack mt={4} color="yellow.400">
                        {[...Array(5)].map((_, i) => (
                          <Icon
                            key={i}
                            as={FaStar}
                            w={4}
                            h={4}
                            color={
                              i < testimonial.rating ? "yellow.400" : "gray.300"
                            }
                          />
                        ))}
                      </HStack>
                    </Flex>
                  </Box>
                ))}
              </MotionBox>
            </MotionBox>

            <HStack
              position="absolute"
              bottom="-20px"
              left="50%"
              transform="translateX(-50%)"
              spacing={4}
            >
              <Button
                onClick={handlePrev}
                variant="outline"
                size="md"
                borderRadius="full"
                w="50px"
                h="50px"
                p={0}
                _hover={{
                  bg: accentColor,
                  color: "white",
                  borderColor: accentColor,
                }}
              >
                <Icon as={FaChevronLeft} />
              </Button>

              <Button
                onClick={handleNext}
                variant="outline"
                size="md"
                borderRadius="full"
                w="50px"
                h="50px"
                p={0}
                _hover={{
                  bg: accentColor,
                  color: "white",
                  borderColor: accentColor,
                }}
              >
                <Icon as={FaChevronRight} />
              </Button>
            </HStack>
          </Box>

          {/* Testimonials for mobile */}
          <Box width="100%" display={{ base: "block", md: "none" }}>
            <MotionBox
              bg={cardBg}
              p={8}
              borderRadius="2xl"
              boxShadow="xl"
              borderWidth="1px"
              borderColor={useColorModeValue("gray.100", "gray.700")}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Icon
                as={FaQuoteLeft}
                color={`${accentColor}30`}
                w={10}
                h={10}
                mb={4}
              />

              <Text fontSize="md" color={textColor} mb={6}>
                "{testimonials[currentIndex].testimonial}"
              </Text>

              <Divider mb={6} />

              <HStack spacing={4}>
                <Avatar
                  src={testimonials[currentIndex].avatar}
                  name={testimonials[currentIndex].name}
                  size="md"
                  border="2px solid"
                  borderColor={accentColor}
                />

                <Box>
                  <Text fontWeight="bold">
                    {testimonials[currentIndex].name}
                  </Text>
                  <Text fontSize="sm" color={textColor}>
                    {testimonials[currentIndex].position},{" "}
                    {testimonials[currentIndex].company}
                  </Text>
                </Box>
              </HStack>

              <HStack mt={4} color="yellow.400">
                {[...Array(5)].map((_, i) => (
                  <Icon
                    key={i}
                    as={FaStar}
                    w={4}
                    h={4}
                    color={
                      i < testimonials[currentIndex].rating
                        ? "yellow.400"
                        : "gray.300"
                    }
                  />
                ))}
              </HStack>

              <HStack justifyContent="center" mt={8} spacing={4}>
                <Button
                  onClick={handlePrev}
                  variant="outline"
                  size="sm"
                  borderRadius="full"
                  w="40px"
                  h="40px"
                  p={0}
                  _hover={{
                    bg: accentColor,
                    color: "white",
                    borderColor: accentColor,
                  }}
                >
                  <Icon as={FaChevronLeft} />
                </Button>

                <Button
                  onClick={handleNext}
                  variant="outline"
                  size="sm"
                  borderRadius="full"
                  w="40px"
                  h="40px"
                  p={0}
                  _hover={{
                    bg: accentColor,
                    color: "white",
                    borderColor: accentColor,
                  }}
                >
                  <Icon as={FaChevronRight} />
                </Button>
              </HStack>
            </MotionBox>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
};

export default TestimonialsSection;
