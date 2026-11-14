// Dicionario de sentimentos: apoio para dar nome ao que se sente.
// Cada item traz a pergunta que o separa dos vizinhos, o significado,
// como costuma aparecer no corpo e um exemplo de situacao.
// Nao e instrumento de diagnostico.

export interface Feeling {
  name: string;
  question: string;
  meaning: string;
  body: string;
  example: string;
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
      {
        name: "Sobrecarga",
        question: "Tem coisa demais para fazer ou decidir ao mesmo tempo?",
        meaning: "Coisas demais ao mesmo tempo; não cabe mais nada.",
        body: "Cabeça cheia, vontade de fugir ou de parar tudo.",
        example: "Três pessoas pedindo coisas ao mesmo tempo e o celular tocando.",
      },
      {
        name: "Saturação sensorial",
        question: "O problema é barulho, luz, toque ou cheiro?",
        meaning: "Som, luz, toque ou cheiro passaram do limite.",
        body: "Irritação com barulho, vontade de escuro e silêncio.",
        example: "Fim de um dia em lugar barulhento; até uma voz baixa incomoda.",
      },
      {
        name: "Exaustão",
        question: "O corpo está sem energia, mesmo sem nada pressionando agora?",
        meaning: "Cansaço que o descanso comum não resolve.",
        body: "Corpo pesado, lentidão, dificuldade de falar.",
        example: "Dormir a noite inteira e acordar sem energia.",
      },
      {
        name: "Travamento",
        question: "Tem energia e sabe o que fazer, mas não sai do lugar?",
        meaning: "Saber o que fazer e não conseguir começar.",
        body: "Paralisia, olhar parado, tempo passando.",
        example: "Olhar para a tarefa aberta por uma hora sem conseguir começar.",
      },
    ],
  },
  {
    id: "medo",
    title: "Medo e tensão",
    feelings: [
      {
        name: "Ansiedade",
        question: "A preocupação tem um assunto claro, como uma prova ou uma conversa?",
        meaning: "Preocupação com algo definido que ainda não aconteceu.",
        body: "Coração acelerado, respiração curta, inquietação.",
        example: "Véspera de uma apresentação: a cabeça repassa tudo o que pode dar errado.",
      },
      {
        name: "Apreensão",
        question: "É um pressentimento ruim, sem saber de quê?",
        meaning: "Sensação de que algo ruim vem, sem motivo claro.",
        body: "Aperto no peito ou no estômago.",
        example: "Dia normal, mas com a sensação de que vem notícia ruim.",
      },
      {
        name: "Alerta",
        question: "O corpo está de guarda, reagindo a qualquer som ou movimento?",
        meaning: "Corpo em vigilância, mesmo sem perigo à vista.",
        body: "Músculos tensos, susto fácil.",
        example: "Depois de um susto, qualquer barulho faz o corpo pular.",
      },
      {
        name: "Insegurança",
        question: "A dúvida é sobre dar conta ou sobre o que vão achar de você?",
        meaning: "Dúvida sobre a própria capacidade ou aceitação.",
        body: "Voz baixa, vontade de pedir confirmação.",
        example: "Reler dez vezes uma mensagem antes de enviar.",
      },
    ],
  },
  {
    id: "raiva",
    title: "Raiva",
    feelings: [
      {
        name: "Irritação",
        question: "É um incômodo pequeno, que vai somando com outros?",
        meaning: "Incômodo pequeno que acumula.",
        body: "Impaciência, respostas curtas.",
        example: "Fila lenta, interrupções seguidas, um barulho repetido.",
      },
      {
        name: "Frustração",
        question: "Você se esforçou e não deu certo?",
        meaning: "Esforço que não deu o resultado esperado. É com o resultado, não com uma pessoa.",
        body: "Tensão nos ombros e na mandíbula, vontade de desistir.",
        example: "Estudar muito e ir mal na prova.",
      },
      {
        name: "Raiva",
        question: "Alguém passou de um limite seu ou foi injusto?",
        meaning: "Reação a um limite desrespeitado ou a uma injustiça. Tem um alvo: alguém ou algo.",
        body: "Calor, punhos ou dentes cerrados.",
        example: "Alguém levar o crédito pelo seu trabalho.",
      },
      {
        name: "Ressentimento",
        question: "É sobre algo antigo que ainda volta?",
        meaning: "Raiva antiga que ficou guardada.",
        body: "Pensamento que volta ao mesmo episódio.",
        example: "Lembrar de uma ofensa de anos atrás e sentir tudo de novo.",
      },
    ],
  },
  {
    id: "tristeza",
    title: "Tristeza",
    feelings: [
      {
        name: "Tristeza",
        question: "Perdeu algo ou alguém?",
        meaning: "Resposta a uma perda.",
        body: "Peso no peito, choro, pouca energia.",
        example: "O fim de uma amizade.",
      },
      {
        name: "Desânimo",
        question: "Nada dá vontade, mesmo sem ter perdido nada?",
        meaning: "Falta de vontade, até para o que costuma agradar.",
        body: "Lentidão, adiar tudo.",
        example: "Um fim de semana livre e nenhuma vontade de fazer o que você gosta.",
      },
      {
        name: "Solidão",
        question: "Falta alguém que entenda você?",
        meaning: "Falta de conexão, mesmo com gente por perto.",
        body: "Vazio, vontade de se isolar ainda mais.",
        example: "Estar numa festa e sentir que ninguém ali conhece você.",
      },
      {
        name: "Decepção",
        question: "Esperava uma coisa e veio outra?",
        meaning: "Expectativa que não se cumpriu.",
        body: "Aperto, queda de energia de repente.",
        example: "Contar com alguém que desmarcou na última hora.",
      },
    ],
  },
  {
    id: "vergonha",
    title: "Vergonha e culpa",
    feelings: [
      {
        name: "Vergonha",
        question: "O pensamento é “tem algo errado comigo”?",
        meaning: "Sensação de que o erro sou eu. É sobre quem eu sou.",
        body: "Rosto quente, vontade de sumir.",
        example: "Errar na frente dos outros e querer desaparecer.",
      },
      {
        name: "Culpa",
        question: "O pensamento é “eu fiz algo errado”?",
        meaning: "Sensação de ter feito algo errado. É sobre o que eu fiz.",
        body: "Aperto, pensamento repetido sobre o que foi feito.",
        example: "Ter falado de forma dura com alguém e ficar remoendo.",
      },
      {
        name: "Inadequação",
        question: "O pensamento é “eu não pertenço a este lugar”?",
        meaning: "Sensação de não se encaixar no lugar ou no grupo.",
        body: "Corpo encolhido, atenção ao que os outros pensam.",
        example: "Um grupo em que todos parecem saber como agir, menos você.",
      },
    ],
  },
  {
    id: "confusao",
    title: "Confusão e vazio",
    feelings: [
      {
        name: "Confusão",
        question: "Sente muita coisa ao mesmo tempo e não consegue separar?",
        meaning: "Muitos sentimentos juntos, difíceis de separar.",
        body: "Cabeça embaralhada, dificuldade de decidir.",
        example: "Depois de uma discussão, não saber se é raiva, tristeza ou medo.",
      },
      {
        name: "Ambivalência",
        question: "Sente duas coisas opostas sobre o mesmo assunto?",
        meaning: "Querer e não querer a mesma coisa.",
        body: "Ir e voltar na mesma decisão.",
        example: "Querer ir à festa e querer ficar em casa.",
      },
      {
        name: "Anestesia",
        question: "Não sente nada, nem bom nem ruim?",
        meaning: "Não sentir nada, como se tudo estivesse desligado.",
        body: "Corpo distante, olhar vago.",
        example: "Receber uma notícia importante e não reagir.",
      },
    ],
  },
  {
    id: "calma",
    title: "Calma e segurança",
    feelings: [
      {
        name: "Calma",
        question: "Está tudo quieto por dentro, sem um motivo especial?",
        meaning: "Nada urgente pedindo atenção.",
        body: "Respiração lenta, ombros soltos.",
        example: "Uma manhã sem compromisso e sem pressa para nada.",
      },
      {
        name: "Alívio",
        question: "Algo ruim acabou ou deixou de acontecer?",
        meaning: "Um peso saiu. Vem depois de uma tensão.",
        body: "Suspiro, corpo que afrouxa.",
        example: "A reunião difícil foi cancelada.",
      },
      {
        name: "Segurança",
        question: "Sente que pode baixar a guarda neste lugar ou com esta pessoa?",
        meaning: "Sensação de proteção.",
        body: "Músculos relaxados.",
        example: "Estar em casa, com a porta fechada, depois de um dia difícil.",
      },
      {
        name: "Satisfação",
        question: "Terminou algo e ficou bom o bastante?",
        meaning: "O que foi feito bastou.",
        body: "Contentamento tranquilo, sem pressa.",
        example: "Fechar o computador com a tarefa do dia entregue.",
      },
    ],
  },
  {
    id: "energia",
    title: "Energia boa",
    feelings: [
      {
        name: "Ânimo",
        question: "Dá vontade de começar algo agora?",
        meaning: "Vontade de agir.",
        body: "Energia nos braços e nas pernas.",
        example: "Acordar com vontade de resolver a lista do dia.",
      },
      {
        name: "Curiosidade",
        question: "Dá vontade de entender ou descobrir algo?",
        meaning: "Vontade de saber mais.",
        body: "Atenção presa, tempo passando rápido.",
        example: "Abrir um assunto novo e perder a noção da hora.",
      },
      {
        name: "Orgulho",
        question: "Olha para algo que fez e pensa “fui eu”?",
        meaning: "Reconhecimento de um feito próprio.",
        body: "Peito aberto, postura ereta.",
        example: "Terminar algo difícil que você achava que não conseguiria.",
      },
      {
        name: "Gratidão",
        question: "Recebeu algo bom que veio de fora?",
        meaning: "Reconhecimento de algo bom que veio de outra pessoa ou da vida.",
        body: "Calor no peito.",
        example: "Alguém lembrar de você sem você pedir.",
      },
    ],
  },
];
