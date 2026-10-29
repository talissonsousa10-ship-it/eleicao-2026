// Registro público de mudanças desde a primeira publicação (29/10/2026, 14h23).
// Mudança em número, título ou conclusão entra como 'correção'; o resto, como 'novo' ou 'visual'.
export type Mudanca = { hora: string; tipo: 'correção' | 'novo' | 'visual'; pagina: string; texto: string }
export const ATUALIZADO = '29/10/2026'
export const MUDANCAS: { data: string; itens: Mudanca[] }[] = [
  {
    data: '29/10/2026',
    itens: [
      { hora: '16h57', tipo: 'novo', pagina: 'Todas', texto: 'Data de atualização no topo de cada página e este registro de mudanças.' },
      { hora: '16h52', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Faixa provável no resultado de cada tese do simulador (90% de 200 refeitas da conta com sorteios de municípios). Nenhuma faixa troca o vencedor de alguma tese.' },
      { hora: '16h27', tipo: 'correção', pagina: 'Onde foi decidida', texto: 'O quadro do simulador "Quanto Flávio precisaria" dizia que ele precisaria de 65 de cada 100 eleitores dos outros candidatos para empatar. Esse número depende do método de estimativa. Agora o quadro diz o que não depende: 24 de cada 100 teriam que trocar Lula por Flávio. O texto também passou a incluir os outros 6 candidatos, que já estavam na conta.' },
      { hora: '16h13', tipo: 'correção', pagina: 'Onde foi decidida', texto: 'O título da seção 1 dizia "Quem não votou em ninguém no 1º turno decidiu o 2º", e o primeiro card da abertura dizia o mesmo. Isso afirmava mais do que os dados mostram: outro método (o teste 1 da página principal) dá mais peso aos eleitores dos outros candidatos. Agora o título é "A virada veio de quem não tinha escolhido Lula nem Flávio", e a seção separa o que é conta (Lula ficou com 74% dos 14,1 milhões de votos ganhos pelos dois) do que é estimativa (como esse ganho se divide entre os grupos). Nenhum número mudou.' },
      { hora: '16h13', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Quadro explicativo em cada tese do simulador (a tese, o que muda, como ler) e uma tese nova com a divisão do método das zonas (32% Lula, 57% Flávio).' },
      { hora: '16h04', tipo: 'novo', pagina: 'Onde foi decidida', texto: 'Simulador para testar teses de transferência de votos (seção 3).' },
      { hora: '14h49', tipo: 'visual', pagina: 'Todas', texto: 'Prévia do link para redes sociais, ícone, botão de compartilhar e assinatura do autor.' },
      { hora: '14h23', tipo: 'novo', pagina: 'Todas', texto: 'Primeira publicação.' },
    ],
  },
]
