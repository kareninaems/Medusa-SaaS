import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";
import { colors, radius, spacing, typography } from "./Theme";

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
}

export function Button({ label, variant = "primary", loading, disabled, style, ...rest }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled, style]}
      disabled={disabled || loading}
      activeOpacity={0.75}
      {...rest}
    >
      {loading
        ? <ActivityIndicator color={variant === "primary" ? "#fff" : colors.accent} />
        : <Text style={[styles.label, variant === "ghost" && styles.labelGhost]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.accent },
  ghost: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  label: { ...typography.body, fontWeight: "600", color: "#fff" },
  labelGhost: { color: colors.accent },
});
