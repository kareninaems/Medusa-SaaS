import type { Session } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import type { UserDocument } from "../types/medusa";

interface SettingsScreenProps {
  session: Session;
  documents: UserDocument[];
  loadingDocuments?: boolean;
  activeDocumentActionId?: string | null;
  resetting?: boolean;
  onGrantDocumentConsent: (documentId: string) => Promise<void>;
  onAnalyzeDocument: (documentId: string) => Promise<void>;
  onDeleteDocument: (document: UserDocument) => Promise<void>;
  onRefreshDocuments: () => Promise<void>;
  onReset: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const STATUS_LABELS: Record<UserDocument["analysis_status"], string> = {
  uploaded: "Enviado",
  awaiting_analysis: "Aguardando análise",
  analyzed: "Analisado",
  error: "Erro",
};

export function SettingsScreen({
  session,
  documents,
  loadingDocuments = false,
  activeDocumentActionId = null,
  resetting = false,
  onGrantDocumentConsent,
  onAnalyzeDocument,
  onDeleteDocument,
  onRefreshDocuments,
  onReset,
  onSignOut,
}: SettingsScreenProps) {
  const confirmReset = async () => {
    const confirmed = window.confirm(
      "Tem certeza que deseja resetar seus dados? Essa ação remove histórico, memória e onboarding.",
    );
    if (!confirmed) return;
    await onReset();
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

        <div className="setup-item">
          <strong>Resetar dados</strong>
          <span>Apaga histórico, memória e onboarding.</span>
          <button data-testid="settings-reset-button" className="ghost-btn" onClick={confirmReset} disabled={resetting}>
            {resetting ? "Resetando" : "Resetar dados"}
          </button>
        </div>

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

          {documents.length === 0 ? (
            <p className="muted" data-testid="settings-documents-empty-state">Nenhum documento enviado ainda.</p>
          ) : (
            <div className="documents-list" data-testid="settings-documents-list">
              {documents.map((document) => {
                const statusLabel = STATUS_LABELS[document.analysis_status] ?? "Enviado";
                const isBusy = activeDocumentActionId === document.id;
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

                    {document.analysis_consent_at && document.analysis_status === "awaiting_analysis" ? (
                      <button
                        data-testid={`settings-document-analyze-button-${document.id}`}
                        className="primary-btn"
                        disabled={isBusy}
                        onClick={() => onAnalyzeDocument(document.id)}
                      >
                        {isBusy ? "Analisando..." : "Analisar documento"}
                      </button>
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
