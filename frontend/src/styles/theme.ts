// Enhanced theme configuration for the Email Dashboard
import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

// Beautiful color palette for our dashboard
const colors = {
  brand: {
    50: "#E6F6FF",
    100: "#BAE3FF",
    200: "#7CC4FA",
    300: "#47A3F3",
    400: "#2186EB",
    500: "#0967D2", // Primary brand color
    600: "#0552B5",
    700: "#03449E",
    800: "#01337D",
    900: "#002159",
  },
  accent: {
    50: "#FFF0F7",
    100: "#FFD6E8",
    200: "#FFADDA",
    300: "#FF80CB",
    400: "#FF4DB8",
    500: "#FF1AA3", // Secondary accent color
    600: "#DB008C",
    700: "#B80074",
    800: "#93005D",
    900: "#7A0050",
  },
  neutral: {
    50: "#F7F7F8",
    100: "#EEEEF0",
    200: "#D2D2D9",
    300: "#B6B7C2",
    400: "#9496A8",
    500: "#777990", // Main text color
    600: "#5F607A",
    700: "#484964",
    800: "#343550",
    900: "#1E1F37",
  },
  success: {
    50: "#E7F9ED",
    100: "#C2F1D1",
    200: "#99E7B4",
    300: "#71DE97",
    400: "#4AD97A",
    500: "#22D45D", // Success color
    600: "#1BB64E",
    700: "#159740",
    800: "#0F7732",
    900: "#096127",
  },
  warning: {
    50: "#FFF8E6",
    100: "#FFEDBF",
    200: "#FFE299",
    300: "#FFD773",
    400: "#FFCD4D",
    500: "#FFC026", // Warning color
    600: "#DB9F00",
    700: "#B88100",
    800: "#946400",
    900: "#7A5200",
  },
  error: {
    50: "#FFF0F0",
    100: "#FFD6D6",
    200: "#FFB3B3",
    300: "#FF8080",
    400: "#FF4D4D",
    500: "#FF1A1A", // Error color
    600: "#DB0000",
    700: "#B80000",
    800: "#930000",
    900: "#7A0000",
  },
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
  },
};

// Enhanced component styling
const components = {
  Button: {
    baseStyle: {
      fontWeight: "600",
      borderRadius: "md",
      _focus: {
        boxShadow: "outline",
      },
    },
    variants: {
      solid: (props: any) => ({
        bg: props.colorScheme === "brand" ? "brand.500" : `${props.colorScheme}.500`,
        color: "white",
        _hover: {
          bg: props.colorScheme === "brand" ? "brand.600" : `${props.colorScheme}.600`,
          transform: "translateY(-1px)",
          boxShadow: "sm",
          _disabled: {
            bg: props.colorScheme === "brand" ? "brand.500" : `${props.colorScheme}.500`,
          },
        },
        _active: {
          bg: props.colorScheme === "brand" ? "brand.700" : `${props.colorScheme}.700`,
          transform: "translateY(0)",
        },
      }),
      outline: (props: any) => ({
        border: "2px solid",
        borderColor: props.colorScheme === "brand" ? "brand.500" : `${props.colorScheme}.500`,
        color: props.colorScheme === "brand" ? "brand.500" : `${props.colorScheme}.500`,
        _hover: {
          bg: props.colorScheme === "brand" ? "brand.50" : `${props.colorScheme}.50`,
          transform: "translateY(-1px)",
          boxShadow: "sm",
        },
        _active: {
          bg: props.colorScheme === "brand" ? "brand.100" : `${props.colorScheme}.100`,
          transform: "translateY(0)",
        },
      }),
      ghost: (props: any) => ({
        color: props.colorScheme === "brand" ? "brand.500" : `${props.colorScheme}.500`,
        _hover: {
          bg: props.colorScheme === "brand" ? "brand.50" : `${props.colorScheme}.50`,
        },
        _active: {
          bg: props.colorScheme === "brand" ? "brand.100" : `${props.colorScheme}.100`,
        },
      }),
    },
    defaultProps: {
      colorScheme: "brand",
      size: "md",
    },
  },
  Card: {
    baseStyle: {
      container: {
        borderRadius: "lg",
        overflow: "hidden",
        boxShadow: "lg",
        transition: "all 0.2s ease",
        _hover: {
          transform: "translateY(-2px)",
          boxShadow: "xl",
        },
      },
      header: {
        px: "6",
        py: "4",
        borderBottomWidth: "1px",
      },
      body: {
        px: "6",
        py: "4",
      },
      footer: {
        px: "6",
        py: "4",
        borderTopWidth: "1px",
      },
    },
    variants: {
      elevated: {
        container: {
          boxShadow: "lg",
          backgroundColor: "white",
        },
      },
      outline: {
        container: {
          borderWidth: "1px",
          boxShadow: "none",
        },
      },
      filled: {
        container: {
          backgroundColor: "gray.100",
          boxShadow: "none",
        },
      },
    },
    defaultProps: {
      variant: "elevated",
    },
  },
  Tabs: {
    variants: {
      modern: {
        tab: {
          borderRadius: "md",
          fontWeight: "semibold",
          color: "gray.600",
          _selected: {
            color: "brand.500",
            bg: "brand.50",
          },
          _hover: {
            color: "brand.500",
            bg: "gray.50",
          },
        },
        tablist: {
          borderBottom: "none",
          gap: "2",
        },
        tabpanel: {
          pt: "4",
        },
      },
      "soft-rounded": {
        tab: {
          borderRadius: "full",
          fontWeight: "semibold",
          color: "gray.600",
          bg: "gray.100",
          _selected: {
            color: "white",
            bg: "brand.500",
          },
        },
        tablist: {
          gap: "2",
        },
      },
    },
    defaultProps: {
      variant: "modern",
      colorScheme: "brand",
    },
  },
  Table: {
    variants: {
      modern: {
        th: {
          borderBottom: "2px solid",
          borderColor: "brand.100",
          color: "gray.700",
          fontSize: "sm",
          fontWeight: "600",
          letterSpacing: "wider",
          textTransform: "uppercase",
          px: "6",
          py: "3",
        },
        td: {
          borderBottom: "1px solid",
          borderColor: "gray.100",
          px: "6",
          py: "4",
          fontSize: "sm",
        },
        tr: {
          _hover: {
            bg: "gray.50",
            cursor: "pointer",
          },
        },
      },
    },
    defaultProps: {
      variant: "modern",
    },
  },
  Badge: {
    baseStyle: {
      borderRadius: "full",
      textTransform: "normal",
      fontWeight: "medium",
      px: 2,
    },
    sizes: {
      sm: {
        fontSize: "xs",
        px: 2,
        py: 0.5,
      },
      md: {
        fontSize: "sm",
        px: 2.5,
        py: 1,
      },
      lg: {
        fontSize: "md",
        px: 3,
        py: 1.5,
      },
    },
    defaultProps: {
      size: "md",
      colorScheme: "gray",
    },
  },
  Input: {
    variants: {
      filled: {
        field: {
          bg: "gray.50",
          borderRadius: "md",
          _hover: {
            bg: "gray.100",
          },
          _focus: {
            bg: "white",
            borderColor: "brand.500",
          },
        },
      },
    },
    defaultProps: {
      variant: "filled",
    },
  },
};

// Styling for light and dark mode
const styles = {
  global: (props: any) => ({
    body: {
      fontFamily: "body",
      color: mode("gray.800", "whiteAlpha.900")(props),
      bg: mode("gray.50", "gray.900")(props),
      lineHeight: "base",
    },
    "*::placeholder": {
      color: mode("gray.400", "whiteAlpha.400")(props),
    },
    "*, *::before, &::after": {
      borderColor: mode("gray.200", "whiteAlpha.300")(props),
      wordWrap: "break-word",
    },
    // Custom styles for email body
    ".email-body": {
      fontSize: "sm",
      lineHeight: "tall",
      "& a": {
        color: "brand.500",
        textDecoration: "underline",
        _hover: {
          textDecoration: "none",
        },
      },
      "& img": {
        maxWidth: "100%",
        height: "auto",
      },
    },
    // Email thread styling
    ".thread-message": {
      transition: "all 0.2s ease-in-out",
      "&:hover": {
        transform: "translateY(-2px)",
        boxShadow: "sm",
      },
    },
    // Animation classes
    ".animate-fade-in": {
      opacity: 0,
      animation: "fadeIn 0.3s ease-in-out forwards",
    },
    ".animate-slide-up": {
      transform: "translateY(20px)",
      opacity: 0,
      animation: "slideUp 0.3s ease-in-out forwards",
    },
    "@keyframes fadeIn": {
      "0%": { opacity: 0 },
      "100%": { opacity: 1 },
    },
    "@keyframes slideUp": {
      "0%": { transform: "translateY(20px)", opacity: 0 },
      "100%": { transform: "translateY(0)", opacity: 1 },
    },
  }),
};

// Typography configuration
const typography = {
  fonts: {
    heading: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    body: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
  fontWeights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

// Common breakpoints
const breakpoints = {
  sm: "30em", // 480px
  md: "48em", // 768px
  lg: "62em", // 992px
  xl: "80em", // 1280px
  "2xl": "96em", // 1536px
};

// Radii (border radius) configuration
const radii = {
  none: "0",
  sm: "0.125rem",
  base: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  xl: "0.75rem",
  "2xl": "1rem",
  "3xl": "1.5rem",
  full: "9999px",
};

// Animation configuration
const transition = {
  property: {
    common: "background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
    colors: "background-color, border-color, color, fill, stroke",
    dimensions: "width, height",
    position: "left, right, top, bottom",
    background: "background-color, background-image, background-position",
  },
  easing: {
    "ease-in": "cubic-bezier(0.4, 0, 1, 1)",
    "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
    "ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  duration: {
    "ultra-fast": "0.05s",
    faster: "0.1s",
    fast: "0.15s",
    normal: "0.2s",
    slow: "0.3s",
    slower: "0.4s",
    "ultra-slow": "0.5s",
  },
};

// Compile the theme
const theme = extendTheme({
  colors,
  components,
  styles,
  ...typography,
  breakpoints,
  radii,
  transition,
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
});

export default theme;
