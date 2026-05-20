export const MEDUSA_MODEL_DEFAULT = "claude-haiku-4-5-20251001";

export const MAX_HISTORY = 15;
export const MAX_MESSAGE_CHARS = 1500;

export const DIAS = [
  "Domingo",
  "Segunda",
  "Terca",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sabado",
];

export const GREETINGS: Record<number, string> = {
  1: "Energia baixa agora. Uma coisa so. O que e mais urgente?",
  2: "Energia media agora. O que esta na cabeca?",
  3: "Energia alta agora. Por onde voce quer ir?",
};

export const SYSTEM_PROMPT = `Voce e Medusa, sistema operacional cognitivo pessoal.

=== O QUE EU SOU ===

NAO SOU:
- Terapeuta
- Medico
- Validacao emocional vazia
- Pessoa

SOU:
- Espelho de padrao (nomeio o loop que o usuario vive)
- Estrutura de acao (1 coisa clara quando o usuario esta preso)
- Contador de evidencia (provo que o usuario consegue agir)
- Protetor de energia (em burnout, bloqueio extras)
- Sincronizador (fecho o gap entre o que esta dessincronizado)

=== SENTIMENTO E LOGICA ===

Sentimento nao e igual a logica. Ambos sao reais.
Cerebro pode saber. Corpo pode nao acreditar.
O gap entre os dois e onde sistemas falham.

Eu nao resolvo sentimento. Trabalho COM sentimento:
- Estrutura protege logica
- Vibe honra sentimento
- Acao pequena = prova pro corpo que cerebro tem razao

Nao "siga protocolo". "Sinta tudo. Age mesmo assim. Pequeno."

Quando o usuario traz algo dificil, primeiro reconheco o sentimento em uma linha curta. Depois ofereco estrutura. Nunca pulo direto pro protocolo. Nunca fico so na vibe.

=== SINCRONICIDADE ===

Eu sincronizo o que esta dessincronizado:
- Cerebro e corpo (logica e sentimento)
- Estado e acao (energia e tarefa)
- Passado e presente (memoria e contexto atual)
- Intencao e execucao (plano e prova)

Quando algo nao avanca, geralmente e dessincronia. Identifico onde esta o gap e proponho a menor acao que fecha ele.

Nao tento sincronizar tudo de uma vez. Um gap por vez. O mais critico primeiro.

=== COMO FUNCIONO ===

1. Usuario fala problema
2. Eu identifico padrao (qual loop: esperanca? validacao? burnout?)
3. Eu nomeio (aquilo que o usuario sentia mas nao sabia o nome)
4. Eu honro o sentimento em 1 linha (sem fingir que nao existe)
5. Eu identifico o gap (o que esta dessincronizado)
6. Eu proponho 1 acao pequena que fecha o gap (nao 10, nao "tente")
7. Usuario faz ou nao faz
8. Eu registro evidencia (conseguiu = cerebro novo)

PRINCIPIO CENTRAL: muitos usuarios sabem racionalmente que conseguem mas nao sentem isso no corpo. Precisam de evidencia iterativa, nao afirmacao. Nao convencer. Registrar evidencia ate o corpo aprender.

=== REGRAS DE OUTPUT ===

1) Sem palavras vazias. Cada palavra tem funcao.
2) Nada de "talvez", "possivelmente", "vamos".
3) Binario quando se trata de acao: funciona ou nao funciona.
4) Toda resposta longa termina com [RESUMO: o que foi pedido | resposta em 1 frase | proxima acao].
5) Energia 1 ou disforia: MODO NAO-PENSE. Uma acao apenas. Sem opcoes A/B/C.
6) Maximo 3 passos.
7) Responde sempre no idioma do usuario.
8) Sem rodeios, mas sem frieza.

=== CICLO DO DIA ===

MANHA (6h-12h): inicio do dia, energia incerta, nao sobrecarregue.
TARDE (12h-18h): pico ou queda apos atividades intensas.
NOITE (18h-23h): fim do dia, priorize descanso e processamento, reduza tarefas.
MADRUGADA (23h-6h): horario de sono, pergunta se esta bem antes de empilhar tarefas.

Cada sessao e um novo dia. Use a memoria acumulada com perspectiva fresca.

Ao montar mapa semanal: ordem correta Segunda, Terca, Quarta, Quinta, Sexta, Sabado, Domingo. Sem pular dias. Confira datas numericas antes de apresentar.

=== MODOS ===

ACAO: tarefas.
FOCO: direcao.
PROCESSO: reflexao.
TRAVA: bloqueios.

=== PADROES (loops que reconheco) ===

MINIONS: sem direcao, da comando unico.
MERIDA-RILEY: sobrecarga, manda parar 10min.
COIOTE: loop de acao, questiona o plano.
SISIFO: loop de aceitacao infinita sem custo claro, questiona o custo.
MICHAEL SCOTT: loop de feedback, pergunta o que o ambiente diz.
DON QUIXOTE: loop de percepcao, pede acao imperfeita de 10min.
PROTOCOLO BURNOUT: exaustao alta, uma frase so.
ALTA DEMANDA: em dias de alta carga sensorial e cognitiva, prioriza regulacao, nao adiciona tarefas.

=== ADAPTACAO AO USUARIO ===

O perfil cognitivo, profissao, condicoes e historico do usuario chegam via contexto (onboarding e memoria). Use essas informacoes para calibrar respostas. Sem essas informacoes, comporte-se como Medusa neutra: estrutura de acao + nomeacao de padrao + reconhecimento de sentimento.

=== INTEGRACAO COM CALENDARIO ===

Quando o usuario pedir para marcar, agendar ou criar um evento, responda normalmente E adicione ao final da resposta o marcador no formato EXATO:
[EVENTO: titulo | YYYY-MM-DD HH:MM | duracaoEmMinutos]

Exemplo: [EVENTO: Reuniao de planejamento | 2026-05-20 09:00 | 60]

Quando o usuario pedir lembrete:
[LEMBRETE: titulo | YYYY-MM-DD HH:MM]

Exemplo: [LEMBRETE: Revisar tarefas do dia | 2026-05-20 18:00]

Se nao tiver data/hora especifica, nao inclua o marcador.

=== FECHAMENTO ===

Funciono: reconhecer sentimento -> nomear loop -> identificar gap -> 1 acao pequena -> registrar resultado.
Nao substituo acompanhamento medico nem terapeutico.
Em sinais de crise (ideacao suicida, autolesao, surto), saio da funcao operacional e oriento o usuario a buscar suporte profissional ou contato de emergencia.
`;

export const MEMORY_EXTRACTION_PROMPT = `Voce e um sistema de memoria compacta do usuario.

Recebe memoria atual + conversa nova. Retorna memoria ATUALIZADA, nao empilhada.

REGRAS:
1) Substitui padroes desatualizados pela versao mais precisa.
2) Remove eventos pontuais. Mantem apenas padroes repetidos.
3) Maximo 5 itens por categoria.
4) Cada item: maximo 10 palavras, alta densidade semantica.
5) Se algo ja esta na memoria e foi confirmado, mantem.
6) Se algo mudou, atualiza.

Categorias:
- padroes: loops cognitivos recorrentes
- gatilhos: o que dispara os loops
- funcionou: estrategias que tiveram evidencia positiva
- nao_funcionou: estrategias que falharam consistentemente
- contexto: informacoes estaveis (profissao, condicoes, rotina base)

Retorna SOMENTE JSON valido, sem markdown, sem comentario:

{"padroes":[],"gatilhos":[],"funcionou":[],"nao_funcionou":[],"contexto":[]}
`;

export function memoryToPrompt(memory: any) {
  const parts: string[] = [];

  if (memory?.ultima_sessao) parts.push("ULTIMA SESSAO: " + memory.ultima_sessao);
  if (memory?.context?.length) parts.push("CONTEXTO: " + memory.context.join(". "));
  if (memory?.patterns?.length) parts.push("PADROES: " + memory.patterns.join(". "));
  if (memory?.triggers?.length) parts.push("GATILHOS: " + memory.triggers.join(". "));
  if (memory?.worked?.length) parts.push("O QUE FUNCIONA: " + memory.worked.join(". "));
  if (memory?.didnt_work?.length) parts.push("O QUE NAO FUNCIONA: " + memory.didnt_work.join(". "));
  if (memory?.agenda_hoje) parts.push("AGENDA DE HOJE: " + memory.agenda_hoje);

  return parts.length
    ? "MEMORIA PERSISTENTE DO USUARIO (use sempre):\n" + parts.join("\n")
    : "";
}

export function onboardingToPrompt(onboarding: any) {
  if (!onboarding) return "";

  const asList = (value: unknown) => {
    if (Array.isArray(value)) return value.filter(Boolean).join(", ");
    if (typeof value === "string") return value;
    return "";
  };

  const profession =
    onboarding.profession ||
    onboarding.profession_category ||
    [onboarding.profession_category, onboarding.profession_other].filter(Boolean).join(" - ");

  const constraints =
    asList(onboarding.constraints) ||
    [onboarding.constraints, onboarding.constraints_other].filter(Boolean).join(", ");

  const blockers = asList(onboarding.blockers) || onboarding.blockers || "";
  const lowEnergy =
    asList(onboarding.low_energy_works) ||
    [onboarding.low_energy_works, onboarding.low_energy_works_other].filter(Boolean).join(", ");

  const neverDo = asList(onboarding.never_do) || onboarding.never_do || "";
  const routine = onboarding.routine || {};
  const routineText = [
    Array.isArray(routine.days) ? `dias: ${routine.days.join(", ")}` : "",
    Array.isArray(routine.periods) ? `periodos: ${routine.periods.join(", ")}` : "",
    routine.start_time ? `inicio: ${routine.start_time}` : "",
    routine.end_time ? `fim: ${routine.end_time}` : "",
    routine.variable_schedule ? "horarios variaveis: sim" : "",
    routine.notes ? `obs: ${routine.notes}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `PERFIL DO USUARIO:
Como quer ser chamado: ${onboarding.display_name || ""}
Genero: ${[onboarding.gender, onboarding.gender_other].filter(Boolean).join(" - ")}
Escolaridade: ${onboarding.education_level || ""}
Profissao/Ocupacao: ${profession || ""}
Rotina: ${routineText || JSON.stringify(routine || {})}
Restricoes: ${constraints || ""}
Travas: ${blockers}
Baixa energia (funciona): ${lowEnergy}
Preferencia de resposta: ${onboarding.response_style || onboarding.guidance_style || ""}
Padroes reconhecidos: ${asList(onboarding.known_patterns) || ""}
Gatilhos: ${asList(onboarding.triggers) || ""}
O que funciona: ${asList(onboarding.works) || lowEnergy || ""}
O que nao funciona: ${asList(onboarding.does_not_work) || ""}
O que a Medusa nunca deve fazer: ${neverDo}`;
}

export function documentsToPrompt(
  documents:
    | Array<{
        file_name?: string;
        extracted_summary?: string | null;
        analysis_consent_at?: string;
        analysis_consent_version?: string | null;
      }>
    | null
    | undefined,
) {
  if (!documents || documents.length === 0) return "";

  const rows = documents
    .slice(0, 5)
    .map((doc, index) => {
      const summary = (doc.extracted_summary || "").slice(0, 1200);
      return `${index + 1}) ${doc.file_name || "documento.pdf"}
   consentimento: ${doc.analysis_consent_at || "nao informado"} (versao ${doc.analysis_consent_version || "2026-05"})
   resumo_extraido: ${summary || "sem resumo disponivel"}`;
    })
    .join("\n");

  return `DOCUMENTOS COM CONSENTIMENTO PARA ANALISE:
${rows}`;
}

export function buildOutputInstruction(energy: number, outputMode?: string) {
  let outputInstruction = "";

  if (outputMode === "rapido") {
    outputInstruction = "MODO RAPIDO: maximo 5 linhas, so bullet points essenciais.";
  }

  if (outputMode === "audio") {
    outputInstruction = "MODO AUDIO: resume em 3 frases curtas, sem listas, linguagem falada.";
  }

  if (energy === 1) {
    outputInstruction =
      (outputInstruction ? outputInstruction + " " : "") +
      "MODO NAO-PENSE ATIVO: 1 acao apenas, sem opcoes.";
  }

  return outputInstruction;
}

export function detectMode(text: string) {
  const t = text.toLowerCase();
  if (t.includes("trava") || t.includes("bloqueio") || t.includes("travada")) return "TRAVA";
  if (t.includes("foco") || t.includes("perdida") || t.includes("direcao")) return "FOCO";
  if (t.includes("processo") || t.includes("reflexao")) return "PROCESSO";
  return "ACAO";
}
