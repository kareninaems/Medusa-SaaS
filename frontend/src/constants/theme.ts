import { Platform } from "react-native";

export const theme = {
  colors: {
    background: "#FBFBF9",
    surface: "#FFFFFF",
    surfaceMuted: "#F2F2F0",
    text: "#1C1C1A",
    textSecondary: "#6B6B66",
    border: "#EBEBE8",
    brand: "#3A453A",
    brandPressed: "#2C352C",
    accent: "#D17D5C",
    danger: "#B94A48",
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    md: 16,
    lg: 24,
    pill: 999,
  },
  shadow: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
};
