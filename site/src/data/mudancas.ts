// Registro público de mudanças desde a primeira publicação (29/10/2026, 14h23).
// Mudança em número, título ou conclusão entra como 'correção'; o resto, como 'novo' ou 'visual'.
export type Mudanca = { hora: string; tipo: 'correção' | 'novo' | 'visual'; pagina: string; texto: string }
export const ATUALIZADO = '29/10/2026'
export const MUDANCAS: { data: string; itens: Mudanca[] }[] = [
  {
    data: '29/10/2026',
    itens: [
      { hora: '23h13', tipo: 'novo', pagina: 'Todas', texto: 'O teste 1 da página principal e o item sobre "voto espírita" agora dizem que o "50 a 47" vale só para os 2,96 milhões de votantes a mais. A seção 1 de "Onde foi decidida" explica por que o teste 1 não serve para medir transferências.' },
      { hora: '23h11', tipo: 'correção', pagina: 'Onde foi decidida', texto: 'A correção das 16h13 dizia que o teste 1 da página principal "dá mais peso aos eleitores dos outros candidatos". É o contrário: pelo teste 1, esses eleitores foram mais para Flávio (saldo de −2,3 milhões para Lula), e quem não votou em ninguém no 1º turno deu a Lula 7,2 milhões de saldo, mais que pelo modelo das urnas (5,9). Os dois métodos concordam que esse grupo pesou mais. A seção 1 ganhou um quadro com os dois métodos lado a lado e a explicação de que o "50 a 47" do teste 1 vale só para os 2,96 milhões de votantes a mais. As teses do simulador "Quem não votou continuou sem votar" e "Novos votos divididos ao meio" e o primeiro card da abertura foram ajustados. Nenhum número mudou. A dúvida veio de um leitor.' },
      { hora: '19h34', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Seção 7, "O perfil das urnas": idade, escolaridade e sexo dos eleitores de cada seção (TSE) comparados ao resultado de 426 mil urnas, dentro da mesma cidade, e confrontados com a pesquisa Datafolha. A seção "Leitura" passou a ser a 8 e ganhou um item sobre escolaridade.' },
      { hora: '17h00', tipo: 'novo', pagina: 'Todas', texto: 'O código e o conteúdo passaram a ter licença MIT: podem ser usados e modificados, mantendo o aviso de autoria.' },
      { hora: '16h57', tipo: 'novo', pagina: 'Todas', texto: 'Data de atualização no topo de cada página e este registro de mudanças.' },
      { hora: '16h52', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Faixa provável no resultado de cada tese do simulador (90% de 200 refeitas da conta com sorteios de municípios). Nenhuma faixa troca o vencedor de alguma tese.' },
      { hora: '16h27', tipo: 'correção', pagina: 'Onde foi decidida', texto: 'O quadro do simulador "Quanto Flávio precisaria" dizia que ele precisaria de 65 de cada 100 eleitores dos outros candidatos para empatar. Esse número depende do método de estimativa. Agora o quadro diz o que não depende: 24 de cada 100 teriam que trocar Lula por Flávio. O texto também passou a incluir os outros 6 candidatos, que já estavam na conta.' },
      { hora: '16h13', tipo: 'correção', pagina: 'Onde foi decidida', texto: 'O título da seção 1 dizia "Quem não votou em ninguém no 1º turno decidiu o 2º", e o primeiro card da abertura dizia o mesmo. Isso afirmava mais do que os dados mostram: outro método (o teste 1 da página principal) dá mais peso aos eleitores dos outros candidatos. [Essa justificativa estava errada; ver a correção das 23h11.] Agora o título é "A virada veio de quem não tinha escolhido Lula nem Flávio", e a seção separa o que é conta (Lula ficou com 74% dos 14,1 milhões de votos ganhos pelos dois) do que é estimativa (como esse ganho se divide entre os grupos). Nenhum número mudou.' },
      { hora: '16h13', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Quadro explicativo em cada tese do simulador (a tese, o que muda, como ler) e uma tese nova com a divisão do método das zonas (32% Lula, 57% Flávio).' },
      { hora: '16h04', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Simulador para testar teses de transferência de votos (seção 3).' },
      { hora: '14h49', tipo: 'visual', pagina: 'Todas', texto: 'Prévia do link para redes sociais, ícone, botão de compartilhar e assinatura do autor.' },
      { hora: '14h23', tipo: 'novo', pagina: 'Todas', texto: 'Primeira publicação.' },
    ],
  },
]
