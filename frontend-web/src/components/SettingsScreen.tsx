import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import type { SubscriptionStatus, UserDocument } from "../types/medusa";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

interface SettingsScreenProps {
  session: Session;
  documents: UserDocument[];
  loadingDocuments?: boolean;
  uploadingDocument?: boolean;
  activeDocumentActionId?: string | null;
  resetting?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  onUploadDocument: (files: File[]) => Promise<void>;
  onGrantDocumentConsent: (documentId: string) => Promise<void>;
  onAnalyzeDocument: (documentId: string) => Promise<void>;
  onDeleteDocument: (document: UserDocument) => Promise<void>;
  onRefreshDocuments: () => Promise<void>;
  onReset: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onManageSubscription?: () => Promise<void>;
}

const STATUS_LABELS: Record<UserDocument["analysis_status"], string> = {
  uploaded: "Enviado",
  awaiting_analysis: "Aguardando análise",
  analyzing: "Analisando...",
  analyzed: "Analisado",
  error: "Erro",
};

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  free: "Gratuito",
  trialing: "Período de teste",
  active: "Ativo",
  past_due: "Pagamento pendente",
  canceled: "Cancelado",
  incomplete: "Incompleto",
};

export function SettingsScreen({
  session,
  documents,
  loadingDocuments = false,
  uploadingDocument = false,
  activeDocumentActionId = null,
  resetting = false,
  subscriptionStatus,
  onUploadDocument,
  onGrantDocumentConsent,
  onAnalyzeDocument,
  onDeleteDocument,
  onRefreshDocuments,
  onReset,
  onSignOut,
  onManageSubscription,
}: SettingsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadConsent, setUploadConsent] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    if (!picked.length) return;
    const invalid = picked.filter((f) => !ALLOWED_MIME.includes(f.type));
    if (invalid.length) {
      setUploadError("Apenas PDF, JPG e PNG são aceitos.");
      event.target.value = "";
      return;
    }
    setUploadError("");
    try {
      await onUploadDocument(picked);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar arquivo.");
    } finally {
      event.target.value = "";
    }
  };

  const confirmReset = async () => {
    if (resetPhrase !== "CONFIRMAR") return;
    await onReset();
    setShowResetConfirm(false);
    setResetPhrase("");
  };

  const confirmDeleteDocument = async (document: UserDocument) => {
    const confirmed = window.confirm("Excluir este documento? Isso remove arquivo e registro.");
    if (!confirmed) return;
    await onDeleteDocument(document);
  };

  const formatDateTime = (value: string) => {
    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch {
      return value;
    }
  };

  return (
    <section className="panel" data-testid="settings-screen">
      <h2>Setup</h2>
      <p className="muted" data-testid="settings-account-email">Conta: {session.user.email}</p>
      <p className="muted">Próximo passo: escolha uma ação abaixo.</p>

      <div className="setup-list">
        <div className="setup-item">
          <strong>Ver conta</strong>
          <span>{session.user.email}</span>
        </div>

        {subscriptionStatus !== undefined ? (
          <div className="setup-item" data-testid="settings-subscription-section">
            <strong>Assinatura</strong>
            <span data-testid="settings-subscription-status">
              Status: {SUBSCRIPTION_STATUS_LABELS[subscriptionStatus] ?? subscriptionStatus}
            </span>
            {onManageSubscription ? (
              <button
                data-testid="settings-manage-subscription-button"
                className="ghost-btn"
                onClick={onManageSubscription}
              >
                Gerenciar assinatura
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="setup-item">
          <strong>Resetar dados</strong>
          <span>Apaga histórico, memória e onboarding.</span>
          <button
            data-testid="settings-reset-button"
            className="ghost-btn"
            onClick={() => setShowResetConfirm(true)}
            disabled={resetting}
          >
            {resetting ? "Resetando" : "Resetar dados"}
          </button>
        </div>

        {showResetConfirm ? (
          <div className="setup-item" data-testid="settings-reset-confirmation">
            <strong>Confirmar reset total</strong>
            <span>
              Isso apaga historico de chat, memoria, documentos vinculados, onboarding e configuracoes da conta.
              Digite CONFIRMAR para liberar a acao.
            </span>
            <input
              className="input"
              data-testid="settings-reset-confirmation-input"
              value={resetPhrase}
              onChange={(event) => setResetPhrase(event.target.value)}
              placeholder="CONFIRMAR"
            />
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <button
                data-testid="settings-reset-confirm-button"
                className="primary-btn"
                onClick={confirmReset}
                disabled={resetting || resetPhrase !== "CONFIRMAR"}
              >
                {resetting ? "Resetando..." : "Confirmar reset"}
              </button>
              <button
                data-testid="settings-reset-cancel-button"
                className="ghost-btn"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetPhrase("");
                }}
                disabled={resetting}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}

        <div className="setup-item">
          <strong>Sair</strong>
          <span>Encerra a sessão atual.</span>
          <button data-testid="settings-signout-button" className="primary-btn" onClick={onSignOut}>
            Sair da conta
          </button>
        </div>

        <div className="setup-item">
          <strong>Voz</strong>
          <span>Recurso futuro. Ainda não disponível neste MVP.</span>
          <button data-testid="settings-voice-placeholder-button" className="ghost-btn" disabled>
            Voz em breve
          </button>
        </div>

        <div className="setup-item" data-testid="settings-documents-section">
          <strong>Documentos</strong>
          <span>PDFs enviados por você. A análise só poderá ocorrer com consentimento explícito por documento.</span>
          <button
            data-testid="settings-documents-refresh-button"
            className="ghost-btn"
            onClick={onRefreshDocuments}
            disabled={loadingDocuments}
          >
            {loadingDocuments ? "Atualizando..." : "Atualizar lista"}
          </button>

          <div data-testid="settings-upload-area" style={{ margin: "0.75rem 0" }}>
            <label className="check-row" style={{ marginBottom: "0.5rem" }}>
              <input
                data-testid="settings-upload-consent-checkbox"
                type="checkbox"
                checked={uploadConsent}
                onChange={(e) => setUploadConsent(e.target.checked)}
              />
              <span style={{ fontSize: "0.85rem" }}>
                Autorizo a Medusa a analisar este documento para personalizar minhas respostas.
              </span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
              data-testid="settings-file-input"
            />
            <button
              data-testid="settings-upload-button"
              className="primary-btn"
              disabled={!uploadConsent || uploadingDocument}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingDocument ? "Enviando..." : "Adicionar documento (PDF, JPG, PNG)"}
            </button>
            {uploadError ? (
              <p className="status-error" data-testid="settings-upload-error" style={{ marginTop: "0.4rem" }}>
                {uploadError}
              </p>
            ) : null}
          </div>

          {documents.length === 0 ? (
            <p className="muted" data-testid="settings-documents-empty-state">Nenhum documento enviado ainda.</p>
          ) : (
            <div className="documents-list" data-testid="settings-documents-list">
              {documents.map((document) => {
                const statusLabel = STATUS_LABELS[document.analysis_status] ?? "Enviado";
                const isBusy = activeDocumentActionId === document.id;
                const isAnalyzing = document.analysis_status === "analyzing";
                return (
                  <article
                    className="document-item"
                    key={document.id}
                    data-testid={`settings-document-item-${document.id}`}
                  >
                    <p className="document-name" data-testid={`settings-document-name-${document.id}`}>
                      {document.file_name || "documento.pdf"}
                    </p>
                    <p className="muted" data-testid={`settings-document-uploaded-at-${document.id}`}>
                      Upload: {formatDateTime(document.uploaded_at)}
                    </p>
                    <p className="muted" data-testid={`settings-document-status-${document.id}`}>
                      Status: {statusLabel}
                    </p>
                    <p className="muted" data-testid={`settings-document-consent-${document.id}`}>
                      {document.analysis_consent_at
                        ? `Consentimento: ${formatDateTime(document.analysis_consent_at)} (v${document.analysis_consent_version || "2026-05"})`
                        : "Sem consentimento para análise."}
                    </p>

                    {!document.analysis_consent_at ? (
                      <button
                        data-testid={`settings-document-consent-button-${document.id}`}
                        className="primary-btn"
                        disabled={isBusy}
                        onClick={() => onGrantDocumentConsent(document.id)}
                      >
                        {isBusy
                          ? "Salvando consentimento..."
                          : "Autorizo a Medusa a analisar este documento para personalizar minhas respostas."}
                      </button>
                    ) : null}

                    {document.analysis_consent_at &&
                    (document.analysis_status === "awaiting_analysis" || document.analysis_status === "analyzing") ? (
                      <>
                        <p className="muted" data-testid={`settings-document-analyzing-info-${document.id}`}>
                          {isAnalyzing ? "Analise em andamento..." : "Pronto para analisar."}
                        </p>
                        <button
                          data-testid={`settings-document-analyze-button-${document.id}`}
                          className="primary-btn"
                          disabled={isBusy || isAnalyzing}
                          onClick={() => onAnalyzeDocument(document.id)}
                        >
                          {isBusy || isAnalyzing ? "Analisando..." : "Analisar"}
                        </button>
                      </>
                    ) : null}

                    {document.analysis_consent_at && document.analysis_status === "error" ? (
                      <>
                        <p className="status-error" data-testid={`settings-document-analysis-error-${document.id}`}>
                          Erro na análise. Tentar novamente.
                        </p>
                        <button
                          data-testid={`settings-document-retry-analysis-button-${document.id}`}
                          className="primary-btn"
                          disabled={isBusy}
                          onClick={() => onAnalyzeDocument(document.id)}
                        >
                          {isBusy ? "Analisando..." : "Tentar novamente"}
                        </button>
                      </>
                    ) : null}

                    <button
                      data-testid={`settings-document-delete-button-${document.id}`}
                      className="ghost-btn"
                      disabled={isBusy}
                      onClick={() => confirmDeleteDocument(document)}
                    >
                      {isBusy ? "Excluindo..." : "Excluir documento"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="legal-links-row">
          <Link to="/terms" data-testid="settings-terms-link">Termos</Link>
          <Link to="/privacy" data-testid="settings-privacy-link">Privacidade</Link>
          <Link to="/crisis" data-testid="settings-crisis-link">Crise</Link>
        </div>
      </div>
    </section>
  );
}
