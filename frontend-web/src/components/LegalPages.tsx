import { Link } from "react-router-dom";
import type { ReactNode } from "react";

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="app-shell legal-shell">
      <header className="panel">
        <p className="eyebrow">Medusa • Documentos legais</p>
        <h1>{title}</h1>
        <p className="muted">
          Este documento é um modelo inicial e deve ser revisado por profissional jurídico antes do lançamento público.
        </p>
        <div className="legal-links-row">
          <Link to="/">
            Voltar ao produto
          </Link>
          <Link to="/terms">
            Termos
          </Link>
          <Link to="/privacy">
            Privacidade
          </Link>
          <Link to="/crisis">
            Crise
          </Link>
        </div>
      </header>

      <section className="panel legal-copy">{children}</section>
    </main>
  );
}

export function TermsPage() {
  return (
    <LegalLayout title="Termos de Uso">
      <p>
        “A computer can never be held accountable — therefore a computer must never make a management decision.” IBM —
        Treinamento Interno, 1979
      </p>
      <p>
        Este princípio guia o propósito da Medusa: a responsabilidade pelas decisões da sua vida permanece sempre com você.
      </p>

      <h3>1. O que é a Medusa</h3>
      <p>
        A Medusa é uma ferramenta de organização, reflexão, registro e apoio cognitivo/emocional. Ela sugere estruturas e
        próximos passos; você decide o que fazer.
      </p>

      <h3>2. Limite de atuação</h3>
      <p>
        A Medusa não substitui médico, psicólogo, psiquiatra, terapia, diagnóstico ou atendimento de emergência. Em crise,
        consulte o <Link to="/crisis">Aviso de Segurança e Crise</Link>.
      </p>

      <h3>3. Uso permitido e proibido</h3>
      <p>
        Permitido: uso pessoal para organização e reflexão. Proibido: uso ilícito, abuso de sistema, tentativa de quebrar
        segurança, ou uso para orientação médica/diagnóstica indevida.
      </p>

      <h3>4. Faixa etária (18+)</h3>
      <p>
        A Medusa é destinada apenas a pessoas com 18 anos ou mais. Menores de idade não devem criar conta ou usar o
        serviço sem autorização e supervisão de responsável legal. Para este MVP/beta fechado, o acesso está restrito a 18+.
      </p>

      <h3>5. Conta e credenciais</h3>
      <p>
        Você é responsável por manter e-mail/senha em segurança e por atividades realizadas na sua conta.
      </p>

      <h3>6. Limitações do serviço</h3>
      <p>
        Respostas de IA podem conter erros, imprecisão ou omissões. Nenhuma resposta deve ser interpretada como ordem,
        prescrição, diagnóstico ou decisão obrigatória.
      </p>

      <h3>7. Propriedade intelectual</h3>
      <p>
        Marca, estrutura e conteúdo-base da Medusa pertencem à Medusa Labs. Conteúdos pessoais do usuário permanecem sob
        sua titularidade, observados os limites técnicos e legais.
      </p>

      <h3>8. Cancelamento e exclusão de conta</h3>
      <p>
        Você pode solicitar exclusão de conta/dados. A Medusa pode suspender contas em caso de abuso ou risco técnico.
      </p>

      <h3>9. Limitação de responsabilidade</h3>
      <p>
        A Medusa Labs não assume responsabilidade por decisões tomadas pelo usuário com base nas sugestões da IA.
      </p>

      <h3>10. Atualizações dos termos</h3>
      <p>
        Estes termos podem ser atualizados. A versão vigente será indicada no produto e no histórico de consentimento.
      </p>

      <h3>11. Contato</h3>
      <p>
        Jurídico: <a href="mailto:legal@medusa.app">legal@medusa.app</a>
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Política de Privacidade e Proteção de Dados">
      <p>
        Esta política segue a LGPD (Lei nº 13.709/2018) como referência principal. Base legal pública:
        <a href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm"> LGPD</a>.
        Materiais da ANPD:
        <a href="https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes"> ANPD</a>.
      </p>

      <h3>1. Controlador dos dados</h3>
      <p>Controlador: Medusa Labs.</p>

      <h3>2. Dados coletados</h3>
      <ul>
        <li>Dados de conta: e-mail e credenciais de autenticação.</li>
        <li>Onboarding: escolaridade, profissão, rotina, preferências e restrições.</li>
        <li>Mensagens de chat e check-ins de energia.</li>
        <li>Memória operacional: padrões, gatilhos, contexto, funcionou/não funcionou.</li>
        <li>Logs técnicos mínimos e auditoria de custo/modelo.</li>
      </ul>

      <h3>3. Finalidades</h3>
      <ul>
        <li>Autenticação e gestão de conta.</li>
        <li>Funcionamento do chat e personalização das respostas.</li>
        <li>Memória individual por usuário.</li>
        <li>Segurança e auditoria operacional.</li>
        <li>Melhoria contínua do serviço.</li>
      </ul>

      <h3>4. Bases legais</h3>
      <p>
        Execução de contrato, consentimento quando aplicável, legítimo interesse quando aplicável e obrigação legal quando
        necessária.
      </p>

      <h3>5. Compartilhamento</h3>
      <ul>
        <li>Supabase: autenticação, banco e infraestrutura.</li>
        <li>Anthropic/Claude via Edge Function server-side.</li>
        <li>Provedores técnicos essenciais para operação.</li>
        <li>Nunca vendemos dados pessoais.</li>
      </ul>

      <h3>6. Transferência internacional</h3>
      <p>
        Pode ocorrer conforme região dos provedores de infraestrutura e IA, com medidas técnicas de proteção.
      </p>

      <h3>7. Retenção</h3>
      <p>
        Dados são mantidos pelo tempo necessário para operação, segurança, obrigações legais e exercício regular de direitos.
      </p>

      <h3>8. Direitos do titular</h3>
      <ul>
        <li>Confirmação de tratamento e acesso.</li>
        <li>Correção e atualização.</li>
        <li>Anonimização, bloqueio ou eliminação, quando aplicável.</li>
        <li>Portabilidade, informação de compartilhamento e revogação de consentimento.</li>
        <li>Oposição ao tratamento, quando cabível.</li>
      </ul>

      <h3>9. Segurança</h3>
      <ul>
        <li>RLS no Supabase para isolamento por usuário.</li>
        <li>Chaves sensíveis apenas server-side.</li>
        <li>Logs sem PII desnecessária.</li>
        <li>Princípio do mínimo necessário.</li>
      </ul>

      <h3>10. Exclusão de conta e dados</h3>
      <p>
        Solicitações podem ser feitas pelos canais de contato. O usuário também pode usar recursos de reset/exclusão no app.
      </p>

      <h3>11. Contato de privacidade</h3>
      <p>
        <a href="mailto:privacy@medusa.app">privacy@medusa.app</a>
      </p>

      <h3>12. Última atualização</h3>
      <p>2026-05.</p>
    </LegalLayout>
  );
}

export function CrisisPage() {
  return (
    <LegalLayout title="Aviso de Segurança e Crise">
      <p>A Medusa não é serviço de emergência.</p>
      <p>
        Em risco imediato de autoagressão, suicídio, violência ou emergência médica, procure imediatamente os serviços
        locais de urgência.
      </p>

      <h3>Brasil</h3>
      <ul>
        <li>CVV: 188</li>
        <li>SAMU: 192</li>
        <li>Polícia: 190</li>
      </ul>

      <p>
        Este aviso complementa os <Link to="/terms">Termos de Uso</Link> e a <Link to="/privacy">Política de Privacidade</Link>.
      </p>
    </LegalLayout>
  );
}
