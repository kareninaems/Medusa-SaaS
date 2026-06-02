import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const focusItems = [
  { label: "Sono", value: "7h 20m", tone: "green" },
  { label: "Foco", value: "82%", tone: "blue" },
  { label: "Carga", value: "Media", tone: "amber" },
];

const insights = [
  {
    title: "Melhor janela para estudar",
    body: "Seu pico de energia esta previsto entre 09:30 e 11:00. Reserve esse bloco para a tarefa mais dificil.",
  },
  {
    title: "Risco de sobrecarga",
    body: "Tres tarefas longas estao agrupadas no fim do dia. Mova uma delas para antes do almoco.",
  },
  {
    title: "Proxima acao",
    body: "Comece com uma sessao de 25 minutos e registre como voce se sentiu ao terminar.",
  },
];

export default function Index() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Cogni</Text>
          <Text style={styles.subtitle}>Painel inteligente para rotina, foco e bem-estar.</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>C</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Hoje</Text>
        <Text style={styles.heroTitle}>Seu dia esta equilibrado, mas pede um inicio simples.</Text>
        <Text style={styles.heroCopy}>
          A recomendacao e proteger um bloco de foco agora e reduzir decisoes no fim da tarde.
        </Text>
        <Pressable style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Iniciar foco guiado</Text>
        </Pressable>
      </View>

      <View style={styles.metricsRow}>
        {focusItems.map((item) => (
          <View key={item.label} style={[styles.metricCard, styles[`${item.tone}Card`]]}>
            <Text style={styles.metricLabel}>{item.label}</Text>
            <Text style={styles.metricValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Insights</Text>
        <Text style={styles.sectionAction}>3 novos</Text>
      </View>

      {insights.map((insight, index) => (
        <View key={insight.title} style={styles.insightCard}>
          <View style={styles.insightNumber}>
            <Text style={styles.insightNumberText}>{index + 1}</Text>
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>{insight.title}</Text>
            <Text style={styles.insightBody}>{insight.body}</Text>
          </View>
        </View>
      ))}

      <View style={styles.planCard}>
        <Text style={styles.planTitle}>Plano rapido</Text>
        <Text style={styles.planLine}>09:30 - Foco profundo</Text>
        <Text style={styles.planLine}>12:00 - Pausa e revisao</Text>
        <Text style={styles.planLine}>17:30 - Fechar pendencias leves</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B0F14",
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 54,
    paddingBottom: 36,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 26,
  },
  brand: {
    color: "#F7FAFC",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0,
  },
  subtitle: {
    color: "#9BA7B6",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    maxWidth: 250,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E8F7F0",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  avatarText: {
    color: "#103D2A",
    fontSize: 18,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: "#16202B",
    borderColor: "#263648",
    borderRadius: 8,
    borderWidth: 1,
    padding: 20,
    marginBottom: 18,
  },
  eyebrow: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "800",
    lineHeight: 31,
    letterSpacing: 0,
  },
  heroCopy: {
    color: "#C5CED9",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#55D6A5",
    borderRadius: 8,
    marginTop: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#062218",
    fontSize: 15,
    fontWeight: "800",
  },
  metricsRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  metricCard: {
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
    padding: 14,
  },
  greenCard: {
    backgroundColor: "#12382F",
  },
  blueCard: {
    backgroundColor: "#152F4A",
  },
  amberCard: {
    backgroundColor: "#3D3217",
    marginRight: 0,
  },
  metricLabel: {
    color: "#B7C2CF",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  sectionAction: {
    color: "#55D6A5",
    fontSize: 13,
    fontWeight: "700",
  },
  insightCard: {
    alignItems: "flex-start",
    backgroundColor: "#101720",
    borderColor: "#233142",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
  },
  insightNumber: {
    alignItems: "center",
    backgroundColor: "#263648",
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    marginRight: 12,
    width: 32,
  },
  insightNumberText: {
    color: "#EAF2FA",
    fontSize: 13,
    fontWeight: "800",
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    color: "#F7FAFC",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  insightBody: {
    color: "#AEB9C7",
    fontSize: 14,
    lineHeight: 20,
  },
  planCard: {
    backgroundColor: "#F3F7FB",
    borderRadius: 8,
    marginTop: 8,
    padding: 18,
  },
  planTitle: {
    color: "#0B0F14",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  planLine: {
    color: "#344256",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 25,
  },
});
