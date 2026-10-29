import { useState } from 'react'

type Veredito = 'Falso' | 'Não muda o resultado' | 'Número certo, conclusão errada' | 'Explicado pela apuração' | 'Erro das pesquisas'
const COR: Record<Veredito, string> = {
  Falso: 'chip-warn', 'Não muda o resultado': 'chip-ink', 'Número certo, conclusão errada': 'chip-ink', 'Explicado pela apuração': 'chip-ink', 'Erro das pesquisas': 'chip-ink',
}

const NOSSA = 'Cálculo nosso com os arquivos do TSE'
const MITOS: { a: string; onde: string; v: Veredito; r: string; fonte: string; link?: string }[] = [
  { a: 'Lula ganhar mais de 10 milhões de votos entre os turnos é "matematicamente impossível".', onde: 'Carta de Flávio Bolsonaro, 28/10', v: 'Falso',
    r: 'Havia 14,1 milhões de votos em disputa: 9,3 milhões dos outros candidatos, 2,96 milhões de votantes a mais no 2º turno e 1,8 milhão de brancos e nulos a menos (em saldo). Lula ficou com 10,4 milhões e Flávio com 3,7 milhões. Em 2022, Bolsonaro cresceu 7,1 milhões entre os turnos.', fonte: NOSSA },
  { a: 'A prorrogação do horário em 2 horas decidiu a eleição. As seções que ficaram abertas somam 1,8 milhão de votos.', onde: 'Carta de Flávio e "relatório pericial" no X', v: 'Não muda o resultado',
    r: 'O TSE registrou 34.393 votos depois das 17h, menos de 1% da diferença final (só 13 depois das 19h). Nos boletins de urna, 6.663 urnas fecharam perto das 19h ou depois (o TSE informa 6.766 seções encerradas depois das 19h), sobretudo no Rio, em São Paulo e em Salvador. Elas somam 1,96 milhão de eleitores no dia inteiro e deram 55% a Lula. Mesmo apagando essas urnas inteiras, Lula venceria por 4,24 milhões. E elas mudaram do 1º para o 2º turno igual às outras urnas da mesma cidade (0,04 ponto de diferença).', fonte: 'Votos após as 17h: comunicado do TSE. Urnas, votos e margem: cálculo nosso (boletins de urna dos dois turnos)',
    link: 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/eleicoes-2026-mais-de-34-mil-votos-foram-registrados-apos-as-17h-no-2o-turno' },
  { a: '106 seções deram votos só para Lula, o que provaria manipulação.', onde: '"Relatório pericial" no X', v: 'Número certo, conclusão errada',
    r: 'São mesmo 106 (e 4 deram votos só para Flávio). Em 2022 foram 143. Ficam sobretudo no Amazonas, Maranhão, Pará e Roraima, em comunidades que votam de forma muito unida. No 1º turno essas mesmas urnas já davam 98,8% a Lula. Somam 14,9 mil votos, 0,3% da diferença.', fonte: NOSSA + ' (o TSE chegou aos mesmos 106 e 4)' },
  { a: 'A Lei de Benford mostra que os números foram fabricados.', onde: '"Relatório pericial" no X', v: 'Falso',
    r: 'O teste usado "reprova" Lula e Flávio igualmente, em 2022 e em 2026, porque cada urna tem só de 100 a 400 votos e os números quase sempre começam com 1, 2 ou 3. Ele não serve para eleições assim. A versão do teste usada por pesquisadores passa normalmente.', fonte: NOSSA },
  { a: 'Os boletins de urna ficaram 72 horas fora do ar.', onde: '"Relatório pericial" no X', v: 'Falso',
    r: 'O arquivo do TSE registra a hora de chegada de cada boletim. 99,98% dos votos estavam contados até as 22h, e o último boletim chegou às 23h21 do próprio domingo. Os boletins também foram afixados na porta de cada seção.', fonte: NOSSA + ' (horário de chegada de cada boletim)' },
  { a: 'Lula só passou à frente às 20h26, o que seria suspeito.', onde: 'Redes sociais', v: 'Explicado pela apuração',
    r: 'O horário confere com os boletins (nas nossas contas, Lula passa à frente às 20h24); a suspeita, não. O placar oscila porque as regiões chegam em ritmos diferentes. No começo pesam mais o Sul e o Centro-Oeste, onde Flávio vai melhor; no fim, o Sudeste. Dentro de cada região, o percentual de Lula quase não muda durante a noite.', fonte: NOSSA + ' (horário de chegada de cada boletim)' },
  { a: 'Mesários votaram no lugar de eleitores ausentes ou mortos ("voto espírita").', onde: 'Redes sociais', v: 'Falso',
    r: 'Se fosse isso, os eleitores a mais do 2º turno teriam votado quase todos em um só candidato. Eles se dividiram: cerca de 50 de cada 100 para Lula e 47 para Flávio. As poucas urnas com comparecimento e voto em Lula acima de 95% já votavam assim no 1º turno.', fonte: NOSSA },
  { a: 'As urnas de modelo antigo deram mais votos a Lula, o que mostraria adulteração.', onde: 'Repetida desde 2022', v: 'Número certo, conclusão errada',
    r: 'No total do país, elas de fato dão 1,9 ponto a mais a Lula, porque estão mais em regiões onde ele já é forte. Comparadas às urnas novas da mesma escola, a diferença é de 0,06 ponto, praticamente zero.', fonte: NOSSA + ' (modelo de cada urna)' },
  { a: 'A Justiça Eleitoral reduziu o número de urnas para atrapalhar.', onde: 'Redes sociais', v: 'Falso',
    r: 'O número de seções aumentou: eram 472.028 no 2º turno de 2022 e foram 499.205 em 2026.', fonte: NOSSA },
  { a: 'As pesquisas davam Flávio na frente, então o resultado foi manipulado.', onde: 'Redes sociais', v: 'Erro das pesquisas',
    r: 'As 7 pesquisas finais deram Flávio entre 50,1% e 52% e erraram por 1,9 a 3,8 pontos. Em 2022 o erro foi para o outro lado: o Datafolha deu 52% a Lula, que teve 50,9%. Os institutos atribuem o erro à alta do comparecimento: 2,96 milhões a mais. Nenhum teste deste relatório depende de pesquisa.', fonte: 'Pesquisas: levantamento da Gazeta do Povo e AtlasIntel. Comparecimento: cálculo nosso',
    link: 'https://www.gazetadopovo.com.br/eleicoes/2026/institutos-pesquisa-erram-vencedor-eleicao-veja-qual-chegou-mais-perto/' },
  { a: 'Votos de eleitores identificados sem biometria ("votos manuais") são fraude.', onde: '"Relatório pericial" no X', v: 'Falso',
    r: 'Quando a digital não é lida, o eleitor se identifica com documento e assinatura; isso não muda como o voto é registrado. Testamos nos boletins de urna do país inteiro: urnas com mais liberações sem digital que as vizinhas da mesma escola deram só 0,07 ponto a mais a Lula para cada ponto de liberação manual no 2º turno (0,08 no 1º). Se fosse fraude, seria perto de 1 ponto.', fonte: NOSSA + ' (998.411 boletins de urna, 1º e 2º turnos) e explicação do TSE (Fato ou Boato)', link: 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/relatorio-apocrifo-distorce-dados-para-sugerir-fraude-nas-eleicoes-2026' },
]

const FILTROS: (Veredito | 'Todas')[] = ['Todas', 'Falso', 'Não muda o resultado', 'Número certo, conclusão errada', 'Explicado pela apuração', 'Erro das pesquisas']

export default function Mitos() {
  const [f, setF] = useState<(typeof FILTROS)[number]>('Todas')
  const [aberto, setAberto] = useState<number | null>(0)
  const lista = MITOS.map((m, i) => ({ ...m, i })).filter((m) => f === 'Todas' || m.v === f)
  return (
    <section id="mitos" className="py-16 md:py-24" style={{ background: 'var(--ink)', color: 'var(--paper)' }} aria-labelledby="mitos-t">
      <div className="wrap">
        <p className="eyebrow mb-3" style={{ color: 'var(--ink-3)' }}>Checagem · {MITOS.length} alegações</p>
        <h2 id="mitos-t" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase">O que foi dito, e o que os dados mostram</h2>
        <p className="mt-5 max-w-[64ch]" style={{ color: 'color-mix(in srgb, var(--paper) 72%, transparent)' }}>
          Reunimos as afirmações concretas que circularam depois do 2º turno: a carta de Flávio Bolsonaro, um "relatório pericial"
          anônimo publicado no X e boatos checados pela Justiça Eleitoral e por agências de checagem. Toque em cada uma para ver a resposta.
        </p>
        <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filtrar por conclusão">
          {FILTROS.map((x) => (
            <button key={x} onClick={() => setF(x)} aria-pressed={f === x} className="btn"
              style={{ borderColor: 'var(--paper)', color: f === x ? 'var(--ink)' : 'var(--paper)', background: f === x ? 'var(--paper)' : 'transparent' }}>
              {x}
            </button>
          ))}
        </div>
        <ul className="mt-8 grid gap-px" style={{ background: 'color-mix(in srgb, var(--paper) 18%, transparent)' }}>
          {lista.map((m) => {
            const on = aberto === m.i
            return (
              <li key={m.i} style={{ background: 'var(--ink)' }}>
                <button className="w-full text-left py-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-expanded={on} onClick={() => setAberto(on ? null : m.i)}>
                  <span className="min-w-0">
                    <span className="mono text-[0.66rem] block mb-1" style={{ color: 'var(--ink-3)' }}>{m.onde.toUpperCase()}</span>
                    <span className="text-[1.15rem] md:text-[1.3rem] font-bold leading-snug" style={{ fontFamily: 'var(--font-display)', fontStretch: '88%' }}>“{m.a}”</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className={`chip ${COR[m.v]}`}>{m.v}</span>
                    <span className="mono text-[1rem] w-4 text-center" aria-hidden="true">{on ? '−' : '+'}</span>
                  </span>
                </button>
                {on && (
                  <div className="pb-6 max-w-[70ch] text-[1rem]" style={{ color: 'color-mix(in srgb, var(--paper) 82%, transparent)' }}>
                    <p>{m.r}</p>
                    <p className="mono text-[0.68rem] mt-3" style={{ color: 'var(--ink-3)' }}>DE ONDE VEM O NÚMERO: {m.fonte.toUpperCase()}</p>
                    {m.link && <a href={m.link} target="_blank" rel="noreferrer" className="mono text-[0.72rem] underline mt-2 inline-block" style={{ color: 'var(--paper)' }}>Ver fonte ↗</a>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-8 text-[0.92rem] max-w-[70ch]" style={{ color: 'color-mix(in srgb, var(--paper) 60%, transparent)' }}>
          O pedido de cassação por "abuso de poder" é uma discussão jurídica e não pode ser respondido com dados de votação. O próprio PL,
          partido de Flávio, reconheceu o resultado.
        </p>
      </div>
    </section>
  )
}
