import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { AuthScreen } from "./components/AuthScreen";
import { ChatScreen } from "./components/ChatScreen";
import { CheckInScreen } from "./components/CheckInScreen";
import { MemoryScreen } from "./components/MemoryScreen";
import { OnboardingScreen } from "./components/OnboardingScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { supabase } from "./lib/supabase";
import {
  callClaudeProxy,
  ensureConversation,
  ensureProfile,
  getMemory,
  getMessages,
  insertMessage,
  resetUserData,
  updateEnergy,
  updateOnboarding,
  upsertMemory,
} from "./services/medusa";
import type {
  Conversation,
  EnergyLevel,
  MedusaMode,
  MemoryRow,
  Message,
  Profile,
} from "./types/medusa";

type AppTab = "chat" | "memory" | "setup";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
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
  const [error, setError] = useState("");

  const onboardingMissing = useMemo(() => {
    if (!profile?.onboarding) return true;
    return !profile.onboarding.education_level || !profile.onboarding.profession || !profile.onboarding.routine;
  }, [profile]);

  const currentEnergy = checkInEnergy ?? profile?.energy_default ?? 2;

  const bootstrap = async (activeSession: Session) => {
    setLoading(true);
    setError("");
    try {
      const ensuredProfile = await ensureProfile(activeSession);
      const activeConversation = await ensureConversation(activeSession.user.id);
      const [loadedMessages, loadedMemory] = await Promise.all([
        getMessages(activeConversation.id),
        getMemory(activeSession.user.id),
      ]);
      setProfile(ensuredProfile);
      setConversation(activeConversation);
      setMessages(loadedMessages);
      setMemory(loadedMemory);
      setCheckInEnergy(null);
      setCheckInDone(false);
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
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        await bootstrap(nextSession);
      } else {
        setProfile(null);
        setConversation(null);
        setMessages([]);
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
      const updatedProfile = await updateOnboarding(
        session.user.id,
        payload.displayName,
        payload.onboarding,
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
      setProfile((current) => (current ? { ...current, energy_default: energy } : current));
      setCheckInEnergy(energy);
      setCheckInDone(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar check-in");
    } finally {
      setSavingCheckIn(false);
    }
  };

  const handleSendMessage = async (text: string, mode: MedusaMode) => {
    if (!session || !conversation || !profile) return;
    setSendingChat(true);
    setError("");

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
        onboarding: profile.onboarding,
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
      setError(chatError instanceof Error ? chatError.message : "Erro ao enviar mensagem");
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

  if (loading) {
    return (
      <div className="app-shell">
        <p className="muted">Carregando Medusa...</p>
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onAuthDone={async () => undefined} />;
  }

  if (!profile || onboardingMissing) {
    return (
      <div className="app-shell">
        <OnboardingScreen
          loading={savingOnboarding}
          defaultName={session.user.email?.split("@")[0] ?? "usuário"}
          onSave={handleOnboardingSave}
        />
        {error ? <p className="status-error">{error}</p> : null}
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
        {error ? <p className="status-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">MEDUSA</p>
          <h1>Sincronização cognitiva/emocional</h1>
        </div>
        <nav className="top-tabs">
          <button className={`ghost-btn ${tab === "chat" ? "active-tab" : ""}`} onClick={() => setTab("chat")}>
            Chat
          </button>
          <button className={`ghost-btn ${tab === "memory" ? "active-tab" : ""}`} onClick={() => setTab("memory")}>
            Memória
          </button>
          <button className={`ghost-btn ${tab === "setup" ? "active-tab" : ""}`} onClick={() => setTab("setup")}>
            Setup
          </button>
        </nav>
      </header>

      {error ? <p className="status-error">{error}</p> : null}

      {tab === "chat" ? (
        <ChatScreen
          messages={messages}
          sending={sendingChat}
          energy={currentEnergy}
          onSend={handleSendMessage}
        />
      ) : null}
      {tab === "memory" ? (
        <MemoryScreen memory={memory} saving={savingMemory} onSave={handleSaveMemory} />
      ) : null}
      {tab === "setup" ? (
        <SettingsScreen session={session} resetting={resetting} onReset={handleReset} onSignOut={handleSignOut} />
      ) : null}
    </div>
  );
}

export default App;
