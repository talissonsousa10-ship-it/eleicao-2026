import { useState } from 'react'
import { fmt, fmtMi, usePlayOnView } from '@/lib/util'
import B from '../data/boletins.json'

const BU = B as any
const LINHAS: [string, string][] = [
  ['13 LULA', 'lula'], ['22 FLÁVIO', 'n22'], ['OUTROS', 'outros'], ['BRANCOS', 'brancos'], ['NULOS', 'nulos'], ['APTOS', 'aptos'], ['VOTARAM', 'comparecimento'],
]
const virg = (n: number, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })

export default function Boletins() {
  const [t, setT] = useState<1 | 2>(2)
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [refP, playP] = usePlayOnView<HTMLDivElement>()
  const R = BU[`t${t}`]
  const P = BU.prorrogacao
  const total = BU.t1.boletins + BU.t2.boletins
  const assin = BU.t1.assinaturas_conferidas + BU.t2.assinaturas_conferidas
  const arqs = BU.t1.arquivos + BU.t2.arquivos
  const vm = R.votos_manuais
  const qt = vm.por_quintil as { quintil: string; sem_biometria_vs_vizinhas_pp: number; lula_vs_vizinhas_pp: number }[]
  const hb = (x: any) => x.horario_brasilia.urnas_abertas_antes_das_8h + x.horario_brasilia.urnas_encerradas_antes_das_17h
  const verif: [string, string][] = [
    [fmt(total), 'boletins conferidos, um a um, nos dois turnos'],
    [String(BU.t1.urnas_com_qualquer_diferenca + BU.t2.urnas_com_qualquer_diferenca), 'urnas com qualquer número diferente'],
    [`${assin}/${arqs}`, 'arquivos do TSE com a assinatura digital conferida'],
    [String(hb(BU.t1) + hb(BU.t2)), 'urnas abertas antes das 8h ou fechadas antes das 17h (hora de Brasília)'],
  ]
  const linhas = LINHAS.filter(([, c]) => !(c === 'outros' && R.totais_boletins.outros === 0))
  const margem = BU.t2.totais_boletins.lula - BU.t2.totais_boletins.n22
  const maxP = Math.max(P.lula, P.flavio)
  const cid = P.cidades_com_mais_urnas as { nome: string; urnas: number }[]

  return (
    <section className="wrap py-16 md:py-24" aria-labelledby="bu">
      <p className="eyebrow mb-3">Conferência com o papel · Brasil inteiro · 1º e 2º turnos</p>
      <h2 id="bu" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase max-w-[20ch]">O papel da porta da seção bate com o sistema</h2>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] mt-6">
        <div className="prose-p space-y-4 min-w-0">
          <p>
            Quando a votação termina, cada urna imprime um <strong>boletim de urna</strong> com seus votos. Ele é assinado pelos
            mesários, fica colado na porta da seção e tem um QR Code que qualquer pessoa pode fotografar. Os fiscais dos partidos
            levam cópias.
          </p>
          <p>
            Se alguém mexesse nos números depois, no caminho entre a urna e o resultado oficial, o papel e o sistema iam discordar.
            Pegamos o conteúdo de <strong>todos os {fmt(total)} boletins</strong> do Brasil e do exterior ({fmt(BU.t1.boletins)} no
            1º turno e {fmt(BU.t2.boletins)} no 2º) e comparamos, urna por urna, com a totalização oficial. Os dois são idênticos
            em todos os campos, em todos os estados.
          </p>
          <div className="grid grid-cols-2 gap-px mt-6" style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}>
            {verif.map(([n, tx], i) => (
              <div key={tx} className="p-4" style={{ background: 'var(--paper)' }}>
                <div className="display text-[2.2rem] leading-none" style={{ color: i > 0 ? 'var(--ok)' : 'var(--ink)' }}>{n}</div>
                <div className="text-[0.85rem] mt-1.5" style={{ color: 'var(--ink-2)' }}>{tx}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.88rem]" style={{ color: 'var(--ink-3)' }}>
            O boletim anota a hora local. Em Mato Grosso, Mato Grosso do Sul, Rondônia, Roraima e Amazonas a urna abre às 7h e fecha
            às 16h do relógio de lá, que são 8h e 17h em Brasília; no Acre, às 6h e 15h. Por isso uma contagem descuidada acha
            "{fmt(BU.t2.horario_local.urnas_abertas_antes_das_8h)} urnas abertas antes das 8h". Dois números de urna aparecem em
            várias seções: todas no exterior, pequenas e sem horário de abertura. O TSE marca essas seções como "sistema de
            apuração": o voto foi em cédula de papel, e os votos foram lançados depois em uma mesma urna.
          </p>
        </div>

        <div className="min-w-0 grid gap-8 content-start">
          <div>
            <div className="flex gap-2 mb-4" role="group" aria-label="Escolher o turno">
              {([1, 2] as const).map((x) => (
                <button key={x} className="btn" aria-pressed={t === x} onClick={() => setT(x)}>{x}º turno</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 items-start">
              {(['totais_boletins', 'totais_totalizacao'] as const).map((k, j) => (
                <div key={k + t} className="receipt print-in px-2.5 sm:px-4 pt-4 pb-6 min-w-0">
                  <div className="text-center font-semibold tracking-[0.1em] text-[0.7rem]">{j === 0 ? 'BOLETINS' : 'TOTALIZAÇÃO'}</div>
                  <div className="text-center text-[0.58rem] sm:text-[0.62rem]" style={{ color: 'var(--ink-3)' }}>BRASIL · PRESIDENTE · {t}º TURNO</div>
                  <div className="rule-dash my-2.5" />
                  {linhas.map(([rot, c]) => (
                    <div key={c} className="receipt-row text-[0.6rem] sm:text-[0.74rem]" style={{ gap: '0.4rem' }}>
                      <span style={{ color: 'var(--ink-2)' }}>{rot}</span><span className="font-semibold">{fmt(R[k][c])}</span>
                    </div>
                  ))}
                  <div className="rule-dash my-2.5" />
                  <div className="receipt-row text-[0.62rem] sm:text-[0.7rem] font-semibold" style={{ color: 'var(--ok)', gap: '0.4rem' }}>
                    <span>URNAS</span><span>{fmt(R[k].urnas)} ✓</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mono text-[0.6rem] mt-3" style={{ color: 'var(--ink-3)' }}>
              OS APTOS SOMAM {t === 2 ? '525' : '495'} A MENOS QUE O TOTAL OFICIAL DO TSE (158.745.502): SÃO ELEITORES DE 85 SEÇÕES DO EXTERIOR QUE NÃO FORAM INSTALADAS E, POR ISSO, NÃO TÊM BOLETIM.
            </p>
          </div>

          <div ref={ref} className="p-5 md:p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-2">
              <h3 className="text-[1.3rem] font-extrabold" style={{ fontStretch: '85%' }}>E os "votos manuais"?</h3>
              <span className="chip chip-ok">✓ Sem sinal</span>
            </div>
            <p className="text-[0.95rem]" style={{ color: 'var(--ink-2)' }}>
              O boletim também diz quantos eleitores foram liberados sem a digital: {fmtMi(R.eleitores_liberados_sem_biometria)} no {t}º turno
              ({virg(R.pct_sem_biometria)}% de quem votou). Se essas liberações fossem usadas para inventar votos para Lula, as urnas com mais
              liberações que as vizinhas da mesma escola dariam bem mais votos a ele. A diferença é mínima:{' '}
              <b>{virg(vm.lula_pp_por_pp_sem_biometria, 2)} ponto de Lula</b> para cada ponto a mais de liberação manual. Fraude daria perto de 1 ponto.
            </p>
            <div className="mt-4 grid gap-1.5" key={t}>
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] mono text-[0.6rem] sm:text-[0.64rem]" style={{ color: 'var(--ink-3)' }}>
                <span>LIBERAÇÕES SEM DIGITAL × VIZINHAS</span><span className="pl-2">VOTO EM LULA × VIZINHAS</span>
              </div>
              {qt.map((q, i) => (
                <div key={q.quintil} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center">
                  <div className="flex items-center justify-end gap-2 pr-2">
                    <span className="mono text-[0.66rem]" style={{ color: 'var(--ink-2)' }}>{q.sem_biometria_vs_vizinhas_pp > 0 ? '+' : ''}{virg(q.sem_biometria_vs_vizinhas_pp, 1)}</span>
                    <span className={`grow-x ${play ? 'play' : ''} h-3 rounded-[2px]`} style={{ width: `${(48 * Math.abs(q.sem_biometria_vs_vizinhas_pp)) / 5}%`, background: 'var(--ink-3)', animationDelay: `${i * 70}ms` }} />
                  </div>
                  <div className="flex items-center gap-2 pl-2" style={{ borderLeft: '1px solid var(--rule)' }}>
                    <span className={`grow-x ${play ? 'play' : ''} h-3 rounded-[2px]`} style={{ width: `${(48 * Math.abs(q.lula_vs_vizinhas_pp)) / 5}%`, minWidth: 2, background: 'var(--lula)', animationDelay: `${i * 70}ms` }} />
                    <span className="mono text-[0.66rem]" style={{ color: 'var(--ink-2)' }}>{q.lula_vs_vizinhas_pp > 0 ? '+' : ''}{virg(q.lula_vs_vizinhas_pp, 2)}</span>
                  </div>
                </div>
              ))}
              <p className="mono text-[0.6rem] mt-1" style={{ color: 'var(--ink-3)' }}>
                CADA LINHA = 1/5 DAS {fmt(vm.urnas_testadas)} URNAS, EM PONTOS PERCENTUAIS. AS DUAS COLUNAS USAM A MESMA ESCALA.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div ref={refP} className="mt-10 p-5 md:p-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 mb-2">
            <h3 className="text-[1.3rem] font-extrabold" style={{ fontStretch: '85%' }}>E as urnas que ficaram abertas até as 19h?</h3>
            <span className="chip chip-ok">✓ Não muda o resultado</span>
          </div>
          <p className="text-[0.95rem]" style={{ color: 'var(--ink-2)' }}>
            No 2º turno, <b>{fmt(P.urnas)} urnas</b> fecharam perto das 19h ou depois, sobretudo nas cidades de {cid[0].nome} ({fmt(cid[0].urnas)}),
            {' '}{cid[1].nome} ({fmt(cid[1].urnas)}) e {cid[2].nome} ({fmt(cid[2].urnas)}). Juntas, receberam {virg(P.eleitores_que_votaram / 1e6, 2)} milhão
            de eleitores no dia inteiro, quase todos antes das 17h (o TSE contou 34.393 votos depois desse horário e 6.766 seções encerradas depois das 19h; a diferença para a nossa contagem vem do critério de horário). Deram {virg(P.lula_pct, 0)}% a Lula
            e {virg(100 - P.lula_pct, 0)}% a Flávio.
          </p>
          <p className="text-[0.95rem] mt-3" style={{ color: 'var(--ink-2)' }}>
            Do 1º para o 2º turno, essas urnas mudaram igual às outras urnas da mesma cidade: diferença de{' '}
            {virg(Math.abs(P.mudanca_1t_2t_vs_resto_da_cidade_pp), 2)} ponto. Se o horário extra tivesse sido usado para favorecer Lula, elas teriam se afastado do resto.
          </p>
        </div>
        <div className="min-w-0 grid gap-3 content-center">
          {([['LULA', P.lula, 'var(--lula)'], ['FLÁVIO', P.flavio, 'var(--flavio)']] as const).map(([n, v, cor], i) => (
            <div key={n} className="grid grid-cols-[4.2rem_minmax(0,1fr)] items-center gap-3">
              <span className="mono text-[0.7rem] font-semibold">{n}</span>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`grow-x ${playP ? 'play' : ''} h-6 rounded-[2px]`} style={{ width: `${(78 * v) / maxP}%`, background: cor, animationDelay: `${i * 120}ms` }} />
                <span className="mono text-[0.72rem] whitespace-nowrap">{fmt(v)}</span>
              </div>
            </div>
          ))}
          <div className="rule-dash my-2" />
          <div className="grid grid-cols-2 gap-px" style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}>
            <div className="p-3" style={{ background: 'var(--paper)' }}>
              <div className="mono text-[0.6rem]" style={{ color: 'var(--ink-3)' }}>VANTAGEM DE LULA</div>
              <div className="display text-[1.8rem] leading-none mt-1">{fmtMi(margem, 2)}</div>
            </div>
            <div className="p-3" style={{ background: 'var(--paper)' }}>
              <div className="mono text-[0.6rem]" style={{ color: 'var(--ink-3)' }}>APAGANDO ESSAS URNAS INTEIRAS</div>
              <div className="display text-[1.8rem] leading-none mt-1" style={{ color: 'var(--ok)' }}>{fmtMi(P.margem_lula_sem_essas_urnas, 2)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
