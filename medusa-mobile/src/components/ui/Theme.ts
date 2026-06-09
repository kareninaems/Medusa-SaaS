// Design tokens — espelha o design system do web (dark por padrão)
export const colors = {
  bg: "#0a0a0a",
  bgCard: "#111111",
  bgInput: "#1a1a1a",
  border: "#222222",
  text: "#f0f0f0",
  textMuted: "#888888",
  accent: "#9b59b6",      // roxo Medusa
  accentLight: "#c39bd3",
  danger: "#e74c3c",
  success: "#27ae60",
  warning: "#f39c12",
  energy1: "#e74c3c",     // baixa
  energy2: "#f39c12",     // media
  energy3: "#27ae60",     // alta
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
};

export const typography = {
  body: { fontSize: 15, lineHeight: 22, color: colors.text },
  caption: { fontSize: 13, lineHeight: 18, color: colors.textMuted },
  title: { fontSize: 22, fontWeight: "700" as const, color: colors.text },
  subtitle: { fontSize: 17, fontWeight: "600" as const, color: colors.text },
};
