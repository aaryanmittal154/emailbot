/**
 * Animation variants for consistent animation throughout the application
 * These can be used with Framer Motion components
 */

// Generic transition settings
export const transitions = {
  // Spring transition for natural feeling motion
  spring: {
    type: "spring",
    stiffness: 400,
    damping: 30,
  },

  // Fast spring for micro-interactions
  fastSpring: {
    type: "spring",
    stiffness: 700,
    damping: 30,
  },

  // Smooth easing transition
  ease: {
    type: "tween",
    ease: [0.25, 0.1, 0.25, 1], // cubic-bezier
    duration: 0.3,
  },

  // Subtle transition for hover effects
  subtle: {
    duration: 0.2,
  },
};

// Transition settings for staggered children
export const staggerTransition = {
  staggerChildren: 0.07,
  delayChildren: 0.1,
};

// Entrance animation variants
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: transitions.ease,
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: { duration: 0.2 },
  },
};

export const fadeInDown = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.2 },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.2 },
  },
};

export const slideInLeft = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2 },
  },
};

export const slideInRight = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: { duration: 0.2 },
  },
};

// Staggered container variants
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      ...transitions.ease,
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Card/list item variants (for use in staggered containers)
export const listItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: { duration: 0.2 },
  },
};

// Hover animations for interactive elements
export const hoverScale = {
  scale: 1.05,
  transition: transitions.fastSpring,
};

export const hoverElevate = {
  y: -4,
  boxShadow:
    "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  transition: transitions.spring,
};

export const hoverGlow = (color = "brand.500") => ({
  boxShadow: `0 0 15px ${color}30`,
  borderColor: `${color}`,
  transition: transitions.spring,
});

// Tap/active animations
export const tapScale = {
  scale: 0.98,
  transition: transitions.fastSpring,
};

// Loading animations
export const loadingPulse = {
  opacity: [0.6, 1, 0.6],
  transition: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut",
  },
};

export const loadingSpin = {
  rotate: [0, 360],
  transition: {
    duration: 1,
    repeat: Infinity,
    ease: "linear",
  },
};

// Button specific animations
export const buttonHover = {
  y: -2,
  transition: transitions.subtle,
};

export const buttonTap = {
  y: 0,
  scale: 0.98,
  transition: {
    duration: 0.1,
  },
};

// Toast/notification animations
export const toastEnter = {
  hidden: { opacity: 0, y: -20, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.9,
    transition: { duration: 0.2 },
  },
};

// Page transition animations
export const pageTransition = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
      when: "beforeChildren",
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3 },
  },
};
