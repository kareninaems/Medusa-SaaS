import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radius, spacing, typography } from "./Theme";
import type { EnergyLevel } from "@/types/medusa";

const OPTIONS: { level: EnergyLevel; label: string; desc: string; color: string }[] = [
  { level: 1, label: "1 — Baixa", desc: "Travado, exausto", color: colors.energy1 },
  { level: 2, label: "2 — Média", desc: "Funcional, mas cansa rápido", color: colors.energy2 },
  { level: 3, label: "3 — Alta", desc: "Fluindo, com energia", color: colors.energy3 },
];

interface EnergyPickerProps {
  value: EnergyLevel | null;
  onChange: (level: EnergyLevel) => void;
}

export function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  return (
    <View style={styles.container}>
      {OPTIONS.map((opt) => {
        const selected = value === opt.level;
        return (
          <TouchableOpacity
            key={opt.level}
            style={[styles.option, selected && { borderColor: opt.color, backgroundColor: opt.color + "22" }]}
            onPress={() => onChange(opt.level)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, selected && { color: opt.color }]}>{opt.label}</Text>
            <Text style={styles.desc}>{opt.desc}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  option: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  label: { ...typography.body, fontWeight: "600" },
  desc: { ...typography.caption, marginTop: 2 },
});
