// Dicionario de sentimentos: apoio para dar nome ao que se sente.
// Cada item traz o significado em uma frase e como costuma aparecer no corpo.
// Nao e instrumento de diagnostico.

export interface Feeling {
  name: string;
  meaning: string;
  body: string;
}

export interface FeelingGroup {
  id: string;
  title: string;
  feelings: Feeling[];
}

export const FEELING_GROUPS: FeelingGroup[] = [
  {
    id: "sobrecarga",
    title: "Sobrecarga",
    feelings: [
      { name: "Sobrecarga", meaning: "Coisas demais ao mesmo tempo; não cabe mais nada.", body: "Cabeça cheia, vontade de fugir ou de parar tudo." },
      { name: "Saturação sensorial", meaning: "Som, luz, toque ou cheiro passaram do limite.", body: "Irritação com barulho, vontade de escuro e silêncio." },
      { name: "Exaustão", meaning: "Cansaço que o descanso comum não resolve.", body: "Corpo pesado, lentidão, dificuldade de falar." },
      { name: "Travamento", meaning: "Saber o que fazer e não conseguir começar.", body: "Paralisia, olhar parado, tempo passando." },
    ],
  },
  {
    id: "medo",
    title: "Medo e tensão",
    feelings: [
      { name: "Ansiedade", meaning: "Preocupação com algo que ainda não aconteceu.", body: "Coração acelerado, respiração curta, inquietação." },
      { name: "Apreensão", meaning: "Sensação de que algo ruim está para acontecer.", body: "Aperto no peito ou no estômago." },
      { name: "Alerta", meaning: "Corpo em vigilância, mesmo sem perigo claro.", body: "Músculos tensos, susto fácil." },
      { name: "Insegurança", meaning: "Dúvida sobre a própria capacidade ou aceitação.", body: "Voz baixa, vontade de pedir confirmação." },
    ],
  },
  {
    id: "raiva",
    title: "Raiva",
    feelings: [
      { name: "Irritação", meaning: "Incômodo pequeno que vai acumulando.", body: "Impaciência, respostas curtas." },
      { name: "Frustração", meaning: "Esforço que não deu o resultado esperado.", body: "Tensão nos ombros e na mandíbula, vontade de desistir." },
      { name: "Raiva", meaning: "Reação a um limite desrespeitado ou a uma injustiça.", body: "Calor, punhos ou dentes cerrados." },
      { name: "Ressentimento", meaning: "Raiva antiga que ficou guardada.", body: "Pensamento que volta ao mesmo episódio." },
    ],
  },
  {
    id: "tristeza",
    title: "Tristeza",
    feelings: [
      { name: "Tristeza", meaning: "Resposta a uma perda ou a algo que não veio.", body: "Peso no peito, choro, pouca energia." },
      { name: "Desânimo", meaning: "Falta de vontade, mesmo para o que costuma agradar.", body: "Lentidão, adiar tudo." },
      { name: "Solidão", meaning: "Falta de conexão, mesmo com gente por perto.", body: "Vazio, vontade de se isolar ainda mais." },
      { name: "Decepção", meaning: "Expectativa que não se cumpriu.", body: "Aperto, queda de energia de repente." },
    ],
  },
  {
    id: "vergonha",
    title: "Vergonha e culpa",
    feelings: [
      { name: "Vergonha", meaning: "Sensação de que há algo errado comigo.", body: "Rosto quente, vontade de sumir." },
      { name: "Culpa", meaning: "Sensação de ter feito algo errado.", body: "Aperto, pensamento repetido sobre o que foi feito." },
      { name: "Inadequação", meaning: "Sensação de não se encaixar no lugar ou no grupo.", body: "Corpo encolhido, atenção ao que os outros pensam." },
    ],
  },
  {
    id: "confusao",
    title: "Confusão e vazio",
    feelings: [
      { name: "Confusão", meaning: "Muitos sentimentos juntos, difíceis de separar.", body: "Cabeça embaralhada, dificuldade de decidir." },
      { name: "Ambivalência", meaning: "Querer e não querer a mesma coisa.", body: "Ir e voltar na mesma decisão." },
      { name: "Anestesia", meaning: "Não sentir nada, como se tudo estivesse desligado.", body: "Corpo distante, olhar vago." },
    ],
  },
  {
    id: "calma",
    title: "Calma e segurança",
    feelings: [
      { name: "Calma", meaning: "Nada urgente pedindo atenção.", body: "Respiração lenta, ombros soltos." },
      { name: "Alívio", meaning: "Um peso saiu.", body: "Suspiro, corpo que afrouxa." },
      { name: "Segurança", meaning: "Sensação de proteção e de poder baixar a guarda.", body: "Músculos relaxados." },
      { name: "Satisfação", meaning: "O que foi feito bastou.", body: "Contentamento tranquilo, sem pressa." },
    ],
  },
  {
    id: "energia",
    title: "Energia boa",
    feelings: [
      { name: "Ânimo", meaning: "Vontade de começar.", body: "Energia nos braços e nas pernas." },
      { name: "Curiosidade", meaning: "Vontade de saber mais.", body: "Atenção presa, tempo passando rápido." },
      { name: "Orgulho", meaning: "Reconhecimento de um feito próprio.", body: "Peito aberto, postura ereta." },
      { name: "Gratidão", meaning: "Reconhecimento de algo bom que veio de fora.", body: "Calor no peito." },
    ],
  },
];
