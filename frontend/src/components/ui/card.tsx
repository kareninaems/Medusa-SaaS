import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { theme } from "@/src/constants/theme";

interface CardProps extends PropsWithChildren {
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    ...theme.shadow,
  },
});
