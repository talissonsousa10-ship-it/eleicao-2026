import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { fmt, fmtMi, useLargura, usePlayOnView } from '@/lib/util'
import DD from '../data/decisao.json'

const X = DD as any
const C = X.conta
const virg = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const mi = (n: number, d = 2) => `${virg(n / 1e6, d)} milhões`
const sinal = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${virg(Math.abs(n), d)}`
const ver = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.2 }, transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] as const } }

function Secao({ id, eyebrow, titulo, children, fundo }: { id: string; eyebrow: string; titulo: string; children: React.ReactNode; fundo?: boolean }) {
  return (
    <section id={id} className="py-14 md:py-20" style={fundo ? { background: 'var(--paper-2)' } : undefined} aria-labelledby={`${id}-t`}>
      <div className="wrap">
        <motion.div {...ver}>
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h2 id={`${id}-t`} className="display text-[clamp(2rem,4.6vw,3.4rem)] uppercase max-w-[22ch] leading-[0.95]">{titulo}</h2>
        </motion.div>
        {children}
      </div>
    </section>
  )
}

function Conta({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 p-4 md:p-5 rounded-[3px]" style={{ background: 'var(--card)', border: '1px dashed var(--ink-3)' }}>
      <p className="mono text-[0.66rem] mb-1.5" style={{ color: 'var(--ink-3)' }}>{t}</p>
      <div className="text-[0.95rem]" style={{ color: 'var(--ink-2)' }}>{children}</div>
    </div>
  )
}

/* ---------------- abertura ---------------- */
function Abertura() {
  const fm = X.flavio_melhor_que_2022
  return (
    <header className="wrap pt-10 pb-12 md:pt-14 md:pb-16">
      <p className="eyebrow mb-4">Onde a eleição foi decidida · análise dos dados do TSE e do IBGE</p>
      <h1 className="display uppercase text-[clamp(2.2rem,7vw,5.4rem)] leading-[0.92]">
        Flávio saiu do 1º turno <span style={{ color: 'var(--flavio)' }}>2,2 milhões</span> à frente.
        <br /><span style={{ color: 'var(--ink-3)' }}>Perdeu o 2º por</span> <span style={{ color: 'var(--lula)' }}>4,4 milhões</span>.
      </h1>
      <p className="lede mt-7">
        Em três semanas, a diferença mudou 6,7 milhões de votos. Este capítulo usa as urnas e os dados do IBGE para mostrar de onde
        veio essa mudança, com a matemática explicada passo a passo. O objetivo é descrever o que os números mostram, a favor e
        contra cada lado, e dizer com clareza onde eles deixam de ser certeza e passam a ser estimativa.
      </p>
      <motion.ol className="mt-9 grid gap-3 md:grid-cols-3" initial="a" whileInView="b" viewport={{ once: true }}
        variants={{ b: { transition: { staggerChildren: 0.12 } } }}>
        {[
          ['1', 'A virada veio de quem não tinha escolhido nenhum dos dois', 'Do 1º para o 2º turno, Lula ganhou 10,4 milhões de votos e Flávio, 3,7 milhões. Esses votos vieram de quem votou em outro candidato ou em ninguém. Pelo modelo das urnas, o grupo que mais pesou foi o de quem não votou em ninguém: cerca de 6 milhões foram para Lula.'],
          ['2', 'Os outros candidatos se dividiram', 'Os 9,3 milhões de eleitores de Cury, Renan, Caiado e Zema se dividiram quase ao meio. As pesquisas indicavam vantagem clara para Flávio nesse grupo.'],
          ['3', 'O Brasil grande pesou mais que o pequeno', `Comparado a 2022, Flávio foi melhor que o pai em ${fmt(fm.municipios)} municípios. Mas eles somam só ${virg(100 * fm.validos / fm.validos_total, 0)}% dos votos; nas cidades grandes, ele recuou.`],
        ].map(([n, t, d]) => (
          <motion.li key={n} variants={{ a: { opacity: 0, y: 14 }, b: { opacity: 1, y: 0 } }} className="p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <span className="display text-[2.4rem] leading-none" style={{ color: 'var(--ink-3)' }}>{n}</span>
            <h3 className="text-[1.15rem] font-extrabold mt-2" style={{ fontStretch: '85%' }}>{t}</h3>
            <p className="text-[0.92rem] mt-1.5" style={{ color: 'var(--ink-2)' }}>{d}</p>
          </motion.li>
        ))}
      </motion.ol>
    </header>
  )
}

/* ---------------- fluxo (sankey) ---------------- */
const NOS1: [string, string, string][] = [['lula', 'Lula', 'var(--lula)'], ['flavio', 'Flávio', 'var(--flavio)'], ['terceiros', 'Outros', 'var(--warn)'], ['nenhum', 'Ninguém', 'var(--ink-3)']]
const NOS2: [string, string, string][] = [['lula', 'Lula', 'var(--lula)'], ['flavio', 'Flávio', 'var(--flavio)'], ['nenhum', 'Ninguém', 'var(--ink-3)']]

function Sankey() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [foco, setFoco] = useState<string | null>(null)
  const [box, larg] = useLargura<HTMLDivElement>(640)
  const F = X.fluxos as Record<string, Record<string, number>>
  const W = Math.max(300, larg), estreito = W < 520, H = estreito ? 380 : 440, nw = estreito ? 10 : 14, gap = 10
  const L = estreito ? 70 : 104, R = W - L, fs = estreito ? 11.5 : 13
  const tot1 = NOS1.map(([k]) => Object.values(F[k]).reduce((a, b) => a + b, 0))
  const tot2 = NOS2.map(([k]) => NOS1.reduce((a, [o]) => a + F[o][k], 0))
  const soma = tot1.reduce((a, b) => a + b, 0)
  const k = (H - gap * (NOS1.length - 1)) / soma
  const y1: number[] = [], y2: number[] = []
  NOS1.reduce((y, _, i) => { y1[i] = y; return y + tot1[i] * k + gap }, 0)
  const extra = (H - tot2.reduce((a, b) => a + b, 0) * k) / (NOS2.length - 1)
  NOS2.reduce((y, _, i) => { y2[i] = y; return y + tot2[i] * k + extra }, 0)
  const off1 = [...y1], off2 = [...y2]
  const fitas: { o: string; d: string; v: number; path: string; cor: string }[] = []
  NOS1.forEach(([o], i) => NOS2.forEach(([d, , cor], j) => {
    const v = F[o][d]
    if (v <= 0) return
    const h = v * k, a = off1[i], b = off2[j]
    off1[i] += h; off2[j] += h
    const x0 = L + nw, x1 = R, mx = (x0 + x1) / 2
    fitas.push({ o, d, v, cor, path: `M${x0},${a} C${mx},${a} ${mx},${b} ${x1},${b} L${x1},${b + h} C${mx},${b + h} ${mx},${a + h} ${x0},${a + h} Z` })
  }))
  const mudou = (f: (typeof fitas)[number]) => f.o !== f.d
  return (
    <div ref={ref} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] items-start">
      <div className="min-w-0" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <div className="flex justify-between mono text-[0.62rem] px-3 pt-3" style={{ color: 'var(--ink-3)' }}><span>1º TURNO · VOTOU EM</span><span>2º TURNO · VOTOU EM</span></div>
        <div ref={box} className="px-2">
        <svg width={W} height={H + 12} viewBox={`0 -6 ${W} ${H + 12}`} className="w-full h-auto block" role="img" aria-label="Diagrama de fluxo dos votos do 1º para o 2º turno">
          {fitas.map((f, i) => {
            const ativo = foco ? f.o === foco || f.d === foco : mudou(f)
            return (
              <motion.path key={i} d={f.path} fill={f.cor} initial={{ opacity: 0 }}
                animate={{ opacity: play ? (ativo ? (mudou(f) ? 0.62 : 0.22) : 0.07) : 0 }} transition={{ duration: 0.6, delay: play && !foco ? 0.15 + i * 0.06 : 0 }}
                onMouseEnter={() => setFoco(f.o)} onMouseLeave={() => setFoco(null)}>
                <title>{`${NOS1.find((n) => n[0] === f.o)![1]} → ${NOS2.find((n) => n[0] === f.d)![1]}: ${fmt(f.v)} votos`}</title>
              </motion.path>
            )
          })}
          {NOS1.map(([kk, nome, cor], i) => (
            <g key={kk} onMouseEnter={() => setFoco(kk)} onMouseLeave={() => setFoco(null)} style={{ cursor: 'default' }}>
              <rect x={L} y={y1[i]} width={nw} height={Math.max(2, tot1[i] * k)} fill={cor} />
              <text x={L - 8} y={y1[i] + Math.max(2, tot1[i] * k) / 2} textAnchor="end" dominantBaseline="middle" className="mono" style={{ fontSize: fs, fill: 'var(--ink)' }}>
                <tspan x={L - 8} dy="-0.5em" fontWeight="700">{nome}</tspan><tspan x={L - 8} dy="1.25em" style={{ fill: 'var(--ink-3)' }}>{fmtMi(tot1[i])}</tspan>
              </text>
            </g>
          ))}
          {NOS2.map(([kk, nome, cor], j) => (
            <g key={kk}>
              <rect x={R} y={y2[j]} width={nw} height={tot2[j] * k} fill={cor} />
              <text x={R + nw + 8} y={y2[j] + (tot2[j] * k) / 2} dominantBaseline="middle" className="mono" style={{ fontSize: fs, fill: 'var(--ink)' }}>
                <tspan x={R + nw + 8} dy="-0.5em" fontWeight="700">{nome}</tspan><tspan x={R + nw + 8} dy="1.25em" style={{ fill: 'var(--ink-3)' }}>{fmtMi(tot2[j])}</tspan>
              </text>
            </g>
          ))}
        </svg>
        </div>
        <p className="mono text-[0.6rem] px-3 pb-3" style={{ color: 'var(--ink-3)' }}>
          "NINGUÉM" = NÃO FOI VOTAR, VOTOU EM BRANCO OU ANULOU. EM DESTAQUE, SÓ OS VOTOS QUE MUDARAM DE LUGAR. PASSE O MOUSE NUM GRUPO PARA SEGUIR SEUS VOTOS.
        </p>
      </div>
      <div className="prose-p space-y-4 min-w-0">
        <p>
          O diagrama segue os <strong>{virg(158.7, 1)} milhões de eleitores</strong> do 1º para o 2º turno. À esquerda, o que cada grupo fez no 1º;
          à direita, no 2º. A largura de cada faixa é o número de pessoas.
        </p>
        <p>
          A faixa que decide sai do bloco cinza: de quem não tinha escolhido ninguém no 1º turno, <strong>{mi(F.nenhum.lula, 1)}</strong> foram votar
          em Lula e só <strong>{fmt(Math.round(F.nenhum.flavio / 1000) * 1000)}</strong> em Flávio (na checagem estado por estado, cerca de 880 mil). Já os eleitores dos outros candidatos se dividiram:{' '}
          {mi(F.terceiros.lula, 1)} para Lula e {mi(F.terceiros.flavio, 1)} para Flávio.
        </p>
        <Conta t="A CONTA, EM UMA LINHA">
          1º turno: Flávio {fmt(C.flavio_1t)} × Lula {fmt(C.lula_1t)}. Lula ganhou {mi(C.ganho_lula)} de votos e Flávio {mi(C.ganho_flavio)}.
          A diferença dos ganhos ({mi(C.ganho_lula - C.ganho_flavio)}) é maior que a vantagem de Flávio ({mi(C.vantagem_flavio_1t)}),
          e o que sobra ({mi(C.vantagem_lula_2t)}) é a vitória de Lula.
        </Conta>
      </div>
    </div>
  )
}

function Fluxo() {
  const S = X.simples
  const es = S.fluxos_estados_brasil
  const t3 = es.terceiros.lula + es.terceiros.flavio + es.terceiros.nenhum
  return (
    <Secao id="fluxo" eyebrow="1 · De onde vieram os votos do 2º turno" titulo="A virada veio de quem não tinha escolhido Lula nem Flávio">
      <Sankey />
      <motion.div {...ver} className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="prose-p space-y-3">
          <h3 className="text-[1.2rem] font-extrabold" style={{ fontStretch: '85%', color: 'var(--ink)' }}>Como dá para saber, se o voto é secreto?</h3>
          <p>
            Ninguém sabe em quem uma pessoa votou. O que dá para fazer é comparar as <strong>443 mil urnas</strong> que tiveram o mesmo eleitorado
            nos dois turnos. Se nas urnas onde Caiado teve mais votos no 1º turno Flávio cresceu mais no 2º, é sinal de que parte dos eleitores de
            Caiado foi para Flávio. A matemática acha as porcentagens que melhor explicam, ao mesmo tempo, o resultado de todas as urnas.
          </p>
          <p>
            A conta tem duas regras de bom senso: nenhuma porcentagem é negativa e as de cada grupo somam 100%. Com elas, as porcentagens
            reproduzem o resultado oficial com erro menor que 0,2%.
          </p>
        </div>
        <div className="prose-p space-y-3">
          <h3 className="text-[1.2rem] font-extrabold" style={{ fontStretch: '85%', color: 'var(--ink)' }}>O quanto confiar</h3>
          <p>
            Esse método se chama <strong>inferência ecológica</strong> e tem um limite conhecido: ele supõe que um eleitor de Caiado em Salvador e um em
            Goiânia se comportam parecido. Para testar isso, refizemos a conta estado por estado, cada um com suas próprias porcentagens.
          </p>
          <p>
            O resultado principal se manteve: de quem não votou em ninguém no 1º turno, {mi(es.nenhum.lula, 1)} foram para Lula e {fmt(Math.round(es.nenhum.flavio / 1000) * 1000)} para Flávio.
            O que muda é a divisão dos outros candidatos, que fica mais favorável a Lula: {virg(100 * es.terceiros.lula / t3, 0)}% para ele e{' '}
            {virg(100 * es.terceiros.flavio / t3, 0)}% para Flávio. Por isso, nesta página, essa divisão aparece como "quase ao meio", e não como um número exato.
          </p>
          <p>
            <strong>O que é certo e o que é estimativa.</strong> É conta, não estimativa: Lula ganhou 10,4 milhões de votos entre os turnos e Flávio,
            3,7 milhões. Somados, os dois ganharam 14,1 milhões de votos, e 74% desse ganho foi de Lula. Esses votos vieram quase todos de dois grupos:
            quem votou em outro candidato e quem não votou em ninguém. Já a divisão entre esses dois grupos é estimativa. Outro método, o do teste 1 da
            página principal, que compara zonas em vez de urnas, dá mais crédito aos eleitores dos outros candidatos e menos aos que não tinham votado.
            Os dois métodos concordam que Lula ficou com a maior parte do total.
          </p>
        </div>
      </motion.div>
    </Secao>
  )
}

/* ---------------- terceiros ---------------- */
const REGS = ['Brasil', 'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'] as const

function BarraTripla({ l, f, n, play, atraso = 0, alto = 16 }: { l: number; f: number; n: number; play: boolean; atraso?: number; alto?: number }) {
  const t = l + f + n || 1
  const seg = (v: number, cor: string, i: number, op = 1) => (
    <motion.span key={i} initial={{ width: 0 }} animate={{ width: play ? `${(100 * v) / t}%` : 0 }} transition={{ duration: 0.8, delay: atraso + i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ background: cor, opacity: op }} />
  )
  return <div className="flex w-full overflow-hidden rounded-[2px]" style={{ height: alto, background: 'var(--paper-2)' }}>{seg(l, 'var(--lula)', 0)}{seg(n, 'var(--ink-3)', 1, 0.35)}{seg(f, 'var(--flavio)', 2)}</div>
}

function Terceiros() {
  const [reg, setReg] = useState<(typeof REGS)[number]>('Brasil')
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const Q = X.pesquisas.quaest
  const linhas = (['cury', 'renan', 'caiado'] as const).map((k) => {
    const nac = X.candidatos[k]
    const v = reg === 'Brasil' ? { lula: nac.lula.taxa, flavio: nac.flavio.taxa } : X.candidatos_regiao[reg][k]
    return { k, nome: nac.nome, votos: nac.votos_1t, l: v.lula, f: v.flavio, n: 100 - v.lula - v.flavio, q: Q[k], faixa: reg === 'Brasil' ? nac : null }
  })
  const st = X.simples.taxas.terceiros
  return (
    <Secao id="terceiros" eyebrow="2 · Os eleitores dos outros candidatos" titulo="Não foram em bloco para Flávio" fundo>
      <div ref={ref} className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-5" role="group" aria-label="Região">
            {REGS.map((r) => <button key={r} className="btn !py-1.5 !px-2.5 !text-[0.66rem]" aria-pressed={reg === r} onClick={() => setReg(r)}>{r}</button>)}
          </div>
          <div className="grid gap-6">
            {linhas.map((x, i) => (
              <div key={x.k}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-[1.15rem] font-extrabold" style={{ fontStretch: '85%' }}>{x.nome}</h3>
                  <span className="mono text-[0.64rem]" style={{ color: 'var(--ink-3)' }}>{fmtMi(x.votos, 1)} DE VOTOS NAS URNAS ANALISADAS</span>
                </div>
                <div className="mt-2 grid grid-cols-[4.6rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 items-center">
                  <span className="mono text-[0.62rem]" style={{ color: 'var(--ink-2)' }}>URNAS</span>
                  <BarraTripla l={x.l} f={x.f} n={x.n} play={play} atraso={i * 0.1} />
                  <span />
                  <span className="mono text-[0.66rem] flex justify-between"><b style={{ color: 'var(--lula)' }}>LULA {virg(x.l, 0)}%</b><span style={{ color: 'var(--ink-3)' }}>NINGUÉM {virg(Math.max(0, x.n), 0)}%</span><b style={{ color: 'var(--flavio)' }}>FLÁVIO {virg(x.f, 0)}%</b></span>
                  {reg === 'Brasil' && (
                    <>
                      <span className="mono text-[0.62rem]" style={{ color: 'var(--ink-3)' }}>PESQUISA</span>
                      <div className="opacity-70"><BarraTripla l={x.q[0]} f={x.q[1]} n={x.q[2]} play={play} atraso={0.3 + i * 0.1} alto={8} /></div>
                      <span />
                      <span className="mono text-[0.6rem]" style={{ color: 'var(--ink-3)' }}>QUAEST, 10 A 13/10: LULA {x.q[0]}% · FLÁVIO {x.q[1]}% · NINGUÉM OU INDECISO {x.q[2]}%</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[0.82rem] mt-5" style={{ color: 'var(--ink-3)' }}>
            Zema (330 mil votos) e os outros seis candidatos (270 mil) tiveram votos de menos para uma estimativa confiável e ficaram de fora do gráfico.
            "Ninguém" junta quem não foi votar, votou em branco ou anulou no 2º turno.
          </p>
        </div>
        <div className="prose-p space-y-4 min-w-0">
          <p>
            Antes do 2º turno, as pesquisas indicavam que esses eleitores pendiam para Flávio. No Datafolha de 6 a 8 de outubro, os eleitores de Cury,
            Renan, Caiado e Zema, somados, davam <strong>46% a Flávio e 32% a Lula</strong>.
          </p>
          <p>
            As urnas mostram uma divisão bem mais equilibrada. Somando todos, a estimativa é de {virg(st.lula.taxa, 0)}% para Lula e {virg(st.flavio.taxa, 0)}% para Flávio,
            com margem de mais ou menos 2 pontos. O padrão muda muito por candidato e por região:
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li>Os eleitores de <strong>Caiado</strong> foram os que mais seguiram para Flávio; no Sul, quase dois terços.</li>
            <li>Os de <strong>Augusto Cury</strong> foram mais para Lula, sobretudo no Nordeste e no Norte.</li>
            <li>Os de <strong>Renan Santos</strong> se dividiram: maioria para Lula no Norte e no Nordeste, para Flávio no Sul e quase empate no Sudeste.</li>
          </ul>
          <Conta t="E SE AS PESQUISAS ESTIVESSEM CERTAS SOBRE ESSE GRUPO?">
            Refazendo a conta com a divisão do Datafolha (46% Flávio, 32% Lula) para os 9,3 milhões de votos dos outros candidatos, e mantendo
            todo o resto igual, Lula ainda venceria por cerca de <strong>{mi(resultado(TESES[1].taxas()).m, 1)}</strong>. Dá para testar no simulador logo abaixo. A divisão desse grupo ajudou,
            mas não decidiu sozinha.
          </Conta>
          <p className="text-[0.85rem]" style={{ color: 'var(--ink-3)' }}>
            Pesquisa e urna não medem a mesma coisa: a pesquisa mede intenção, com indecisos, dias antes; a urna mede o voto, mas só por estimativa.
            A distância entre as duas é compatível com o erro das pesquisas no 2º turno, que deram Flávio na frente.
          </p>
        </div>
      </div>
    </Secao>
  )
}

/* ---------------- simulador ---------------- */
type GrupoSim = { k: string; nome: string; votos: number; l: number; f: number; max: number; nota?: string }
const SIM = X.simulador
const ST = X.simples.taxas
const GRUPOS: GrupoSim[] = [
  { k: 'cury', nome: 'Augusto Cury', votos: SIM.votos_1t.cury, l: SIM.grupos.cury.lula, f: SIM.grupos.cury.flavio, max: 100 },
  { k: 'renan', nome: 'Renan Santos', votos: SIM.votos_1t.renan, l: SIM.grupos.renan.lula, f: SIM.grupos.renan.flavio, max: 100 },
  { k: 'caiado', nome: 'Ronaldo Caiado', votos: SIM.votos_1t.caiado, l: SIM.grupos.caiado.lula, f: SIM.grupos.caiado.flavio, max: 100 },
  { k: 'zema', nome: 'Zema e outros 6', votos: SIM.votos_1t.zema + SIM.votos_1t.pequenos, l: ST.terceiros.lula.taxa, f: ST.terceiros.flavio.taxa, max: 100, nota: 'poucos votos: usa a média de todos os outros candidatos' },
  { k: 'nenhum', nome: 'Não escolheu ninguém no 1º turno', votos: SIM.votos_1t.bn + SIM.votos_1t.abst, l: ST.nenhum.lula.taxa, f: ST.nenhum.flavio.taxa, max: 40, nota: 'não foi votar, votou em branco ou anulou' },
]
type Taxas = Record<string, [number, number]>
const BASE: Taxas = Object.fromEntries(GRUPOS.map((g) => [g.k, [g.l, g.f]]))
const TERC = ['cury', 'renan', 'caiado', 'zema']
type Tese = { id: string; rot: string; tese: string; muda: string; ler: string; taxas: () => Taxas }
const TESES: Tese[] = [
  { id: 'urnas', rot: 'O que as urnas indicam',
    tese: 'Ponto de partida: o que as 443 mil urnas indicam sobre o destino de cada grupo do 1º turno.',
    muda: 'Nada. As taxas são as estimadas na seção 1 (por exemplo, eleitores de Caiado: 35% para Lula, 57% para Flávio).',
    ler: 'É o resultado oficial. As taxas têm margem de cerca de 2 pontos. Compare as outras teses com esta.',
    taxas: () => ({ ...BASE }) },
  { id: 'datafolha', rot: 'As pesquisas acertaram sobre os outros candidatos',
    tese: '“Os eleitores dos outros candidatos iam para Flávio.” Era o que mostrava o Datafolha de 6 a 8/10: 46% para Flávio e 32% para Lula entre os eleitores de Cury, Renan, Caiado e Zema.',
    muda: 'Os 9,3 milhões de votos desses quatro passam a se dividir em 32% Lula, 46% Flávio e 22% ninguém. O resto fica igual.',
    ler: 'Mesmo com a pesquisa certa, Lula venceria. A pesquisa mede intenção dias antes, com indecisos; a urna mede o voto, mas por estimativa.',
    taxas: () => ({ ...BASE, ...Object.fromEntries(TERC.map((k) => [k, [32, 46]])) }) },
  { id: 'quaest', rot: 'Pesquisa Quaest, candidato a candidato',
    tese: 'A Quaest de 10 a 13/10 perguntou a cada eleitorado: Cury 34% Lula × 30% Flávio; Renan 14% × 40%; Caiado 23% × 42%.',
    muda: 'Cada um desses eleitorados passa a se dividir como na Quaest; nulos e indecisos da pesquisa viram "ninguém". Zema e os pequenos ficam como nas urnas.',
    ler: 'Os indecisos da pesquisa (46% entre os eleitores de Renan) aqui não votam em ninguém, o que tira votos dos dois. Ainda assim, Lula vence.',
    taxas: () => ({ ...BASE, cury: [34, 30], renan: [14, 40], caiado: [23, 42] }) },
  { id: 'zonas', rot: 'Outro método: a variação entre zonas',
    tese: 'O teste 1 da página principal usa outro método: compara quanto cada candidato cresceu em cada zona com o perfil da zona. Por ele, os eleitores dos outros candidatos foram 32% para Lula e 57% para Flávio.',
    muda: 'Os quatro eleitorados passam a se dividir em 32% Lula e 57% Flávio. O resto fica como nas urnas.',
    ler: 'É a divisão mais favorável a Flávio que algum método desta análise encontrou. Aqui ela se soma ao resto do modelo das urnas, o que dá o pior caso para Lula; mesmo assim, ele vence. Os dois métodos concordam no total da virada e diferem em quanto crédito dão a cada grupo.',
    taxas: () => ({ ...BASE, ...Object.fromEntries(TERC.map((k) => [k, [32, 57]])) }) },
  { id: 'todos_flavio', rot: 'Os outros candidatos foram todos para Flávio',
    tese: '“Os votos de Caiado, Zema, Renan e Cury eram da direita e iriam para Flávio.”',
    muda: '100% dos 9,3 milhões vão para Flávio: nenhum para Lula, ninguém deixa de votar.',
    ler: 'É o limite máximo, não um cenário provável: nenhuma pesquisa ou método mostrou mais de 57% de qualquer desses eleitorados indo para Flávio. Serve para mostrar que o grupo tinha votos suficientes para decidir, se tivesse ido em bloco.',
    taxas: () => ({ ...BASE, ...Object.fromEntries(TERC.map((k) => [k, [0, 100]])) }) },
  { id: 'sem_novos', rot: 'Quem não votou no 1º turno continuou sem votar',
    tese: '“A virada veio de votos que não existiam no 1º turno.”',
    muda: 'Os 39,4 milhões que não votaram em candidato no 1º turno (abstenção, branco e nulo) continuam sem votar em ninguém. O resto fica como foi.',
    ler: 'Mostra o peso desse grupo: sem ele, Flávio venceria. Isso não é sinal de fraude. O comparecimento subiu no país inteiro, os eleitores a mais se dividiram entre os dois candidatos nas zonas (teste 1) e, em 2022, foi Bolsonaro quem ganhou mais votos entre os turnos. É também a parte mais incerta da estimativa (ver a seção 1).',
    taxas: () => ({ ...BASE, nenhum: [0, 0] }) },
  { id: 'novos_meio', rot: 'Os novos votos se dividiram ao meio',
    tese: '“Se os novos votos tivessem se dividido igualmente, Flávio teria ganhado.”',
    muda: 'O mesmo número de pessoas sai da abstenção e do voto nulo, mas metade vai para cada candidato. Os outros grupos ficam como nas urnas.',
    ler: 'Pelo modelo das urnas, esse grupo foi quase todo para Lula. Pelo método das zonas, os eleitores a mais se dividiram quase ao meio (50 × 47), e a vantagem de Lula aparece em outros grupos. Esta tese mostra o que acontece se só uma parte da conta mudar; não deve ser lida sozinha.',
    taxas: () => { const m = (BASE.nenhum[0] + BASE.nenhum[1]) / 2; return { ...BASE, nenhum: [m, m] } } },
]

function resultado(t: Taxas) {
  // muda só o que o simulador mexe; o resto fica exatamente como foi (por isso "O que as urnas indicam" dá o resultado oficial)
  let l = SIM.lula_2t, f = SIM.flavio_2t
  for (const g of GRUPOS) { l += (g.votos * (t[g.k][0] - BASE[g.k][0])) / 100; f += (g.votos * (t[g.k][1] - BASE[g.k][1])) / 100 }
  return { l, f, m: l - f }
}

function Simulador() {
  const [tese, setTese] = useState('urnas')
  const [t, setT] = useState<Taxas>({ ...BASE })
  const r = resultado(t), real = resultado(BASE)
  const total = r.l + r.f
  const aplicar = (id: string) => { setTese(id); setT(TESES.find((x) => x.id === id)!.taxas()) }
  const mexer = (k: string, i: 0 | 1, v: number) => {
    setTese('livre')
    setT((o) => { const p: [number, number] = [...o[k]] as [number, number]; p[i] = v; if (p[0] + p[1] > 100) p[1 - i] = 100 - v; return { ...o, [k]: p } })
  }
  // quanto Flávio precisaria dos outros candidatos para empatar (divisão igual entre os quatro, resto como nas urnas)
  const T3 = GRUPOS.filter((g) => TERC.includes(g.k))
  const vt = T3.reduce((a, g) => a + g.votos, 0)
  const lb = T3.reduce((a, g) => a + (g.votos * g.l) / 100, 0), fb = T3.reduce((a, g) => a + (g.votos * g.f) / 100, 0)
  const ninguem = vt - lb - fb
  const xEmpate = (real.m - lb + fb + (vt - ninguem)) / (2 * vt)
  const T = TESES.find((x) => x.id === tese) ?? TESES[0]
  const mudancas = GRUPOS.filter((g) => t[g.k][0] !== BASE[g.k][0] || t[g.k][1] !== BASE[g.k][1])
    .map((g) => `${g.nome}: Lula ${virg(BASE[g.k][0], 0)}→${virg(t[g.k][0], 0)}%, Flávio ${virg(BASE[g.k][1], 0)}→${virg(t[g.k][1], 0)}%`)
  const venc = r.m >= 0 ? 'Lula' : 'Flávio'
  return (
    <Secao id="simulador" eyebrow="3 · Simulador" titulo="Teste as teses: e se os votos tivessem ido para outro lado?">
      <p className="prose-p mt-4">
        Escolha uma tese ou mexa nas barras. Cada linha é um grupo de eleitores do 1º turno; você decide quantos de cada 100 foram para Lula
        e para Flávio no 2º turno (o resto não votou em ninguém). Tudo o que você não mexer fica exatamente como foi.
      </p>
      <div className="mt-6 flex flex-wrap gap-1.5" role="group" aria-label="Teses">
        {TESES.map((x) => <button key={x.id} className="btn !py-1.5 !px-2.5 !text-[0.64rem] !normal-case !tracking-normal" aria-pressed={tese === x.id} onClick={() => aplicar(x.id)}>{x.rot}</button>)}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tese} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}
          className="mt-4 p-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} aria-live="polite">
          {(tese === 'livre'
            ? [['A TESE', 'Um cenário montado por você.'], ['O QUE MUDOU', mudancas.length ? mudancas.join(' · ') : 'Nada em relação às urnas.'], ['COMO LER', 'Cada barra muda um grupo e mantém o resto como foi. Volte a "O que as urnas indicam" para recomeçar.']]
            : [['A TESE', T.tese], ['O QUE O SIMULADOR MUDA', T.muda], ['COMO LER', T.ler]]
          ).map(([rot, tx], i) => (
            <div key={rot} className={i ? 'md:pl-4 md:border-l md:border-dashed' : ''} style={{ borderColor: 'var(--rule)' }}>
              <p className="mono text-[0.6rem] mb-1" style={{ color: i === 2 ? 'var(--ok)' : 'var(--ink-3)' }}>{rot}</p>
              <p className="text-[0.9rem]" style={{ color: 'var(--ink-2)' }}>{tx}</p>
            </div>
          ))}
          <div className="md:col-span-3 pt-3 flex flex-wrap items-baseline gap-x-3 mono text-[0.7rem]" style={{ borderTop: '1px dashed var(--rule)' }}>
            <span style={{ color: 'var(--ink-3)' }}>RESULTADO DESTA TESE:</span>
            <b style={{ color: r.m >= 0 ? 'var(--lula)' : 'var(--flavio)' }}>{venc.toUpperCase()} VENCE POR {fmt(Math.abs(r.m))}</b>
            {tese !== 'urnas' && <span style={{ color: 'var(--ink-3)' }}>({r.m - real.m >= 0 ? '+' : '−'}{fmt(Math.abs(r.m - real.m))} NA VANTAGEM DE LULA, COMPARADO AO REAL)</span>}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] items-start">
        <div className="grid gap-4 min-w-0">
          {GRUPOS.map((g) => {
            const [l, f] = t[g.k], n = Math.max(0, 100 - l - f)
            return (
              <div key={g.k} className="p-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <h3 className="text-[1.02rem] font-extrabold" style={{ fontStretch: '85%' }}>{g.nome}</h3>
                  <span className="mono text-[0.62rem]" style={{ color: 'var(--ink-3)' }}>{fmtMi(g.votos, 1)} NO 1º TURNO</span>
                </div>
                {g.nota && <p className="mono text-[0.58rem] mt-0.5" style={{ color: 'var(--ink-3)' }}>{g.nota.toUpperCase()}</p>}
                <div className="mt-2 flex h-3 w-full overflow-hidden rounded-[2px] gap-[2px]">
                  <motion.span animate={{ width: `${l}%` }} transition={{ duration: 0.3 }} style={{ background: 'var(--lula)' }} />
                  <motion.span animate={{ width: `${n}%` }} transition={{ duration: 0.3 }} style={{ background: 'var(--ink-3)', opacity: 0.3 }} />
                  <motion.span animate={{ width: `${f}%` }} transition={{ duration: 0.3 }} style={{ background: 'var(--flavio)' }} />
                </div>
                <div className="mt-2.5 grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
                  {([0, 1] as const).map((i) => (
                    <label key={i} className="grid grid-cols-[4.2rem_minmax(0,1fr)_3rem] items-center gap-2 mono text-[0.64rem]">
                      <span style={{ color: i === 0 ? 'var(--lula)' : 'var(--flavio)', fontWeight: 700 }}>{i === 0 ? 'LULA' : 'FLÁVIO'}</span>
                      <input type="range" min={0} max={g.max} step={g.max < 100 ? 0.5 : 1} value={t[g.k][i]} onChange={(e) => mexer(g.k, i, +e.target.value)}
                        style={{ accentColor: i === 0 ? 'var(--lula)' : 'var(--flavio)' }} aria-label={`${g.nome}: % para ${i === 0 ? 'Lula' : 'Flávio'}`} />
                      <span className="text-right">{virg(t[g.k][i], g.max < 100 ? 1 : 0)}%</span>
                    </label>
                  ))}
                </div>
                <div className="mono text-[0.58rem] mt-1" style={{ color: 'var(--ink-3)' }}>
                  NAS URNAS: LULA {virg(BASE[g.k][0], g.max < 100 ? 1 : 0)}% · FLÁVIO {virg(BASE[g.k][1], g.max < 100 ? 1 : 0)}% · NINGUÉM {virg(Math.max(0, 100 - BASE[g.k][0] - BASE[g.k][1]), 0)}%
                </div>
              </div>
            )
          })}
          <div className="lg:hidden sticky bottom-2 z-20 p-3 flex items-center gap-3" style={{ background: 'var(--card)', border: '1.5px solid var(--ink)', boxShadow: '0 12px 30px -14px rgba(0,0,0,.5)' }} aria-live="polite">
            <span className="display uppercase text-[1.15rem] leading-none whitespace-nowrap" style={{ color: r.m >= 0 ? 'var(--lula)' : 'var(--flavio)' }}>{venc} vence</span>
            <span className="mono text-[0.66rem] whitespace-nowrap">por {fmtMi(Math.abs(r.m), 2)}</span>
            <span className="flex-1 flex h-3 overflow-hidden rounded-[2px] gap-[2px] min-w-[3rem]">
              <motion.span animate={{ width: `${(100 * r.l) / total}%` }} style={{ background: 'var(--lula)' }} />
              <motion.span animate={{ width: `${(100 * r.f) / total}%` }} style={{ background: 'var(--flavio)' }} />
            </span>
          </div>
        </div>

        <div className="min-w-0 lg:sticky lg:top-16 grid gap-4">
          <div className="p-5" style={{ background: 'var(--card)', border: '1.5px solid var(--ink)' }}>
            <p className="eyebrow">Resultado do 2º turno neste cenário</p>
            <motion.p key={venc} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="display uppercase text-[2.2rem] leading-none mt-2" style={{ color: r.m >= 0 ? 'var(--lula)' : 'var(--flavio)' }}>
              {venc} vence
            </motion.p>
            <p className="mono text-[0.8rem] mt-1">por {fmt(Math.abs(r.m))} votos</p>
            <div className="mt-4 flex h-8 w-full overflow-hidden rounded-[3px] gap-[2px]">
              <motion.div animate={{ width: `${(100 * r.l) / total}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full flex items-center px-2 mono text-[0.72rem] font-semibold text-white whitespace-nowrap overflow-hidden" style={{ background: 'var(--lula)' }}>{virg((100 * r.l) / total, 1)}%</motion.div>
              <motion.div animate={{ width: `${(100 * r.f) / total}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="h-full flex items-center justify-end px-2 mono text-[0.72rem] font-semibold text-white whitespace-nowrap overflow-hidden" style={{ background: 'var(--flavio)' }}>{virg((100 * r.f) / total, 1)}%</motion.div>
            </div>
            <div className="relative h-0">
              <span className="absolute -top-8 h-8 w-[2px]" style={{ left: '50%', background: 'var(--ink)' }} title="50%" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-px mono text-[0.66rem]" style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}>
              <div className="p-2.5" style={{ background: 'var(--paper)' }}><div style={{ color: 'var(--ink-3)' }}>LULA</div><div className="font-semibold text-[0.8rem]">{fmt(r.l)}</div></div>
              <div className="p-2.5" style={{ background: 'var(--paper)' }}><div style={{ color: 'var(--ink-3)' }}>FLÁVIO</div><div className="font-semibold text-[0.8rem]">{fmt(r.f)}</div></div>
            </div>
            <p className="mono text-[0.62rem] mt-3" style={{ color: 'var(--ink-3)' }}>
              RESULTADO REAL: LULA POR {fmt(real.m)}. {tese !== 'urnas' && `DIFERENÇA PARA O REAL: ${r.m - real.m >= 0 ? '+' : '−'}${fmt(Math.abs(r.m - real.m))} NA VANTAGEM DE LULA.`}
            </p>
          </div>
          <Conta t="QUANTO FLÁVIO PRECISARIA DOS OUTROS CANDIDATOS">
            Mantendo todo o resto como foi, Flávio precisaria de <b>{virg(100 * xEmpate, 0)} de cada 100</b> eleitores de Cury, Renan, Caiado e Zema
            só para empatar (Lula ficando com {virg(100 - 100 * xEmpate - (100 * ninguem) / vt, 0)}). Nas urnas, ele teve cerca de {virg((100 * fb) / vt, 0)}; na pesquisa Datafolha, 46.
          </Conta>
          <p className="text-[0.82rem]" style={{ color: 'var(--ink-3)' }}>
            O simulador muda uma coisa de cada vez e mantém o resto. Na vida real, as coisas se influenciam: uma campanha que atraísse mais eleitores de
            Caiado talvez também mudasse quem foi votar. As taxas de partida são estimativas com margem de erro, explicadas na seção 1.
          </p>
        </div>
      </div>
    </Secao>
  )
}

/* ---------------- 2022 ---------------- */
function Paradoxo() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const fm = X.flavio_melhor_que_2022
  const pm = (100 * fm.municipios) / 5570, pv = (100 * fm.validos) / fm.validos_total
  const linha = (rot: string, p: number, sub: [string, string], i: number) => (
    <div>
      <div className="mono text-[0.66rem] mb-1" style={{ color: 'var(--ink-3)' }}>{rot}</div>
      <div className="flex h-9 w-full overflow-hidden rounded-[2px]">
        <motion.div initial={{ width: 0 }} animate={{ width: play ? `${p}%` : 0 }} transition={{ duration: 0.9, delay: i * 0.25 }} className="flex items-center px-2 mono text-[0.72rem] font-semibold text-white whitespace-nowrap overflow-hidden" style={{ background: 'var(--flavio)' }}>{virg(p, 0)}%</motion.div>
        <motion.div initial={{ width: 0 }} animate={{ width: play ? `${100 - p}%` : 0 }} transition={{ duration: 0.9, delay: i * 0.25 }} className="flex items-center justify-end px-2 mono text-[0.72rem] font-semibold text-white whitespace-nowrap overflow-hidden" style={{ background: 'var(--lula)' }}>{virg(100 - p, 0)}%</motion.div>
      </div>
      <div className="flex justify-between mono text-[0.6rem] mt-1" style={{ color: 'var(--ink-3)' }}><span>{sub[0]}</span><span>{sub[1]}</span></div>
    </div>
  )
  return (
    <div ref={ref} className="grid gap-5">
      {linha('MUNICÍPIOS', pm, [`${fmt(fm.municipios)} ONDE FLÁVIO FOI MELHOR QUE BOLSONARO EM 2022`, `${fmt(X.d22.municipios_em_que_lula_melhorou)} ONDE LULA MELHOROU`], 0)}
      {linha('VOTOS', pv, [`${mi(fm.validos, 1)} DE VOTOS`, `${mi(fm.validos_total - fm.validos, 1)} DE VOTOS`], 1)}
    </div>
  )
}

function BarrasDivergentes({ dados, rotulo, valor, max, sub }: { dados: any[]; rotulo: (d: any) => string; valor: (d: any) => number; max: number; sub?: (d: any) => string }) {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  return (
    <div ref={ref} className="grid gap-2.5">
      {dados.map((d, i) => {
        const v = valor(d), w = (50 * Math.min(Math.abs(v), max)) / max
        return (
          <div key={rotulo(d)} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)] gap-3 items-center">
            <span className="text-[0.88rem] leading-tight">{rotulo(d)}{sub && <span className="block mono text-[0.58rem]" style={{ color: 'var(--ink-3)' }}>{sub(d)}</span>}</span>
            <div className="relative h-6">
              <span className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--ink-3)' }} />
              <motion.span initial={{ width: 0 }} animate={{ width: play ? `${w}%` : 0 }} transition={{ duration: 0.8, delay: i * 0.07 }}
                className="absolute top-1 bottom-1" style={{ [v >= 0 ? 'left' : 'right']: '50%', background: v >= 0 ? 'var(--lula)' : 'var(--flavio)', borderRadius: 2 } as React.CSSProperties} />
              <span className="absolute top-0 bottom-0 flex items-center mono text-[0.66rem] font-semibold" style={v >= 0 ? { left: `calc(50% + ${w}% + 6px)` } : { right: `calc(50% + ${w}% + 6px)` }}>{sinal(v)}</span>
            </div>
          </div>
        )
      })}
      <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)] gap-3 mono text-[0.58rem]" style={{ color: 'var(--ink-3)' }}>
        <span /><span className="flex justify-between"><span>← MELHOR PARA FLÁVIO</span><span>MELHOR PARA LULA →</span></span>
      </div>
    </div>
  )
}

function Decomposicao() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const g = [...X.grupos.regiao].sort((a: any, b: any) => b.mudanca_vantagem - a.mudanca_vantagem)
  const max = Math.max(...g.map((x: any) => Math.max(Math.abs(x.por_voto) + Math.max(0, x.por_votantes), Math.abs(x.por_votantes) + Math.max(0, x.por_voto))))
  const px = (v: number) => (48 * Math.abs(v)) / max
  return (
    <div ref={ref} className="grid gap-3">
      {g.map((x: any, i: number) => {
        const partes: [number, string, number][] = [[x.por_voto, 'var(--lula)', 1], [x.por_votantes, 'var(--lula)', 0.45]]
        let pos = 0, neg = 0
        return (
          <div key={x.grupo} className="grid grid-cols-[6.4rem_minmax(0,1fr)_4.8rem] gap-3 items-center">
            <span className="text-[0.88rem]">{x.grupo}</span>
            <div className="relative h-6">
              <span className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--ink-3)' }} />
              {partes.map(([v, , op], j) => {
                const w = px(v), lado = v >= 0 ? 'left' : 'right', ini = v >= 0 ? pos : neg
                if (v >= 0) pos += w; else neg += w
                return (
                  <motion.span key={j} initial={{ width: 0 }} animate={{ width: play ? `${w}%` : 0 }} transition={{ duration: 0.8, delay: i * 0.08 + j * 0.2 }}
                    className="absolute top-1 bottom-1" style={{ [lado]: `calc(50% + ${ini}%)`, background: v >= 0 ? 'var(--lula)' : 'var(--flavio)', opacity: op } as React.CSSProperties}
                    title={`${j === 0 ? 'mudança de voto' : 'mudança no número de votantes'}: ${fmt(v)}`} />
                )
              })}
            </div>
            <span className="mono text-[0.68rem] text-right font-semibold">{x.mudanca_vantagem > 0 ? '+' : '−'}{fmtMi(Math.abs(x.mudanca_vantagem), 2)}</span>
          </div>
        )
      })}
      <div className="flex flex-wrap gap-4 mono text-[0.6rem] mt-1" style={{ color: 'var(--ink-3)' }}>
        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3" style={{ background: 'var(--lula)' }} />MUDANÇA DE VOTO</span>
        <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3" style={{ background: 'var(--lula)', opacity: 0.45 }} />MAIS (OU MENOS) VOTANTES</span>
        <span>AZUL = A FAVOR DE FLÁVIO</span>
      </div>
    </div>
  )
}

function Vs2022() {
  const d = X.d22, n = X.nac22
  const porte = X.grupos.porte
  return (
    <Secao id="vs2022" eyebrow="4 · Comparado a 2022" titulo="Flávio cresceu no Brasil pequeno e recuou no Brasil grande" fundo>
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="prose-p space-y-4 min-w-0">
          <p>
            No 2º turno, Flávio teve <strong>{virg(100 - d.lula_pct_2026, 1)}%</strong> dos votos válidos no Brasil, contra {virg(100 - d.lula_pct_2022, 1)}% de Jair Bolsonaro
            em 2022: {virg(d.lula_pct_2026 - d.lula_pct_2022, 1)} ponto a menos. No 1º turno, ao contrário, ele foi bem melhor que o pai:{' '}
            {virg(n['2026']['22_1t_pct'], 1)}% contra {virg(n['2022']['22_1t_pct'], 1)}%.
          </p>
          <p>
            O dado mais revelador é este: em <strong>{fmt(X.flavio_melhor_que_2022.municipios)} dos 5.570 municípios</strong>, Flávio teve uma porcentagem maior que a de
            Bolsonaro em 2022. Mesmo assim, perdeu por mais. A explicação é o tamanho das cidades.
          </p>
          <Paradoxo />
          <Conta t="POR QUE A MAIORIA DOS MUNICÍPIOS NÃO DECIDE">
            Votos são somados por pessoa, não por cidade. A mediana dos municípios mostra Lula {virg(Math.abs(d.swing_mediano_municipio), 1)} ponto pior que em 2022;
            a média pesada pelo número de votos mostra Lula {virg(d.swing_medio_ponderado, 1)} ponto melhor. As duas contas estão certas. A segunda é a que decide a eleição.
          </Conta>
        </div>
        <div className="min-w-0 grid gap-8 content-start">
          <div>
            <h3 className="text-[1.15rem] font-extrabold mb-1" style={{ fontStretch: '85%' }}>Mudança de Lula de 2022 para 2026, por tamanho da cidade</h3>
            <p className="text-[0.85rem] mb-4" style={{ color: 'var(--ink-3)' }}>Em pontos percentuais dos votos válidos do 2º turno. Abaixo de cada faixa, a parte dos votos do país.</p>
            <BarrasDivergentes dados={porte} rotulo={(x) => x.grupo.replace('até', 'Até').replace('mais', 'Mais')} valor={(x) => x.mudanca_pp} max={4.6}
              sub={(x) => `${virg((100 * x.votos_validos_2026) / d.validos_2026, 0)}% DOS VOTOS · ${fmt(x.municipios)} MUNICÍPIOS`} />
          </div>
          <div>
            <h3 className="text-[1.15rem] font-extrabold mb-1" style={{ fontStretch: '85%' }}>De onde veio o aumento da vantagem de Lula</h3>
            <p className="text-[0.85rem] mb-4" style={{ color: 'var(--ink-3)' }}>
              Por região. A vantagem passou de {mi(d.vantagem_lula_2022)} em 2022 para {mi(d.vantagem_lula_2026)} em 2026 (só no Brasil, sem o exterior).
              Separamos o que veio de gente mudando o voto e o que veio de ter mais ou menos gente votando.
            </p>
            <Decomposicao />
          </div>
        </div>
      </div>
      <motion.div {...ver} className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          ['Sudeste', 'A mudança de voto. Lula subiu 1,5 ponto; quase todo o aumento da vantagem (1,4 milhão) veio de pessoas que votaram diferente de 2022, concentradas nas cidades grandes.'],
          ['Nordeste', 'A participação. A porcentagem de Lula ficou igual (69,4%), mas foi mais gente votar. Só esse aumento acrescentou 1,1 milhão à vantagem dele.'],
          ['Sul e Centro-Oeste', 'Onde Flávio ampliou a vantagem. No Sul, foi 0,7 ponto melhor que o pai e ganhou 390 mil votos de vantagem. No Centro-Oeste, a porcentagem quase não mudou; a vantagem dele cresceu 60 mil votos porque mais gente votou.'],
        ].map(([t, x]) => (
          <div key={t} className="p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
            <h3 className="text-[1.1rem] font-extrabold" style={{ fontStretch: '85%' }}>{t}</h3>
            <p className="text-[0.9rem] mt-1.5" style={{ color: 'var(--ink-2)' }}>{x}</p>
          </div>
        ))}
      </motion.div>
    </Secao>
  )
}

/* ---------------- dispersão ---------------- */
const REG_NOME: Record<string, string> = { N: 'Norte', NE: 'Nordeste', CO: 'Centro-Oeste', SE: 'Sudeste', S: 'Sul' }

function Dispersao() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [reg, setReg] = useState<string | null>(null)
  const [hover, setHover] = useState<any[] | null>(null)
  const P = X.pontos as any[]
  const [box, larg] = useLargura<HTMLDivElement>(760)
  const W = Math.max(300, larg), H = W < 520 ? 330 : 440, ml = 34, mr = 10, mt = 12, mb = 30
  const lx = (p: number) => ml + ((Math.log10(p) - 2.8) / (7.2 - 2.8)) * (W - ml - mr)
  const ly = (s: number) => mt + ((12 - Math.max(-20, Math.min(12, s))) / 32) * (H - mt - mb)
  const maxV = Math.max(...P.map((p) => p[7]))
  const rr = (v: number) => (W < 520 ? 0.7 : 0.9) + (W < 520 ? 6 : 9) * Math.sqrt(v / maxV)
  // média pesada por faixa de tamanho (a "tendência")
  const linha = useMemo(() => {
    const out: [number, number][] = []
    for (let a = 2.9; a < 7.2; a += 0.25) {
      let sw = 0, s = 0
      for (const p of P) { const l = Math.log10(p[4]); if (l >= a && l < a + 0.25 && (!reg || p[3] === reg)) { sw += p[7]; s += p[7] * p[5] } }
      if (sw > 0) out.push([a + 0.125, s / sw])
    }
    return out
  }, [P, reg])
  const ordem = useMemo(() => [...P].sort((a, b) => b[7] - a[7]), [P])
  return (
    <Secao id="dispersao" eyebrow="5 · Cada ponto é um município" titulo="Quanto maior a cidade, mais Lula cresceu desde 2022">
      <p className="prose-p mt-4">
        Na horizontal, a população (cada marca é 10 vezes a anterior). Na vertical, quanto Lula mudou em relação a 2022, em pontos.
        O tamanho do ponto é o número de votos. A linha preta é a média de cada faixa de tamanho, pesada pelos votos: é a tendência.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Destacar região">
        <button className="btn !py-1.5 !px-2.5 !text-[0.66rem]" aria-pressed={!reg} onClick={() => setReg(null)}>Todas</button>
        {Object.entries(REG_NOME).map(([k, v]) => <button key={k} className="btn !py-1.5 !px-2.5 !text-[0.66rem]" aria-pressed={reg === k} onClick={() => setReg(k)}>{v}</button>)}
      </div>
      <div ref={ref} className="relative mt-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} onMouseLeave={() => setHover(null)}>
        <div ref={box}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Gráfico de dispersão: população do município e mudança de Lula de 2022 para 2026">
          {[-20, -10, 0, 10].map((s) => (
            <g key={s}>
              <line x1={ml} x2={W - mr} y1={ly(s)} y2={ly(s)} stroke="var(--rule)" strokeWidth={s === 0 ? 1.5 : 1} strokeDasharray={s === 0 ? '' : '3 4'} />
              <text x={ml - 6} y={ly(s)} textAnchor="end" dominantBaseline="middle" className="mono" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{s > 0 ? '+' : ''}{s}</text>
            </g>
          ))}
          {[1e3, 1e4, 1e5, 1e6, 1e7].map((p) => (
            <text key={p} x={lx(p)} y={H - 12} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{p >= 1e6 ? `${p / 1e6} mi` : `${p / 1e3} mil`}</text>
          ))}
          <text x={W - mr} y={ly(10.5)} textAnchor="end" className="mono" style={{ fontSize: 10, fill: 'var(--lula)' }}>LULA MELHOR QUE EM 2022 ↑</text>
          <text x={W - mr} y={ly(-18.5)} textAnchor="end" className="mono" style={{ fontSize: 10, fill: 'var(--flavio)' }}>FLÁVIO MELHOR QUE BOLSONARO ↓</text>
          <g>
            {ordem.map((p) => {
              const on = !reg || p[3] === reg
              return <circle key={p[0]} cx={lx(p[4])} cy={ly(p[5])} r={rr(p[7])} fill={p[5] >= 0 ? 'var(--lula)' : 'var(--flavio)'}
                fillOpacity={on ? 0.42 : 0.05} stroke={on && p[7] > 300000 ? 'var(--ink)' : 'none'} strokeWidth={0.6}
                onMouseEnter={() => setHover(p)} />
            })}
          </g>
          <motion.polyline points={linha.map(([a, s]) => `${lx(10 ** a)},${ly(s)}`).join(' ')} fill="none" stroke="var(--ink)" strokeWidth={3} strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: play ? 1 : 0 }} transition={{ duration: 1.4, delay: 0.3 }} />
        </svg>
        </div>
        {hover && (
          <div className="pointer-events-none absolute right-2 top-2 px-3 py-2 text-[0.82rem]" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
            <b style={{ fontFamily: 'var(--font-display)' }}>{hover[1]}</b> <span style={{ color: 'var(--ink-3)' }}>· {hover[2]}</span>
            <div className="mono text-[0.66rem]" style={{ color: 'var(--ink-2)' }}>{fmt(hover[4])} HABITANTES · LULA {virg(hover[6], 1)}% · {sinal(hover[5])} PONTO DESDE 2022</div>
          </div>
        )}
      </div>
      <p className="text-[0.88rem] mt-3 max-w-[70ch]" style={{ color: 'var(--ink-3)' }}>
        A maior parte dos pontos fica abaixo do zero, e a maior parte dos votos fica acima. Os grandes círculos à direita (São Paulo, Rio, Belo Horizonte,
        Salvador, Fortaleza…) puxam a média para cima. Os pontos mais baixos, com quedas de 12 a 16 pontos para Lula, são quase todos municípios pequenos, a maioria no Rio Grande do Sul.
      </p>
    </Secao>
  )
}

/* ---------------- perfil + regressão ---------------- */
const PERFIS: [string, string, (q: any) => string][] = [
  ['renda_pc', 'Renda por pessoa', (q) => `R$ ${fmt(q.de)} a ${fmt(q.ate)}`],
  ['pct_outras_fontes', 'Renda que não vem do trabalho', (q) => `${virg(q.de, 0)}% a ${virg(q.ate, 0)}%`],
  ['pct_evangelicos', 'Evangélicos', (q) => `${virg(q.de, 0)}% a ${virg(q.ate, 0)}%`],
  ['densidade', 'Habitantes por km²', (q) => `${fmt(q.de)} a ${fmt(q.ate)}`],
]

function Perfil() {
  const R = X.regressao.coeficientes
  const sd = X.sd
  const fatores: [string, string, string][] = [
    ['log_pop', 'Tamanho da cidade', `cidade ${virg(Math.exp(sd.log_pop), 0)} vezes maior`],
    ['pct_outras_fontes', 'Renda de fora do trabalho', `${virg(sd.pct_outras_fontes, 0)} pontos a mais`],
    ['pct_evangelicos', 'Evangélicos', `${virg(sd.pct_evangelicos, 0)} pontos a mais`],
    ['renda_pc', 'Renda por pessoa', `R$ ${fmt(sd.renda_pc)} a mais por mês`],
    ['lula_2022', 'Voto em Lula em 2022', 'onde ele já era mais forte'],
    ['regiao_Nordeste', 'Estar no Nordeste', 'comparado ao Sudeste'],
    ['regiao_Sul', 'Estar no Sul', 'comparado ao Sudeste'],
    ['regiao_Centro-Oeste', 'Estar no Centro-Oeste', 'comparado ao Sudeste'],
  ]
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const max = 3
  return (
    <Secao id="perfil" eyebrow="6 · O perfil dos municípios" titulo="Renda sozinha não explica; tamanho da cidade explica mais" fundo>
      <p className="prose-p mt-4">
        Dividimos o eleitorado em cinco partes iguais segundo cada característica do município (dados do Censo 2022 do IBGE) e medimos quanto Lula mudou
        desde 2022 em cada parte. Barras para cima: Lula melhorou; para baixo: Flávio foi melhor que Bolsonaro.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PERFIS.map(([k, nome, faixa]) => {
          const qs = X.perfil[k].quintos
          return (
            <motion.div key={k} {...ver} className="p-4" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
              <h3 className="text-[1.02rem] font-extrabold" style={{ fontStretch: '85%' }}>{nome}</h3>
              <div className="mt-3 grid grid-cols-5 gap-1.5 items-center h-[120px] relative">
                <span className="absolute left-0 right-0 top-1/2 h-px" style={{ background: 'var(--ink-3)' }} />
                {qs.map((q: any, i: number) => {
                  const h = Math.min(1, Math.abs(q.mudanca_pp) / 3) * 50
                  return (
                    <div key={i} className="relative h-full" title={`${faixa(q)}: ${sinal(q.mudanca_pp)} ponto`}>
                      <motion.span initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.06 }}
                        className="absolute left-0 right-0" style={{ [q.mudanca_pp >= 0 ? 'bottom' : 'top']: '50%', background: q.mudanca_pp >= 0 ? 'var(--lula)' : 'var(--flavio)', borderRadius: 2 } as React.CSSProperties} />
                      <span className="absolute left-0 right-0 text-center mono text-[0.58rem] font-semibold" style={q.mudanca_pp >= 0 ? { bottom: `calc(50% + ${h}% + 2px)` } : { top: `calc(50% + ${h}% + 2px)` }}>{sinal(q.mudanca_pp)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-5 gap-1.5 mono text-[0.52rem] text-center mt-1" style={{ color: 'var(--ink-3)' }}>
                {['MENOR', '', '', '', 'MAIOR'].map((t, i) => <span key={i}>{t}</span>)}
              </div>
              <p className="mono text-[0.56rem] mt-2" style={{ color: 'var(--ink-3)' }}>MENOR: {faixa(qs[0]).toUpperCase()} · MAIOR: {faixa(qs[4]).toUpperCase()}</p>
            </motion.div>
          )
        })}
      </div>
      <div className="mt-6 prose-p">
        <p>
          À primeira vista, Lula cresceu mais nos lugares mais ricos e com mais evangélicos, e caiu nos mais pobres. Mas essas características andam juntas:
          as cidades grandes costumam ser mais ricas, ter mais evangélicos e votar menos em Lula em 2022. Para separar uma coisa da outra, é preciso olhar tudo junto.
        </p>
      </div>

      <div ref={ref} className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] items-start">
        <div className="min-w-0 p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <h3 className="text-[1.15rem] font-extrabold" style={{ fontStretch: '85%' }}>Olhando tudo junto</h3>
          <p className="text-[0.85rem] mb-4" style={{ color: 'var(--ink-3)' }}>
            Quanto cada fator mudou o resultado de Lula desde 2022, em pontos, com os outros fatores iguais. O traço fino é a margem de incerteza.
          </p>
          <div className="grid gap-2.5">
            {fatores.map(([k, nome, unid], i) => {
              const c = R[k], v = c.efeito_pp, e = 1.96 * c.erro_padrao
              const pos = (x: number) => 50 + (50 * Math.max(-max, Math.min(max, x))) / max
              return (
                <div key={k} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3rem] sm:grid-cols-[12rem_minmax(0,1fr)_3rem] gap-3 items-center">
                  <span className="text-[0.86rem] leading-tight">{nome}<span className="block mono text-[0.56rem]" style={{ color: 'var(--ink-3)' }}>{unid.toUpperCase()}</span></span>
                  <div className="relative h-6">
                    <span className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--ink-3)' }} />
                    <motion.span initial={{ width: 0 }} animate={{ width: play ? `${Math.abs(pos(v) - 50)}%` : 0 }} transition={{ duration: 0.7, delay: i * 0.07 }}
                      className="absolute top-1.5 bottom-1.5" style={{ [v >= 0 ? 'left' : 'right']: '50%', background: v >= 0 ? 'var(--lula)' : 'var(--flavio)', borderRadius: 2, opacity: Math.abs(v) < e ? 0.35 : 1 } as React.CSSProperties} />
                    <span className="absolute top-1/2 h-px" style={{ left: `${pos(v - e)}%`, width: `${pos(v + e) - pos(v - e)}%`, background: 'var(--ink)' }} />
                  </div>
                  <span className="mono text-[0.68rem] font-semibold text-right">{sinal(v, 1)}</span>
                </div>
              )
            })}
          </div>
          <p className="mono text-[0.58rem] mt-3" style={{ color: 'var(--ink-3)' }}>
            REGRESSÃO LINEAR PESADA PELOS VOTOS · {fmt(X.regressao.municipios)} MUNICÍPIOS · EXPLICA {virg(100 * X.regressao.r2, 0)}% DA VARIAÇÃO · INCERTEZA DE 95%, CONSIDERANDO QUE MUNICÍPIOS DO MESMO ESTADO SE PARECEM
          </p>
        </div>
        <div className="prose-p space-y-4 min-w-0">
          <p>
            Uma <strong>regressão</strong> faz exatamente isso: compara municípios que são parecidos em tudo, menos em uma característica, e mede o efeito dela.
          </p>
          <ul className="space-y-2 list-disc pl-5">
            <li><strong>Tamanho da cidade é o fator mais forte.</strong> Entre duas cidades iguais no resto, a que tem {virg(Math.exp(sd.log_pop), 0)} vezes mais habitantes deu cerca de {virg(R.log_pop.efeito_pp, 1)} pontos a mais para Lula, em relação a 2022.</li>
            <li><strong>Renda, sozinha, não muda nada</strong> (efeito zero). O que parecia efeito da renda era efeito do tamanho.</li>
            <li><strong>Evangélicos:</strong> com o resto igual, onde há mais evangélicos Flávio foi um pouco pior que o pai ({sinal(R.pct_evangelicos.efeito_pp)} ponto para Lula). É um efeito pequeno e não quer dizer que evangélicos votaram em Lula: Flávio continua bem à frente nesses lugares.</li>
            <li><strong>Renda de fora do trabalho:</strong> onde uma parte maior da renda vem de aposentadorias, pensões e programas sociais, Lula foi um pouco melhor que em 2022 ({sinal(R.pct_outras_fontes.efeito_pp)} ponto), com o resto igual.</li>
            <li><strong>Volta à média:</strong> onde Lula foi muito forte em 2022, ele caiu um pouco; onde foi fraco, subiu. É comum em qualquer eleição repetida.</li>
            <li><strong>Região:</strong> com tudo isso igual, o Sul e o Centro-Oeste ainda foram cerca de 1 ponto melhores para Flávio, e o Nordeste 1 ponto melhor para Lula.</li>
          </ul>
        </div>
      </div>
    </Secao>
  )
}

/* ---------------- leitura ---------------- */
function Leitura() {
  return (
    <Secao id="leitura" eyebrow="7 · Leitura" titulo="O que os números dizem e o que não dizem">
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <motion.div {...ver} className="p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <h3 className="text-[1.2rem] font-extrabold" style={{ fontStretch: '85%' }}>Dizem</h3>
          <ul className="mt-3 space-y-3 text-[0.95rem]" style={{ color: 'var(--ink-2)' }}>
            <li><b style={{ color: 'var(--ink)' }}>A eleição se decidiu na participação.</b> O 2º turno teve 2,96 milhões de votantes a mais e 1,8 milhão de votos nulos e brancos a menos, e esse grupo foi em grande maioria para Lula.</li>
            <li><b style={{ color: 'var(--ink)' }}>A vantagem de Flávio no 1º turno não se sustentou.</b> Ela veio de um 1º turno com menos gente votando e com 9,3 milhões de votos em outros candidatos, que não seguiram para ele na proporção que as pesquisas indicavam.</li>
            <li><b style={{ color: 'var(--ink)' }}>Flávio manteve e ampliou a base do pai no interior e no Sul,</b> mas perdeu terreno nas cidades grandes do Sudeste, onde está a maior parte dos votos.</li>
            <li><b style={{ color: 'var(--ink)' }}>O padrão é espalhado e gradual,</b> sem saltos isolados: o mesmo que a página do teste mostrou com outros métodos.</li>
          </ul>
        </motion.div>
        <motion.div {...ver} className="p-6" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
          <h3 className="text-[1.2rem] font-extrabold" style={{ fontStretch: '85%' }}>Não dizem</h3>
          <ul className="mt-3 space-y-3 text-[0.95rem]" style={{ color: 'var(--ink-2)' }}>
            <li><b style={{ color: 'var(--ink)' }}>Em quem cada pessoa votou.</b> As transferências são estimativas a partir das urnas, não respostas de eleitores. Os números exatos têm margem; a direção é sólida.</li>
            <li><b style={{ color: 'var(--ink)' }}>Por que as pessoas mudaram.</b> Campanha, economia, alianças e o debate entram na explicação, mas não estão nos arquivos do TSE. Para isso, o caminho são pesquisas de opinião bem feitas.</li>
            <li><b style={{ color: 'var(--ink)' }}>Que evangélicos ou mais pobres votaram de um jeito.</b> Os dados são por município. Uma cidade com mais evangélicos não diz como cada evangélico votou.</li>
            <li><b style={{ color: 'var(--ink)' }}>O que acontecerá na próxima eleição.</b> Tendência não é previsão.</li>
          </ul>
        </motion.div>
      </div>
    </Secao>
  )
}

function Metodo() {
  return (
    <section className="wrap py-14 md:py-16" aria-labelledby="dm">
      <h2 id="dm" className="display text-[1.8rem] uppercase">Como fizemos</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2 text-[0.92rem]" style={{ color: 'var(--ink-2)' }}>
        <ul className="space-y-2 list-disc pl-5">
          <li><b>Votos:</b> arquivos do TSE por seção (2026, 1º e 2º turnos) e por município (2022 e 2026). Exterior fica de fora das comparações com 2022.</li>
          <li><b>Transferências:</b> regressão por urna com limites (taxas entre 0% e 100%, cada grupo somando 100%), pesada pelo eleitorado, em 443 mil urnas com o mesmo número de eleitores nos dois turnos. Incerteza por 200 reamostragens de municípios. Checagem refazendo tudo estado por estado.</li>
          <li><b>Comparação com 2022:</b> a mudança da vantagem de cada município foi separada em "mudança de voto" (mesmo número de votantes de 2022, votando como em 2026) e "mudança no número de votantes".</li>
        </ul>
        <ul className="space-y-2 list-disc pl-5">
          <li><b>Perfil:</b> Censo 2022 do IBGE (população, densidade, rendimento domiciliar por pessoa, parte do rendimento que não vem do trabalho, religião).</li>
          <li><b>Regressão:</b> mudança de Lula de 2022 para 2026 explicada por tamanho (em escala logarítmica), renda, renda de fora do trabalho, evangélicos, voto de 2022 e região, pesada pelos votos, com erro padrão agrupado por estado.</li>
          <li><b>Pesquisas citadas:</b> <a className="underline" href={X.pesquisas.datafolha_terceiros.link} target="_blank" rel="noreferrer">Datafolha, 6 a 8/10</a> e{' '}
            <a className="underline" href={X.pesquisas.quaest.link} target="_blank" rel="noreferrer">Quaest, 10 a 13/10</a>.</li>
          <li>Programas: <code>analise_decisao.py</code> e <code>baixar_ibge.py</code>, no <a className="underline" href="https://github.com/talissonsousa10-ship-it/eleicao-2026" target="_blank" rel="noreferrer">repositório do projeto no GitHub</a>. Análise de Talisson Sousa de Santana, Analista de Dados Estatísticos.</li>
        </ul>
      </div>
    </section>
  )
}

export default function Decisao() {
  return (
    <>
      <Abertura />
      <Fluxo />
      <Terceiros />
      <Simulador />
      <Vs2022 />
      <Dispersao />
      <Perfil />
      <Leitura />
      <Metodo />
    </>
  )
}
