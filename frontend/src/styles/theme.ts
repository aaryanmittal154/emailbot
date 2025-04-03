// Enhanced theme configuration for the Email Dashboard
import { extendTheme } from "@chakra-ui/react";
import { mode } from "@chakra-ui/theme-tools";

// Modern minimalist futuristic color palette
const colors = {
  brand: {
    50: "#E6F6FF",
    100: "#CCE8FF",
    200: "#99C7FF",
    300: "#66A6FF",
    400: "#3385FF",
    500: "#0070F3", // Primary brand color - electric blue
    600: "#005CCF",
    700: "#0047A6",
    800: "#00337D",
    900: "#001F4D",
  },
  // Monochromatic base
  space: {
    50: "#F7F9FC",
    100: "#EDF1F7",
    200: "#D6DEEB",
    300: "#B7C2D8",
    400: "#8696BC",
    500: "#4A5568", // Secondary color
    600: "#2A2F3D",
    700: "#1E2130",
    800: "#141824",
    900: "#0A0E17", // Deep space black
  },
  // Functional colors
  success: {
    50: "#E9FBF0",
    100: "#C6F6D9",
    200: "#9AECBC",
    300: "#6DE39F",
    400: "#41DA83",
    500: "#22C35E", // Success color
    600: "#1CA04A",
    700: "#177D39",
    800: "#115C2A",
    900: "#0B3B1B",
  },
  warning: {
    50: "#FFF8E6",
    100: "#FFEFC2",
    200: "#FFE299",
    300: "#FFD470",
    400: "#FFC247",
    500: "#F7B955", // Warning color
    600: "#D39A42",
    700: "#B07B31",
    800: "#8D5D21",
    900: "#6A4012",
  },
  error: {
    50: "#FEE7E7",
    100: "#FECDCD",
    200: "#FCA5A5",
    300: "#F87171", // Error color
    400: "#EF4444",
    500: "#DC2626",
    600: "#B91C1C",
    700: "#991B1B",
    800: "#7F1D1D",
    900: "#671010",
  },
  // We'll keep the gray scale but align it with our space colors
  gray: {
    50: "#F7F9FC",
    100: "#EDF1F7",
    200: "#D6DEEB",
    300: "#B7C2D8",
    400: "#8696BC",
    500: "#4A5568",
    600: "#2A2F3D",
    700: "#1E2130",
    800: "#141824",
    900: "#0A0E17",
  },
};

// Enhanced component styling
const components = {
  Button: {
    baseStyle: {
      fontWeight: "500",
      borderRadius: "full", // Pill-shaped buttons
      letterSpacing: "0.01em",
      _focus: {
        boxShadow: "outline",
      },
    },
    variants: {
      solid: (props: any) => ({
        bg:
          props.colorScheme === "brand"
            ? "brand.500"
            : `${props.colorScheme}.500`,
        color: "white",
        _hover: {
          bg:
            props.colorScheme === "brand"
              ? "brand.600"
              : `${props.colorScheme}.600`,
          transform: "translateY(-1px)",
          boxShadow: "md",
          _disabled: {
            bg:
              props.colorScheme === "brand"
                ? "brand.500"
                : `${props.colorScheme}.500`,
          },
        },
        _active: {
          bg:
            props.colorScheme === "brand"
              ? "brand.700"
              : `${props.colorScheme}.700`,
          transform: "translateY(0)",
        },
      }),
      outline: (props: any) => ({
        border: "1px solid",
        borderColor:
          props.colorScheme === "brand"
            ? "brand.500"
            : `${props.colorScheme}.500`,
        color:
          props.colorScheme === "brand"
            ? "brand.500"
            : `${props.colorScheme}.500`,
        _hover: {
          bg:
            props.colorScheme === "brand"
              ? "brand.50"
              : `${props.colorScheme}.50`,
          transform: "translateY(-1px)",
          boxShadow: "sm",
        },
        _active: {
          bg:
            props.colorScheme === "brand"
              ? "brand.100"
              : `${props.colorScheme}.100`,
          transform: "translateY(0)",
        },
      }),
      ghost: (props: any) => ({
        color:
          props.colorScheme === "brand"
            ? "brand.500"
            : `${props.colorScheme}.500`,
        _hover: {
          bg:
            props.colorScheme === "brand"
              ? "brand.50"
              : `${props.colorScheme}.50`,
        },
        _active: {
          bg:
            props.colorScheme === "brand"
              ? "brand.100"
              : `${props.colorScheme}.100`,
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
        borderRadius: "xl", // Increased border radius
        overflow: "hidden",
        boxShadow: "lg",
        transition: "all 0.2s ease",
        border: "none", // Remove borders for cleaner look
        _hover: {
          transform: "translateY(-2px)",
          boxShadow: "xl",
        },
      },
      header: {
        px: "6",
        py: "5", // Increased padding
        borderBottomWidth: "0", // Remove dividers
      },
      body: {
        px: "6",
        py: "5", // Increased padding
      },
      footer: {
        px: "6",
        py: "5", // Increased padding
        borderTopWidth: "0", // Remove dividers
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
          borderColor: "space.200", // Updated border color
          boxShadow: "none",
        },
      },
      filled: {
        container: {
          backgroundColor: "space.50", // Updated background color
          boxShadow: "none",
        },
      },
      glass: {
        container: {
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(10px)",
          boxShadow: "lg",
        },
      },
    },
    defaultProps: {
      variant: "elevated",
    },
  },
  Tabs: {
    baseStyle: {
      tab: {
        fontWeight: "medium",
        letterSpacing: "0.01em",
        _selected: {
          fontWeight: "semibold",
          color: "brand.500",
        },
        _focus: {
          boxShadow: "none",
        },
      },
      tabpanel: {
        p: "4",
      },
    },
    variants: {
      line: {
        tab: {
          _selected: {
            borderColor: "brand.500",
            borderBottomWidth: "2px",
          },
          _active: {
            bg: "transparent",
          },
        },
      },
      enclosed: {
        tab: {
          borderRadius: "lg",
          border: "none",
          _selected: {
            bg: "space.50",
            color: "brand.500",
          },
        },
      },
      "soft-rounded": {
        tab: {
          borderRadius: "full",
          fontWeight: "medium",
          color: "space.600",
          _selected: {
            color: "white",
            bg: "brand.500",
          },
        },
      },
      minimal: {
        tab: {
          fontWeight: "medium",
          color: "space.500",
          _selected: {
            color: "brand.500",
            bg: "transparent",
            position: "relative",
            _after: {
              content: '""',
              position: "absolute",
              bottom: "-1px",
              left: "50%",
              transform: "translateX(-50%)",
              height: "2px",
              width: "20px",
              borderRadius: "full",
              bg: "brand.500",
            },
          },
        },
        tablist: {
          borderBottom: "1px solid",
          borderColor: "space.100",
        },
      },
    },
    defaultProps: {
      variant: "minimal",
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
      textTransform: "normal",
      fontWeight: "medium",
      borderRadius: "full",
      px: 2,
      py: 1,
    },
    variants: {
      subtle: (props: any) => ({
        bg: `${props.colorScheme}.50`,
        color: `${props.colorScheme}.700`,
      }),
      solid: (props: any) => ({
        bg: `${props.colorScheme}.500`,
        color: "white",
      }),
      outline: (props: any) => ({
        color: `${props.colorScheme}.500`,
        boxShadow: `inset 0 0 0px 1px ${props.colorScheme}.500`,
      }),
      pill: (props: any) => ({
        bg: `${props.colorScheme}.50`,
        color: `${props.colorScheme}.700`,
        borderRadius: "full",
        px: 3,
      }),
    },
    defaultProps: {
      variant: "subtle",
      colorScheme: "brand",
    },
  },
  Input: {
    baseStyle: {
      field: {
        borderRadius: "md",
        _focus: {
          borderColor: "brand.500",
          boxShadow: "0 0 0 1px var(--chakra-colors-brand-500)",
        },
      },
    },
    variants: {
      outline: {
        field: {
          borderColor: "space.200",
          _hover: {
            borderColor: "space.300",
          },
        },
      },
      filled: {
        field: {
          borderRadius: "md",
          bg: "space.50",
          _hover: {
            bg: "space.100",
          },
          _focus: {
            bg: "space.50",
          },
        },
      },
      minimal: {
        field: {
          borderWidth: "0",
          borderRadius: "md",
          bg: "space.50",
          _focus: {
            bg: "space.100",
            boxShadow: "none",
          },
          _hover: {
            bg: "space.100",
          },
        },
      },
    },
    defaultProps: {
      variant: "outline",
    },
  },
};

// Styling for light and dark mode
const styles = {
  global: (props: any) => ({
    body: {
      bg: mode("white", "space.900")(props),
      color: mode("space.800", "white")(props),
      fontSize: "md",
      lineHeight: "tall",
    },
    "*::placeholder": {
      color: mode("space.400", "space.400")(props),
    },
    "*, *::before, &::after": {
      borderColor: mode("space.200", "space.700")(props),
    },
    "h1, h2, h3, h4, h5, h6": {
      fontWeight: "300", // Extra light for headings
      letterSpacing: "0.01em",
    },
    h1: {
      fontSize: "3xl",
      letterSpacing: "0.02em",
    },
    h2: {
      fontSize: "2xl",
      letterSpacing: "0.01em",
    },
    h3: {
      fontSize: "xl",
    },
    h4: {
      fontSize: "lg",
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
const fonts = {
  heading: `'SF Pro Display', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  body: `'SF Pro Text', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  mono: `'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Courier New', monospace`,
};

// Shadow styles for depth and elevation
const shadows = {
  xs: "0 0 0 1px rgba(10, 14, 23, 0.05)",
  sm: "0 1px 2px 0 rgba(10, 14, 23, 0.08)",
  md: "0 4px 6px -1px rgba(10, 14, 23, 0.1), 0 2px 4px -1px rgba(10, 14, 23, 0.06)",
  lg: "0 10px 15px -3px rgba(10, 14, 23, 0.1), 0 4px 6px -2px rgba(10, 14, 23, 0.05)",
  xl: "0 20px 25px -5px rgba(10, 14, 23, 0.1), 0 10px 10px -5px rgba(10, 14, 23, 0.04)",
  "2xl": "0 25px 50px -12px rgba(10, 14, 23, 0.25)",
  outline: "0 0 0 3px rgba(0, 112, 243, 0.5)",
  inner: "inset 0 2px 4px 0 rgba(10, 14, 23, 0.06)",
  "dark-lg":
    "0 0 0 1px rgba(10, 14, 23, 0.09), 0 0 20px 4px rgba(10, 14, 23, 0.05)",
  glow: "0 0 15px rgba(0, 112, 243, 0.4)",
  "inner-glow": "inset 0 0 20px rgba(0, 112, 243, 0.15)",
};

// Common breakpoints
const breakpoints = {
  sm: "30em",
  md: "48em",
  lg: "62em",
  xl: "80em",
  "2xl": "96em",
};

// Radii (border radius) configuration
const radii = {
  none: "0",
  sm: "0.175rem",
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
    common:
      "background-color, border-color, color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter",
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
  ...fonts,
  shadows,
  breakpoints,
  radii,
  transition,
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
});

export default theme;
