import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Route, Routes, Link } from "react-router-dom";

import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { CheckInScreen } from "./components/CheckInScreen";
import { CrisisPage, PrivacyPage, TermsPage } from "./components/LegalPages";
import { OnboardingScreen } from "./components/OnboardingScreen";
// import { PaywallScreen } from "./components/PaywallScreen"; // TEMP disabled
import { SettingsScreen } from "./components/SettingsScreen";
import { PENDING_CONSENT_KEY, PRIVACY_VERSION, TERMS_VERSION } from "./constants/legal";
import { supabase } from "./lib/supabase";
import { detectLoop } from "./services/loopDetector";
import {
  triggerDocumentAnalysis,
  callClaudeProxy,
  confirmAge,
  createCheckoutSession,
  createConversation,
  deleteUserDocument,
  ensureProfile,
  getLatestAssistantMessage,
  getLatestConversation,
  getPreviousConversation,
  getRecentMessagesByUser,
  grantDocumentAnalysisConsent,
  getMemory,
  getMessages,
  insertMessage,
  listUserDocuments,
  needsConsent,
  recordUserConsent,
  resetUserData,
  updateEnergy,
  updateOnboarding,
  uploadUserDocument,
} from "./services/medusa";
import type {
  Conversation,
  EnergyLevel,
  MemoryRow,
  Message,
  Profile,
  UserDocument,
} from "./types/medusa";


type FollowUpAnswer = "sim" | "parcial" | "nao";

const CRISIS_SAFE_FALLBACK =
  "Isso e risco imediato. Eu nao vou tentar resolver isso por chat.\n" +
  "Se voce esta em perigo agora, ligue 188 (CVV), 192 (SAMU) ou 190, ou va para uma emergencia.\n" +
  "Agora: afaste meios de se machucar e chame uma pessoa real para ficar com voce.";

const CRISIS_TERMS = [
  "suicidio",
  "me matar",
  "quero morrer",
  "tentativa de suicidio",
  "autolesao",
  "autoagressao",
  "overdose",
  "nao aguento mais viver",
  "vou me machucar",
  "plano para morrer",
  "remedio para morrer",
  "tomar remedio para morrer",
];


function hasCrisisSignal(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  return CRISIS_TERMS.some((term) => normalized.includes(term));
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}


function extractActionFromAssistant(content: string): string | null {
  if (!content || content.includes("188 (CVV)")) return null;

  const lines = content
    .replace(/\*\*/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;

  const priority =
    lines.find((line) => /^(\d+[\).]|[-•])\s+/.test(line)) ??
    lines.find((line) => normalizeText(line).includes("proximo passo")) ??
    lines[0];

  const normalized = priority.replace(/^(\d+[\).]|[-•])\s+/, "").trim();
  if (normalized.length < 12) return null;
  return normalized.slice(0, 160);
}

function computeBurnoutSignals(recentMessages: Message[]): {
  isRisk: boolean;
  trackedDays: number;
  lowDays: number;
} {
  const grouped = new Map<string, number[]>();

  recentMessages.forEach((message) => {
    if (message.role !== "user") return;
    if (typeof message.energy !== "number") return;
    const day = message.created_at.slice(0, 10);
    const bucket = grouped.get(day) ?? [];
    bucket.push(message.energy);
    grouped.set(day, bucket);
  });

  const dayAverages = Array.from(grouped.entries())
    .map(([day, energies]) => ({
      day,
      avg: energies.reduce((sum, value) => sum + value, 0) / energies.length,
    }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const lastThree = dayAverages.slice(0, 3);
  const isRisk = lastThree.length >= 3 && lastThree.every((item) => item.avg <= 1.4);
  const lowDays = dayAverages.filter((item) => item.avg <= 1.4).length;

  return {
    isRisk,
    trackedDays: dayAverages.length,
    lowDays,
  };
}


function isSameDay(isoDate: string): boolean {
  const created = new Date(isoDate);
  const now = new Date();

  return (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate()
  );
}

function ConsentGate({
  loading,
  onAccept,
}: {
  loading: boolean;
  onAccept: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="screen compact" data-testid="consent-gate-screen">
      <p className="eyebrow">Consentimento</p>
      <h2>Confirme os documentos legais para continuar</h2>
      <p className="muted">
        Versoes atuais: Termos {TERMS_VERSION} / Privacidade {PRIVACY_VERSION}
      </p>

      <label className="check-row">
        <input
          data-testid="consent-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>
          Li e aceito os <Link to="/terms">Termos de Uso</Link> e a{" "}
          <Link to="/privacy">Politica de Privacidade</Link>.
        </span>
      </label>

      <button data-testid="consent-accept-button" className="primary-btn" disabled={!checked || loading} onClick={onAccept}>
        {loading ? "Registrando aceite..." : "Aceitar e continuar"}
      </button>

      <p className="muted">
        Este documento e um modelo inicial e deve ser revisado por profissional juridico antes do lancamento publico.
      </p>
    </div>
  );
}

function AgeGate({
  loading,
  onConfirm,
}: {
  loading: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="screen compact" data-testid="age-gate-screen">
      <p className="eyebrow">Seguranca</p>
      <h2>Confirmacao obrigatoria de idade</h2>
      <p className="muted">A Medusa e destinada apenas para pessoas com 18 anos ou mais.</p>

      <label className="check-row">
        <input
          data-testid="age-confirm-checkbox"
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>Declaro que tenho 18 anos ou mais.</span>
      </label>

      <button data-testid="age-confirm-continue-button" className="primary-btn" disabled={!checked || loading} onClick={onConfirm}>
        {loading ? "Validando..." : "Continuar"}
      </button>
    </div>
  );
}

function ProductApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [memory, setMemory] = useState<MemoryRow | null>(null);
  const [recentSignals, setRecentSignals] = useState<Message[]>([]);
  const [followUpAction, setFollowUpAction] = useState<string | null>(null);
  const [checkInEnergy, setCheckInEnergy] = useState<EnergyLevel | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [confirmingAge, setConfirmingAge] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [activeDocumentActionId, setActiveDocumentActionId] = useState<string | null>(null);
  const [_checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

  const onboardingMissing = useMemo(() => {
    if (!profile?.onboarding) return true;

    const hasArray = (value: unknown) => Array.isArray(value) && value.length > 0;
    const routineDays = profile.onboarding.routine?.days;
    const routinePeriods = profile.onboarding.routine?.periods;

    return (
      !profile.onboarding.education_level ||
      !profile.onboarding.profession_category ||
      !hasArray(profile.onboarding.constraints) ||
      !hasArray(profile.onboarding.blockers) ||
      !hasArray(profile.onboarding.low_energy_works) ||
      !profile.onboarding.guidance_style ||
      !hasArray(profile.onboarding.never_do) ||
      !hasArray(routineDays) ||
      !hasArray(routinePeriods)
    );
  }, [profile]);

  const needsAgeConfirmation = useMemo(() => {
    if (!profile) return true;
    const confirmedViaColumns = Boolean(profile.age_confirmed_at);
    const confirmedViaFallback = Boolean(profile.onboarding?.age_confirmed);
    return !(confirmedViaColumns || confirmedViaFallback);
  }, [profile]);

  const currentEnergy = checkInEnergy ?? profile?.energy_default ?? 2;
  const activeLoop = useMemo(() => {
    const msgTexts = messages.filter((m) => m.role === "user" || m.role === "assistant").map((m) => m.content);
    const energyLog = recentSignals.filter((m) => m.role === "user" && typeof m.energy === "number").map((m) => m.energy as number);
    return detectLoop(msgTexts, energyLog);
  }, [messages, recentSignals]);
  const burnoutSignals = useMemo(() => computeBurnoutSignals(recentSignals), [recentSignals]);

  const bootstrap = async (activeSession: Session) => {
    setLoading(true);
    setError("");
    try {
      let ensuredProfile = await ensureProfile(activeSession);
      const pendingConsent = localStorage.getItem(PENDING_CONSENT_KEY) === "true";
      if (needsConsent(ensuredProfile) && pendingConsent) {
        await recordUserConsent({
          userId: activeSession.user.id,
          userAgent: navigator.userAgent,
        });
        localStorage.removeItem(PENDING_CONSENT_KEY);
        ensuredProfile = await ensureProfile(activeSession);
      }

      const latestConversation = await getLatestConversation(activeSession.user.id);
      const canReuseConversation = Boolean(latestConversation?.created_at && isSameDay(latestConversation.created_at));

      const [loadedMemory, loadedDocuments, loadedMessages, loadedRecentSignals] = await Promise.all([
        getMemory(activeSession.user.id),
        listUserDocuments(activeSession.user.id),
        canReuseConversation && latestConversation ? getMessages(latestConversation.id) : Promise.resolve([]),
        getRecentMessagesByUser(activeSession.user.id, 7),
      ]);

      const followUpSourceConversation = canReuseConversation
        ? await getPreviousConversation(activeSession.user.id, latestConversation?.id ?? null)
        : latestConversation;

      let nextFollowUpAction: string | null = null;
      if (followUpSourceConversation?.id) {
        const latestAssistant = await getLatestAssistantMessage(followUpSourceConversation.id);
        nextFollowUpAction = extractActionFromAssistant(latestAssistant?.content ?? "");
      }

      setProfile(ensuredProfile);
      setConversation(canReuseConversation ? latestConversation : null);
      setMessages(loadedMessages);
      setMemory(loadedMemory);
      setDocuments(loadedDocuments);
      setRecentSignals(loadedRecentSignals);
      setFollowUpAction(nextFollowUpAction);
      setCheckInEnergy(null);
      setCheckInDone(canReuseConversation);
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : "Falha ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        await bootstrap(data.session);
      } else {
        setLoading(false);
      }
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession);

      if (event === "TOKEN_REFRESHED") {
        return;
      }

      if (nextSession) {
        await bootstrap(nextSession);
      } else {
        setProfile(null);
        setConversation(null);
        setMessages([]);
        setDocuments([]);
        setMemory(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) return;

    const channel = supabase
      .channel("user-documents-realtime")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_documents",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          setDocuments((current) =>
            current.map((doc) =>
              doc.id === payload.new.id ? { ...doc, ...(payload.new as UserDocument) } : doc
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleOnboardingSave = async (payload: {
    displayName: string;
    onboarding: Profile["onboarding"];
  }) => {
    if (!session || !payload.onboarding) return;
    setSavingOnboarding(true);
    setError("");
    try {
      const onboardingWithAgeFallback = {
        ...payload.onboarding,
        age_confirmed:
          payload.onboarding.age_confirmed ??
          profile?.onboarding?.age_confirmed ??
          Boolean(profile?.age_confirmed_at),
        age_confirmed_at:
          payload.onboarding.age_confirmed_at ??
          profile?.onboarding?.age_confirmed_at ??
          profile?.age_confirmed_at ??
          undefined,
      };

      const updatedProfile = await updateOnboarding(
        session.user.id,
        payload.displayName,
        onboardingWithAgeFallback,
      );
      setProfile(updatedProfile);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar onboarding");
    } finally {
      setSavingOnboarding(false);
    }
  };

  const handleCheckIn = async (energy: EnergyLevel) => {
    if (!session) return;
    setSavingCheckIn(true);
    setError("");
    try {
      await updateEnergy(session.user.id, energy);
      const freshConversation = await createConversation(session.user.id);
      setProfile((current) => (current ? { ...current, energy_default: energy } : current));
      setConversation(freshConversation);
      setMessages([]);
      setCheckInEnergy(energy);
      setCheckInDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar check-in");
    } finally {
      setSavingCheckIn(false);
    }
  };

  const handleConfirmAge = async () => {
    if (!session) return;
    setConfirmingAge(true);
    setError("");
    try {
      const supportsAgeColumns = Boolean(profile && "age_confirmed_at" in profile);
      const updatedProfile = await confirmAge(session.user.id, supportsAgeColumns);
      setProfile(updatedProfile);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Falha ao confirmar idade");
    } finally {
      setConfirmingAge(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    if (!session) return;
    setUploadingDocument(true);
    setError("");
    try {
      const createdDocument = await uploadUserDocument(session.user.id, file);
      setDocuments((current) => [createdDocument, ...current]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Falha no upload do documento");
      throw uploadError;
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleRefreshDocuments = async () => {
    if (!session) return;
    setLoadingDocuments(true);
    setError("");
    try {
      const freshDocuments = await listUserDocuments(session.user.id);
      setDocuments(freshDocuments);
    } catch (documentsError) {
      setError(documentsError instanceof Error ? documentsError.message : "Falha ao carregar documentos");
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleGrantDocumentConsent = async (documentId: string) => {
    if (!session) return;
    setActiveDocumentActionId(documentId);
    setError("");
    try {
      const updated = await grantDocumentAnalysisConsent(session.user.id, documentId);
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === documentId ? { ...updated, analysis_status: "analyzing" } : doc
        )
      );
      triggerDocumentAnalysis(session, documentId);
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Falha ao salvar consentimento");
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleDeleteDocument = async (document: UserDocument) => {
    if (!session) return;
    setActiveDocumentActionId(document.id);
    setError("");
    try {
      await deleteUserDocument(session.user.id, document);
      setDocuments((current) => current.filter((doc) => doc.id !== document.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Falha ao excluir documento");
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleAnalyzeDocument = async (documentId: string) => {
    if (!session) return;
    setActiveDocumentActionId(documentId);
    setError("");
    try {
      setDocuments((current) =>
        current.map((doc) =>
          doc.id === documentId ? { ...doc, analysis_status: "analyzing" } : doc
        )
      );
      triggerDocumentAnalysis(session, documentId);
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Falha ao analisar documento");
      await handleRefreshDocuments();
    } finally {
      setActiveDocumentActionId(null);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!session || !conversation || !profile) return;
    setSendingChat(true);
    setError("");
    const mode = "ACAO";

    try {
      const userMessage = await insertMessage({
        conversation_id: conversation.id,
        user_id: session.user.id,
        role: "user",
        content: text,
        energy: currentEnergy,
        mode,
      });
      setMessages((current) => [...current, userMessage]);

      const historyForModel = [...messages, userMessage]
        .filter((item) => item.role === "user" || item.role === "assistant")
        .slice(-12)
        .map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.content,
        }));

      const proxyResponse = await callClaudeProxy(session, {
        messages: historyForModel,
        energy: currentEnergy,
        mode,
        onboarding: profile.onboarding ? { ...profile.onboarding, display_name: profile.display_name } : null,
        memory,
        activeLoop: activeLoop.loop ?? null,
      });

      const assistantMessage = await insertMessage({
        conversation_id: conversation.id,
        user_id: session.user.id,
        role: "assistant",
        content: proxyResponse.reply,
        energy: currentEnergy,
        mode,
      });

      setMessages((current) => [...current, assistantMessage]);
    } catch (chatError) {
      if (hasCrisisSignal(text)) {
        try {
          const fallbackAssistantMessage = await insertMessage({
            conversation_id: conversation.id,
            user_id: session.user.id,
            role: "assistant",
            content: CRISIS_SAFE_FALLBACK,
            energy: currentEnergy,
            mode,
          });
          setMessages((current) => [...current, fallbackAssistantMessage]);
        } catch {
          const fallbackLocal: Message = {
            id: `local-crisis-${Date.now()}`,
            conversation_id: conversation.id,
            user_id: session.user.id,
            role: "assistant",
            content: CRISIS_SAFE_FALLBACK,
            energy: currentEnergy,
            mode,
            created_at: new Date().toISOString(),
          };
          setMessages((current) => [...current, fallbackLocal]);
        }
        setError("");
      } else {
        setError(chatError instanceof Error ? chatError.message : "Erro ao enviar mensagem");
      }
    } finally {
      setSendingChat(false);
    }
  };

  const handleFollowUpAnswer = async (answer: FollowUpAnswer) => {
    if (!followUpAction) return;

    const payload = `Follow-up de evidencia: ${answer}.\nAcao combinada: ${followUpAction}`;
    await handleSendMessage(payload);
    setFollowUpAction(null);
  };

  const handleReset = async () => {
    if (!session) return;
    setResetting(true);
    setError("");
    try {
      await resetUserData(session.user.id);
      setDocuments([]);
      await bootstrap(session);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Erro ao resetar dados");
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleCheckout = async () => {
    if (!session) return;
    setCheckingOut(true);
    setError("");
    try {
      const { url } = await createCheckoutSession(session);
      window.location.href = url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Falha ao iniciar checkout");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleAcceptConsent = async () => {
    if (!session) return;
    setSavingConsent(true);
    setError("");
    try {
      await recordUserConsent({ userId: session.user.id, userAgent: navigator.userAgent });
      localStorage.removeItem(PENDING_CONSENT_KEY);
      const refreshed = await ensureProfile(session);
      setProfile(refreshed);
    } catch (consentError) {
      setError(consentError instanceof Error ? consentError.message : "Falha ao registrar consentimento");
    } finally {
      setSavingConsent(false);
    }
  };

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted" data-testid="app-loading-state">Carregando dados...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthDone={async () => undefined} />;
  }

  if (!profile) {
    return (
      <div className="app-shell">
        <p className="muted" data-testid="profile-loading-state">Carregando perfil...</p>
      </div>
    );
  }

  if (needsAgeConfirmation) {
    return (
      <div className="app-shell">
        <AgeGate loading={confirmingAge} onConfirm={handleConfirmAge} />
        {error ? <p className="status-error" data-testid="age-gate-error">{error}</p> : null}
      </div>
    );
  }

  if (needsConsent(profile)) {
    return (
      <div className="app-shell">
        <ConsentGate loading={savingConsent} onAccept={handleAcceptConsent} />
        {error ? <p className="status-error" data-testid="consent-gate-error">{error}</p> : null}
      </div>
    );
  }

  if (onboardingMissing) {
    return (
      <div className="app-shell">
        <OnboardingScreen
          loading={savingOnboarding}
          uploadingDocument={uploadingDocument}
          defaultName={session.user.email?.split("@")[0] ?? "usuario"}
          onUploadDocument={handleUploadDocument}
          onSave={handleOnboardingSave}
        />
        {error ? <p className="status-error" data-testid="onboarding-flow-error">{error}</p> : null}
      </div>
    );
  }

  if (!checkInDone) {
    return (
      <div className="app-shell">
        <CheckInScreen
          loading={savingCheckIn}
          defaultEnergy={profile.energy_default}
          onConfirm={handleCheckIn}
        />
        {error ? <p className="status-error" data-testid="checkin-flow-error">{error}</p> : null}
      </div>
    );
  }

  // TEMP: paywall disabled for owner testing — re-enable before public launch
  // const isSubscribed =
  //   profile.subscription_status === "active" || profile.subscription_status === "trialing";
  // if (!isSubscribed) {
  //   return (
  //     <div className="app-shell">
  //       <PaywallScreen onCheckout={handleCheckout} loading={checkingOut} />
  //       {error ? <p className="status-error" data-testid="paywall-error">{error}</p> : null}
  //     </div>
  //   );
  // }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Medusa</p>
          <h1 className="app-title">Medusa</h1>
          <p className="muted" data-testid="current-energy-indicator">Energia atual: {currentEnergy}</p>
          <p className="muted" data-testid="active-loop-indicator">
            Estado atual: {activeLoop.loop ?? "EM OBSERVACAO"}
            {activeLoop.loop && activeLoop.confidence > 0 ? ` (${Math.round(activeLoop.confidence * 100)}%)` : ""}
          </p>
        </div>
      </header>

      {error ? <p className="status-error" data-testid="product-app-error">{error}</p> : null}

      <section className="chat-signals" data-testid="chat-signals-panel">
        {burnoutSignals.isRisk ? (
          <div className="signal-card signal-risk" data-testid="burnout-risk-card">
            <p className="signal-title">Risco de pre-BURNOUT detectado</p>
            <p className="signal-copy">
              Ultimos 3 dias com energia baixa. Hoje a recomendacao e protecao: nenhuma nova tarefa critica.
            </p>
          </div>
        ) : null}

        {checkInEnergy !== null && followUpAction ? (
          <div className="signal-card signal-followup" data-testid="followup-card">
            <p className="signal-title">Follow-up automatico</p>
            <p className="signal-copy">Ontem voce combinou: {followUpAction}</p>
            <div className="followup-actions">
              <button
                data-testid="followup-answer-yes-button"
                className="ghost-btn"
                onClick={() => handleFollowUpAnswer("sim")}
                disabled={sendingChat}
              >
                Sim
              </button>
              <button
                data-testid="followup-answer-partial-button"
                className="ghost-btn"
                onClick={() => handleFollowUpAnswer("parcial")}
                disabled={sendingChat}
              >
                Parcial
              </button>
              <button
                data-testid="followup-answer-no-button"
                className="ghost-btn"
                onClick={() => handleFollowUpAnswer("nao")}
                disabled={sendingChat}
              >
                Nao
              </button>
            </div>
          </div>
        ) : null}

        <p className="muted" data-testid="weekly-load-summary">
          Carga da semana: {burnoutSignals.lowDays} dia(s) de energia baixa em {burnoutSignals.trackedDays} dia(s) com registro.
        </p>
      </section>

      <ChatScreen
        messages={messages}
        sending={sendingChat}
        energy={currentEnergy}
        onSend={handleSendMessage}
      />

      <div className="setup-column">
        <SettingsScreen
          session={session}
          documents={documents}
          loadingDocuments={loadingDocuments}
          activeDocumentActionId={activeDocumentActionId}
          onGrantDocumentConsent={handleGrantDocumentConsent}
          onAnalyzeDocument={handleAnalyzeDocument}
          onDeleteDocument={handleDeleteDocument}
          onRefreshDocuments={handleRefreshDocuments}
          resetting={resetting}
          onReset={handleReset}
          onSignOut={handleSignOut}
          subscriptionStatus={profile.subscription_status}
          onManageSubscription={handleCheckout}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<ProductApp />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/crisis" element={<CrisisPage />} />
      <Route path="*" element={<ProductApp />} />
    </Routes>
  );
}

export default App;
