import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Route, Routes, Link } from "react-router-dom";

import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { CheckInScreen } from "./components/CheckInScreen";
import { CrisisPage, PrivacyPage, TermsPage } from "./components/LegalPages";
import { MemoryScreen } from "./components/MemoryScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { PENDING_CONSENT_KEY, PRIVACY_VERSION, TERMS_VERSION } from "./constants/legal";
import { supabase } from "./lib/supabase";
import {
  analyzeDocument,
  callClaudeProxy,
  confirmAge,
  createConversation,
  deleteUserDocument,
  ensureProfile,
  getLatestConversation,
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
  upsertMemory,
} from "./services/medusa";
import type {
  Conversation,
  EnergyLevel,
  MemoryRow,
  Message,
  Profile,
  UserDocument,
} from "./types/medusa";

type AppTab = "chat" | "setup";

const CRISIS_SAFE_FALLBACK =
  "Isso é risco imediato. Eu não vou tentar resolver isso por chat.\n" +
  "Se você está em perigo agora, ligue 188 (CVV), 192 (SAMU) ou 190, ou vá para uma emergência.\n" +
  "Agora: afaste meios de se machucar e chame uma pessoa real para ficar com você.";

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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return CRISIS_TERMS.some((term) => normalized.includes(term));
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
        Versões atuais: Termos {TERMS_VERSION} / Privacidade {PRIVACY_VERSION}
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
          <Link to="/privacy">Política de Privacidade</Link>.
        </span>
      </label>

      <button data-testid="consent-accept-button" className="primary-btn" disabled={!checked || loading} onClick={onAccept}>
        {loading ? "Registrando aceite..." : "Aceitar e continuar"}
      </button>

      <p className="muted">
        Este documento é um modelo inicial e deve ser revisado por profissional jurídico antes do lançamento público.
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
      <p className="eyebrow">Segurança</p>
      <h2>Confirmação obrigatória de idade</h2>
      <p className="muted">A Medusa é destinada apenas para pessoas com 18 anos ou mais.</p>

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
  const [checkInEnergy, setCheckInEnergy] = useState<EnergyLevel | null>(null);
  const [checkInDone, setCheckInDone] = useState(false);
  const [tab, setTab] = useState<AppTab>("chat");
  const [loading, setLoading] = useState(true);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [confirmingAge, setConfirmingAge] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [activeDocumentActionId, setActiveDocumentActionId] = useState<string | null>(null);
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

      const [loadedMemory, loadedDocuments, loadedMessages] = await Promise.all([
        getMemory(activeSession.user.id),
        listUserDocuments(activeSession.user.id),
        canReuseConversation && latestConversation ? getMessages(latestConversation.id) : Promise.resolve([]),
      ]);

      setProfile(ensuredProfile);
      setConversation(canReuseConversation ? latestConversation : null);
      setMessages(loadedMessages);
      setMemory(loadedMemory);
      setDocuments(loadedDocuments);
      setCheckInEnergy(null);
      setCheckInDone(canReuseConversation);
      setTab("chat");
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
      setTab("chat");
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
      setDocuments((current) => current.map((doc) => (doc.id === documentId ? updated : doc)));
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
      const updated = await analyzeDocument(session, documentId);
      setDocuments((current) => current.map((doc) => (doc.id === documentId ? updated : doc)));
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

  const handleSaveMemory = async (payload: {
    patterns: string[];
    triggers: string[];
    worked: string[];
    didnt_work: string[];
    context: string[];
  }) => {
    if (!session) return;
    setSavingMemory(true);
    setError("");
    try {
      const updated = await upsertMemory(session.user.id, payload);
      setMemory(updated);
    } catch (memoryError) {
      setError(memoryError instanceof Error ? memoryError.message : "Erro ao salvar memória");
    } finally {
      setSavingMemory(false);
    }
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
          defaultName={session.user.email?.split("@")[0] ?? "usuário"}
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

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <p className="eyebrow">Medusa</p>
          <h1 className="app-title">Medusa</h1>
          <p className="muted">Energia atual: {currentEnergy}</p>
        </div>
        <nav className="top-tabs">
          <button
            data-testid="top-tab-chat-button"
            className={`ghost-btn ${tab === "chat" ? "active-tab" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat
          </button>
          <button
            data-testid="top-tab-setup-button"
            className={`ghost-btn ${tab === "setup" ? "active-tab" : ""}`}
            onClick={() => setTab("setup")}
          >
            Setup
          </button>
        </nav>
      </header>

      {error ? <p className="status-error" data-testid="product-app-error">{error}</p> : null}

      {tab === "chat" ? (
        <ChatScreen
          messages={messages}
          sending={sendingChat}
          energy={currentEnergy}
          onSend={handleSendMessage}
        />
      ) : null}
      {tab === "setup" ? (
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
          />
          <MemoryScreen memory={memory} saving={savingMemory} onSave={handleSaveMemory} />
        </div>
      ) : null}
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
