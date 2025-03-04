import React from "react";
import {
  Box,
  Container,
  Flex,
  Heading,
  HStack,
  Icon,
  Link,
  SimpleGrid,
  Text,
  VStack,
  useColorModeValue,
  Divider,
  IconButton,
} from "@chakra-ui/react";
import { FaTwitter, FaLinkedin, FaGithub, FaEnvelope } from "react-icons/fa";
import { BsLightningChargeFill } from "react-icons/bs";

const Footer = () => {
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const textColor = useColorModeValue("gray.600", "gray.400");
  const headingColor = useColorModeValue("gray.800", "white");
  const linkColor = useColorModeValue("purple.500", "purple.300");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const accentColor = useColorModeValue("purple.500", "purple.400");
  const iconBg = useColorModeValue("purple.50", "gray.700");

  const linkHoverStyles = {
    color: linkColor,
    transition: "all 0.3s",
    _hover: {
      color: useColorModeValue("purple.600", "purple.200"),
      textDecoration: "none",
    },
  };

  const footerLinks = [
    {
      title: "Product",
      links: [
        { name: "Features", href: "#" },
        { name: "Integrations", href: "#" },
        { name: "Network Intelligence", href: "#" },
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
    { icon: FaEnvelope, href: "#", label: "Email" },
  ];

  return (
    <Box bg={bgColor} color={textColor}>
      <Container maxW="container.xl">
        <Box py={16}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={8}>
            {/* Brand column */}
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
                  Superconnector Mail
                </Heading>
              </HStack>

              <Text fontSize="md" lineHeight="tall">
                Transform your email into a powerful networking tool that builds
                meaningful connections and expands your professional network.
              </Text>

              {/* Social media icons */}
              <HStack spacing={4} mt={2}>
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

            {/* Link columns */}
            {footerLinks.map((category, idx) => (
              <VStack key={idx} align="flex-start" spacing={4}>
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
        >
          <Text fontSize="sm" color={textColor}>
            © 2023 Superconnector Mail. All rights reserved.
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
