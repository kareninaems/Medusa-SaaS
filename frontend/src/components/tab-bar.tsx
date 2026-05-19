import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { theme } from "@/src/constants/theme";

export type AppTab = "chat" | "memory" | "account" | "admin";

interface TabBarProps {
  activeTab: AppTab;
  tabs: AppTab[];
  onChange: (tab: AppTab) => void;
}

const tabConfig: Record<AppTab, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  chat: { label: "Chat", icon: "chatbubble-ellipses-outline" },
  memory: { label: "Memória", icon: "layers-outline" },
  account: { label: "Conta", icon: "person-circle-outline" },
  admin: { label: "Admin", icon: "shield-checkmark-outline" },
};

export function TabBar({ activeTab, tabs, onChange }: TabBarProps) {
  return (
    <View style={styles.wrapper}>
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            testID={`tab-${tab}`}
            style={({ pressed }) => [styles.item, isActive && styles.itemActive, pressed && styles.pressed]}
          >
            <Ionicons
              name={tabConfig[tab].icon}
              size={20}
              color={isActive ? "#fff" : theme.colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>{tabConfig[tab].label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 6,
    gap: 6,
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  itemActive: {
    backgroundColor: theme.colors.brand,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.colors.textSecondary,
  },
  labelActive: {
    color: "#fff",
  },
  pressed: {
    opacity: 0.85,
  },
});
