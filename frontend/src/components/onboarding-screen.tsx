import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { theme } from "@/src/constants/theme";
import { api } from "@/src/services/api";
import { OnboardingQuestion } from "@/src/types/app";
import { Card } from "@/src/components/ui/card";
import { PrimaryButton } from "@/src/components/ui/primary-button";

interface OnboardingScreenProps {
  token: string;
  onCompleted: () => Promise<void>;
}

export function OnboardingScreen({ token, onCompleted }: OnboardingScreenProps) {
  const [questions, setQuestions] = useState<OnboardingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const onboardingQuestions = await api.getOnboardingQuestions();
        setQuestions(onboardingQuestions);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Erro ao carregar onboarding");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const currentQuestion = questions[currentIndex];
  const progress = useMemo(() => {
    if (questions.length === 0) return 0;
    return (currentIndex + 1) / questions.length;
  }, [currentIndex, questions.length]);

  const handleNext = async () => {
    if (!currentQuestion) return;
    if (!currentAnswer.trim()) {
      setError("Escreva uma resposta para continuar.");
      return;
    }

    const nextAnswers = {
      ...answers,
      [currentQuestion.key]: currentAnswer.trim(),
    };
    setAnswers(nextAnswers);
    setError("");

    const isLast = currentIndex >= questions.length - 1;
    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
      setCurrentAnswer(nextAnswers[questions[currentIndex + 1].key] ?? "");
      return;
    }

    setSaving(true);
    try {
      await api.saveOnboarding(token, nextAnswers);
      await onCompleted();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Erro ao finalizar onboarding");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.loaderWrap}>
        <Text style={styles.error}>{error || "Sem perguntas disponíveis."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
      </View>
      <Text style={styles.kicker}>ONBOARDING COGNITIVO</Text>
      <Text style={styles.title}>Vamos personalizar sua experiência</Text>

      <Card style={styles.questionCard}>
        <Text style={styles.questionIndex}>
          Pergunta {currentIndex + 1} de {questions.length}
        </Text>
        <Text style={styles.questionText}>{currentQuestion.question}</Text>

        <TextInput
          testID="onboarding-answer-input"
          value={currentAnswer}
          onChangeText={setCurrentAnswer}
          placeholder="Digite sua resposta"
          placeholderTextColor={theme.colors.textSecondary}
          multiline
          style={styles.input}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <PrimaryButton
          label={currentIndex >= questions.length - 1 ? "Finalizar onboarding" : "Continuar"}
          onPress={handleNext}
          loading={saving}
          testID="onboarding-next-button"
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
    justifyContent: "center",
  },
  loaderWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  progressTrack: {
    height: 8,
    width: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.brand,
  },
  kicker: {
    color: theme.colors.accent,
    letterSpacing: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    color: theme.colors.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  questionCard: {
    gap: theme.spacing.md,
  },
  questionIndex: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  questionText: {
    fontSize: 22,
    lineHeight: 30,
    color: theme.colors.text,
    fontWeight: "600",
  },
  input: {
    minHeight: 130,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    color: theme.colors.text,
    textAlignVertical: "top",
    backgroundColor: theme.colors.surface,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
  },
});
