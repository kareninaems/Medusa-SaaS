import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { MemoryItem } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

interface MemoryScreenProps {
  token: string;
}

export function MemoryScreen({ token }: MemoryScreenProps) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadItems = async () => {
    setLoading(true);
    try {
      const memory = await api.listMemory(token);
      setItems(memory);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao buscar memória");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const saveMemory = async () => {
    if (!newMemory.trim()) return;
    setSaving(true);
    setError("");
    try {
      await api.addMemory(token, {
        memory_type: "insight",
        content: newMemory.trim(),
        priority: "medium",
      });
      setNewMemory("");
      await loadItems();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao salvar memória");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.createCard}>
        <Text style={styles.title}>Adicionar memória manual</Text>
        <TextInput
          testID="memory-input"
          value={newMemory}
          onChangeText={setNewMemory}
          placeholder="Ex: Prefiro rotina noturna para foco"
          placeholderTextColor={theme.colors.textSecondary}
          style={styles.input}
          multiline
        />
        <PrimaryButton
          label="Salvar memória"
          onPress={saveMemory}
          loading={saving}
          testID="memory-save-button"
        />
      </Card>

      {loading ? (
        <ActivityIndicator color={theme.colors.brand} style={styles.loader} />
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {items.map((item) => (
            <Card key={item.id} style={styles.memoryCard}>
              <Text style={styles.memoryContent}>{item.content}</Text>
              <Text style={styles.memoryMeta}>
                {item.memory_type} • prioridade {item.priority} • {item.source}
              </Text>
            </Card>
          ))}
          {items.length === 0 ? <Text style={styles.empty}>Nenhuma memória ainda.</Text> : null}
        </ScrollView>
      )}

      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.md,
  },
  createCard: {
    gap: theme.spacing.sm,
  },
  title: {
    fontSize: 20,
    color: theme.colors.text,
    fontWeight: "700",
  },
  input: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 12,
    color: theme.colors.text,
    textAlignVertical: "top",
  },
  loader: {
    marginTop: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 12,
    paddingBottom: 12,
  },
  memoryCard: {
    gap: 8,
  },
  memoryContent: {
    color: theme.colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
  memoryMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  empty: {
    textAlign: "center",
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
});
