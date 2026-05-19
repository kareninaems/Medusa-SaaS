import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";

import { theme } from "@/src/constants/theme";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  style?: ViewStyle;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = "primary",
  style,
  testID,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "ghost" && styles.ghost,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : theme.colors.brand} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === "primary" ? styles.primaryLabel : styles.secondaryLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius.pill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  primary: {
    backgroundColor: theme.colors.brand,
  },
  secondary: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
  },
  primaryLabel: {
    color: "#fff",
  },
  secondaryLabel: {
    color: theme.colors.text,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.6,
  },
});
