import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { D, fmt, fmtMi, useLargura, usePlayOnView } from '@/lib/util'
import ZT5 from '../data/zonas_t5.json'

const virg = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const sinal = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${virg(Math.abs(n), d)}`
const HACHURA = 'repeating-linear-gradient(135deg, var(--warn) 0 2px, transparent 2px 6px)'
const ease = [0.2, 0.7, 0.2, 1] as const

/* ---------- moldura comum ---------- */
function Card({ n, pergunta, fraude, vimos, leitura, children }: { n: string; pergunta: string; fraude: string; vimos: ReactNode; leitura: string; children: ReactNode }) {
  return (
    <article className="p-5 md:p-6 flex flex-col gap-4 min-w-0" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
      <div className="flex items-start justify-between gap-3">
        <span className="mono text-[0.72rem]" style={{ color: 'var(--ink-3)' }}>TESTE {n}</span>
        <span className="chip chip-ok">✓ Passou</span>
      </div>
      <h3 className="text-[1.4rem] font-extrabold leading-tight" style={{ fontStretch: '85%' }}>{pergunta}</h3>
      <figure className="m-0">
        <figcaption className="mono text-[0.62rem] mb-2.5 leading-snug" style={{ color: 'var(--ink-3)' }}>{leitura}</figcaption>
        {children}
      </figure>
      <dl className="grid gap-3 text-[0.95rem]">
        <div><dt className="eyebrow mb-1" style={{ color: 'var(--warn)' }}>Se houvesse fraude</dt><dd style={{ color: 'var(--ink-2)' }}>{fraude}</dd></div>
        <div><dt className="eyebrow mb-1" style={{ color: 'var(--ok)' }}>O que vimos</dt><dd style={{ color: 'var(--ink-2)' }}>{vimos}</dd></div>
      </dl>
    </article>
  )
}

function Legenda({ itens }: { itens: [ReactNode, string][] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5 mono text-[0.6rem]" style={{ color: 'var(--ink-2)' }}>
      {itens.map(([m, t]) => <span key={t} className="flex items-center gap-1.5">{m}{t}</span>)}
    </div>
  )
}
const Q = ({ cor }: { cor: string }) => <i className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: cor }} />
const QH = () => <i className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: HACHURA, border: '1px solid var(--warn)' }} />
const QF = () => <i className="inline-block w-3 h-2.5" style={{ background: 'color-mix(in srgb, var(--ok) 18%, transparent)', border: '1px dashed var(--ok)' }} />

/* barra 100% com rótulos dentro */
function Barra100({ partes, play, atraso = 0 }: { partes: { v: number; cor?: string; rot: string; hachura?: boolean }[]; play: boolean; atraso?: number }) {
  return (
    <div className="flex h-8 w-full gap-[2px]">
      {partes.map((p, i) => (
        <motion.div key={i} initial={{ width: 0 }} animate={{ width: play ? `${p.v}%` : 0 }} transition={{ duration: 0.8, delay: atraso + i * 0.08, ease }}
          className="h-full flex items-center justify-center overflow-hidden rounded-[3px] mono text-[0.7rem] font-semibold whitespace-nowrap"
          style={p.hachura ? { background: HACHURA, border: '1.5px solid var(--warn)', color: 'var(--warn)' } : { background: p.cor, color: '#fff' }}>
          {p.v >= 9 ? (p.hachura ? <span className="px-1.5 py-0.5 rounded-[2px]" style={{ background: 'var(--card)' }}>{p.rot}</span> : p.rot) : ''}
        </motion.div>
      ))}
    </div>
  )
}

/* ---------- 1. eleitores a mais ---------- */
function G1() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const fx = D.frac_extra
  const l = Math.round(fx.lula * 100), f = Math.round(fx.flavio * 100)
  const l22 = Math.round(fx.l22 * 100), b22 = 100 - l22
  const linhas: [string, { v: number; cor?: string; rot: string; hachura?: boolean }[]][] = [
    ['2026', [{ v: l, cor: 'var(--lula)', rot: `LULA ${l}` }, { v: 100 - l - f, cor: 'var(--ink-3)', rot: '' }, { v: f, cor: 'var(--flavio)', rot: `FLÁVIO ${f}` }]],
    ['2022', [{ v: l22, cor: 'var(--lula)', rot: `LULA ${l22}` }, { v: b22, cor: 'var(--flavio)', rot: `BOLSONARO ${b22}` }]],
    ['FRAUDE', [{ v: 100, rot: '≈ 100 PARA UM SÓ CANDIDATO', hachura: true }]],
  ]
  return (
    <div ref={ref}>
      <div className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-x-2.5 gap-y-2 items-center">
        {linhas.map(([rot, p], i) => (
          <div key={rot} className="contents">
            <span className="mono text-[0.66rem] font-semibold" style={{ color: rot === 'FRAUDE' ? 'var(--warn)' : 'var(--ink-2)' }}>{rot}</span>
            <Barra100 partes={p} play={play} atraso={i * 0.15} />
          </div>
        ))}
      </div>
      <Legenda itens={[[<Q cor="var(--ink-3)" />, 'BRANCO OU NULO'], [<QH />, 'COMO SERIA UMA FRAUDE']]} />
    </div>
  )
}

/* ---------- 2. último dígito ---------- */
function G2() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [box, W] = useLargura<HTMLDivElement>(320)
  const f = D.ult_digito, dg = D.digitos
  const n = dg.lula2.n
  const meia = 196 * Math.sqrt(0.09 / n) // faixa de 95% do acaso, em pontos percentuais
  const H = 170, ml = 30, mr = 6, mt = 8, mb = 22
  const y = (v: number) => mt + ((13 - v) / (13 - 8.8)) * (H - mt - mb)
  const x = (d: number) => ml + ((d + 0.5) / 10) * (W - ml - mr)
  const fraude = [12.6, 9.4, 9.5, 9.4, 9.5, 12.4, 9.4, 9.5, 9.4, 9.5]
  return (
    <div ref={ref}>
      <div ref={box}>
        <svg width={W} height={H} className="block" role="img" aria-label="Frequência de cada último dígito dos votos de Lula e Flávio, comparada à faixa esperada por acaso">
          <rect x={ml} width={W - ml - mr} y={y(10 + meia)} height={y(10 - meia) - y(10 + meia)} fill="color-mix(in srgb, var(--ok) 16%, transparent)" stroke="var(--ok)" strokeDasharray="3 3" strokeWidth={1} />
          {[9, 10, 11, 12].map((v) => (
            <g key={v}>
              <line x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} stroke="var(--rule)" strokeWidth={v === 10 ? 1.2 : 0.8} />
              <text x={ml - 5} y={y(v)} textAnchor="end" dominantBaseline="middle" className="mono" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{v}%</text>
            </g>
          ))}
          <text x={W - mr - 4} y={y(10 + meia) - 4} textAnchor="end" className="mono" style={{ fontSize: 9.5, fill: 'var(--ok)' }}>FAIXA DO ACASO</text>
          {fraude.map((v, d) => v > 11 && (
            <g key={d}>
              <rect x={x(d) - 6} y={y(v)} width={12} height={y(10) - y(v)} fill="url(#hach2)" stroke="var(--warn)" strokeWidth={1.2} rx={2} opacity={0.7} />
            </g>
          ))}
          <text x={x(5) + 9} y={y(12.4) + 4} className="mono" style={{ fontSize: 9.5, fill: 'var(--warn)' }}>← SE FOSSE INVENTADO</text>
          <defs>
            <pattern id="hach2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(135)"><rect width="2" height="5" fill="var(--warn)" /></pattern>
          </defs>
          {Array.from({ length: 10 }).map((_, d) => (
            <g key={d}>
              {([['lula2', -4, 'var(--lula)'], ['flavio2', 4, 'var(--flavio)']] as const).map(([c, dx, cor], j) => (
                <motion.circle key={c} cx={x(d) + dx} r={4.2} fill={cor} stroke="var(--card)" strokeWidth={1.5}
                  initial={{ cy: y(10), opacity: 0 }} animate={play ? { cy: y(f[c][d]), opacity: 1 } : {}} transition={{ duration: 0.6, delay: d * 0.05 + j * 0.1, ease }} />
              ))}
              <text x={x(d)} y={H - 6} textAnchor="middle" className="mono" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{d}</text>
            </g>
          ))}
        </svg>
      </div>
      <Legenda itens={[[<Q cor="var(--lula)" />, 'LULA'], [<Q cor="var(--flavio)" />, 'FLÁVIO'], [<QF />, 'VARIAÇÃO NORMAL (95%)'], [<QH />, 'FRAUDE']]} />
    </div>
  )
}

/* ---------- 3. urnas que destoam das vizinhas ---------- */
function G3() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const ir = D.irmas as Record<string, any>
  const linhas = Object.entries(ir).map(([k, v]) => {
    const pl = v.destoantes_pro_lula, po = v.destoantes_pro_bolsonaro ?? v['destoantes_pro_flávio']
    return { k: k.replace(' · ', ' · '), pl, po, tot: pl + po, n: v.urnas_testadas, pct: v.pct_destoantes, efeito: v['efeito_liquido_na_margem_(2x)'] }
  })
  const max = Math.max(...linhas.map((l) => l.tot)) * 1.05
  const t2 = linhas[linhas.length - 1]
  const margem = D.nac.margem
  return (
    <div ref={ref}>
      <div className="grid gap-2.5">
        {linhas.map((l, i) => (
          <div key={l.k}>
            <div className="flex justify-between mono text-[0.62rem] mb-1" style={{ color: 'var(--ink-2)' }}>
              <span className="font-semibold">{l.k.toUpperCase()}</span><span>{fmt(l.tot)} DE {fmt(Math.round(l.n / 1000))} MIL · {virg(l.pct, 2)}%</span>
            </div>
            <div className="flex h-5 gap-[2px]">
              <motion.span initial={{ width: 0 }} animate={{ width: play ? `${(100 * l.pl) / max}%` : 0 }} transition={{ duration: 0.8, delay: i * 0.12, ease }} className="rounded-l-[3px]" style={{ background: 'var(--lula)' }} />
              <motion.span initial={{ width: 0 }} animate={{ width: play ? `${(100 * l.po) / max}%` : 0 }} transition={{ duration: 0.8, delay: i * 0.12 + 0.1, ease }} className="rounded-r-[3px]" style={{ background: 'var(--flavio)' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--rule)' }}>
        <div className="mono text-[0.62rem] mb-1.5" style={{ color: 'var(--ink-3)' }}>PESO NO RESULTADO (2026, 2º TURNO)</div>
        <div className="grid grid-cols-[minmax(0,1fr)_4.4rem] gap-x-2 gap-y-1.5 items-center mono text-[0.64rem]">
          <div className="h-3.5 rounded-[3px]" style={{ background: 'var(--ink-3)', opacity: 0.35 }} /><span className="text-right">{fmtMi(margem, 2)}</span>
          <div className="h-3.5"><motion.div initial={{ width: 0 }} animate={{ width: play ? `${Math.max(0.6, (100 * t2.efeito) / margem)}%` : 0 }} transition={{ duration: 0.6, delay: 0.5 }} className="h-full rounded-[2px]" style={{ background: 'var(--ink)' }} /></div>
          <span className="text-right">{fmt(Math.round(t2.efeito / 1000))} mil</span>
        </div>
        <div className="flex justify-between mono text-[0.58rem] mt-1" style={{ color: 'var(--ink-3)' }}><span>DIFERENÇA FINAL (CINZA) × EFEITO DE TODAS AS URNAS QUE DESTOAM (PRETO)</span></div>
      </div>
      <div className="mt-4 pt-3" style={{ borderTop: '1px dashed var(--rule)' }}>
        <div className="mono text-[0.62rem] mb-1.5" style={{ color: 'var(--ink-3)' }}>AS DE 2026 JÁ PENDIAM PARA O MESMO LADO NO 1º TURNO?</div>
        {([['lula', 'pro_lula', 'var(--lula)', 'A FAVOR DE LULA'], ['adv', 'pro_adversario', 'var(--flavio)', 'A FAVOR DE FLÁVIO']] as const).map(([k, c, cor, rot], i) => {
          const x = D.irmas_persist[c]
          return (
            <div key={k} className="mb-1.5">
              <div className="flex justify-between mono text-[0.6rem] mb-0.5" style={{ color: 'var(--ink-2)' }}><span>{rot}</span><span className="font-semibold">{x.ja_pendiam_no_1t_z_maior_que_2} DE {x.urnas} JÁ PENDIAM</span></div>
              <div className="flex h-3 gap-[2px]">
                <motion.span initial={{ width: 0 }} animate={{ width: play ? `${(100 * x.ja_pendiam_no_1t_z_maior_que_2) / x.urnas}%` : 0 }} transition={{ duration: 0.8, delay: 0.7 + i * 0.1, ease }} className="rounded-[2px]" style={{ background: cor }} />
                <span className="flex-1 rounded-[2px]" style={{ background: HACHURA, border: '1px solid var(--warn)' }} />
              </div>
            </div>
          )
        })}
        <div className="mono text-[0.58rem]" style={{ color: 'var(--ink-3)' }}>LISTRADO = URNAS QUE SÓ PASSARAM A DESTOAR NO 2º TURNO (O QUE UMA FRAUDE NO 2º TURNO CRIARIA)</div>
      </div>
      <Legenda itens={[[<Q cor="var(--lula)" />, 'DESTOAM A FAVOR DE LULA'], [<Q cor="var(--flavio)" />, 'A FAVOR DO ADVERSÁRIO']]} />
    </div>
  )
}

/* ---------- 4. modelos de urna ---------- */
function G4() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [box, W] = useLargura<HTMLDivElement>(320)
  const md = (D.modelo as any[]).filter((m) => m.CD_MODELO_URNA > 0)
  const nac = D.nac.p_l2
  const lin = md.map((m) => ({ ano: m.CD_MODELO_URNA, urnas: m.urnas, bruto: m.lula_bruto_pct - nac, escola: m.dif_vs_vizinhas_mesmo_local_pp }))
  const rowH = 34, mt = 22, H = mt + rowH * lin.length + 22, ml = 70, mr = 14
  const x = (v: number) => ml + ((v + 2.2) / 4.4) * (W - ml - mr)
  return (
    <div ref={ref}>
      <div ref={box}>
        <svg width={W} height={H} className="block" role="img" aria-label="Diferença do voto em Lula por modelo de urna: no país todo e comparado às urnas novas da mesma escola">
          <rect x={x(-0.15)} y={mt - 6} width={x(0.15) - x(-0.15)} height={rowH * lin.length + 6} fill="color-mix(in srgb, var(--ok) 16%, transparent)" />
          <line x1={x(0)} x2={x(0)} y1={mt - 6} y2={mt + rowH * lin.length} stroke="var(--ok)" strokeWidth={1.2} strokeDasharray="3 3" />
          {[-2, -1, 0, 1, 2].map((v) => (
            <text key={v} x={x(v)} y={H - 6} textAnchor="middle" className="mono" style={{ fontSize: 10, fill: 'var(--ink-3)' }}>{v > 0 ? `+${v}` : v === 0 ? '0' : `−${-v}`}</text>
          ))}
          <text x={x(-2.2)} y={11} className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-3)' }}>← MAIS FLÁVIO</text>
          <text x={x(2.2)} y={11} textAnchor="end" className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-3)' }}>MAIS LULA →</text>
          {lin.map((l, i) => {
            const cy = mt + rowH * i + rowH / 2
            return (
              <g key={l.ano}>
                <text x={0} y={cy - 4} className="mono" style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--ink)' }}>URNA {l.ano}</text>
                <text x={0} y={cy + 9} className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-3)' }}>{fmt(Math.round(l.urnas / 1000))} mil</text>
                <motion.line x1={x(l.bruto)} y1={cy} y2={cy} stroke="var(--ink-3)" strokeWidth={1.5}
                  initial={{ x2: x(l.bruto) }} animate={play ? { x2: x(l.escola) } : {}} transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease }} />
                <circle cx={x(l.bruto)} cy={cy} r={5.5} fill="var(--card)" stroke="var(--ink-2)" strokeWidth={1.8} />
                <text x={x(l.bruto)} y={cy - 9} textAnchor="middle" className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{sinal(l.bruto)}</text>
                <motion.circle cy={cy} r={5.5} fill="var(--ok)" initial={{ cx: x(l.bruto), opacity: 0 }} animate={play ? { cx: x(l.escola), opacity: 1 } : {}} transition={{ duration: 0.9, delay: 0.3 + i * 0.12, ease }} />
              </g>
            )
          })}
        </svg>
      </div>
      <Legenda itens={[[<i className="inline-block w-2.5 h-2.5 rounded-full" style={{ border: '1.8px solid var(--ink-2)' }} />, 'NO PAÍS TODO'], [<i className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ok)' }} />, 'NA MESMA ESCOLA'], [<QF />, 'MENOS DE 0,15 PONTO']]} />
    </div>
  )
}

/* ---------- 5. previsto × real ---------- */
function G5() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const [box, W] = useLargura<HTMLDivElement>(320)
  const out = D.zona.out
  const P = ZT5 as [number, number, number, number][]
  const H = Math.min(W, 300), ml = 28, mb = 24, mt = 6, mr = 6
  const sx = (v: number) => ml + (v / 80) * (W - ml - mr)
  const sy = (v: number) => mt + ((80 - v) / 80) * (H - mt - mb)
  const comuns = P.filter((p) => p[3] === 0), fora = P.filter((p) => p[3] !== 0)
  return (
    <div ref={ref}>
      <div ref={box}>
        <svg width={W} height={H} className="block" role="img" aria-label="Voto em Lula no 2º turno previsto a partir do 1º turno e voto real, por zona eleitoral">
          {[0, 20, 40, 60, 80].map((v) => (
            <g key={v}>
              <text x={ml - 4} y={sy(v)} textAnchor="end" dominantBaseline="middle" className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-3)' }}>{v}</text>
              <text x={sx(v)} y={H - 8} textAnchor="middle" className="mono" style={{ fontSize: 9.5, fill: 'var(--ink-3)' }}>{v}</text>
            </g>
          ))}
          <line x1={sx(0)} y1={sy(0)} x2={sx(80)} y2={sy(80)} stroke="var(--ok)" strokeWidth={1.4} strokeDasharray="4 3" />
          <text x={sx(46)} y={sy(32)} className="mono" style={{ fontSize: 9.5, fill: 'var(--ok)' }}>← DIAGONAL: PREVISÃO EXATA</text>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: play ? 1 : 0 }} transition={{ duration: 0.8 }}>
            {comuns.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={1.4} fill="var(--ink-3)" fillOpacity={0.35} />)}
          </motion.g>
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: play ? 1 : 0 }} transition={{ duration: 0.6, delay: 0.7 }}>
            {fora.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={4} fill={p[3] > 0 ? 'var(--lula)' : 'var(--flavio)'} stroke="var(--card)" strokeWidth={1.2} />)}
          </motion.g>
          <text x={sx(4)} y={sy(73)} className="mono" style={{ fontSize: 10, fill: 'var(--lula)', fontWeight: 700 }}>{out.a_favor_de_lula} ZONAS ACIMA</text>
          <text x={sx(76)} y={sy(8)} textAnchor="end" className="mono" style={{ fontSize: 10, fill: 'var(--flavio)', fontWeight: 700 }}>{out.a_favor_do_22 ?? out.a_favor_de_flavio} ZONAS ABAIXO</text>
        </svg>
      </div>
      <div className="flex justify-between mono text-[0.58rem]" style={{ color: 'var(--ink-3)' }}><span>↑ LULA REAL (% DOS ELEITORES)</span><span>PREVISTO PELO 1º TURNO →</span></div>
      <Legenda itens={[[<Q cor="var(--ink-3)" />, `${fmt(P.length - out.zonas)} ZONAS NO PADRÃO`], [<Q cor="var(--lula)" />, 'FOGEM A FAVOR DE LULA'], [<Q cor="var(--flavio)" />, 'A FAVOR DE FLÁVIO']]} />
    </div>
  )
}

/* ---------- 6. tamanho da fraude ---------- */
function G6() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const total = D.zonas as number, alvo = 267
  const precisa = Math.ceil(D.nac.margem / 2)
  const validos = D.nac.l2 + D.nac.f2
  return (
    <div ref={ref}>
      <div className="grid gap-[1.5px]" style={{ gridTemplateColumns: 'repeat(80, minmax(0,1fr))' }} aria-label={`${alvo} de ${total} zonas destacadas`} role="img">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className="aspect-square" style={{ background: i < alvo ? 'var(--warn)' : 'var(--rule)', opacity: play || i >= alvo ? 1 : 0.2, transition: `opacity .4s ${i * 2}ms` }} />
        ))}
      </div>
      <Legenda itens={[[<Q cor="var(--warn)" />, `${alvo} ZONAS INTEIRAS`], [<Q cor="var(--rule)" />, `AS OUTRAS ${fmt(total - alvo)}`]]} />
      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed var(--rule)' }}>
        <div className="flex justify-between mono text-[0.62rem] mb-1" style={{ color: 'var(--ink-2)' }}>
          <span>VOTOS A TROCAR DE LADO</span><span className="font-semibold">{fmtMi(precisa, 1)} DE {fmtMi(validos, 0)} ({virg((100 * precisa) / validos, 1)}%)</span>
        </div>
        <div className="h-3.5 rounded-[3px] overflow-hidden" style={{ background: 'var(--rule)' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: play ? `${(100 * precisa) / validos}%` : 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="h-full" style={{ background: 'var(--warn)' }} />
        </div>
      </div>
    </div>
  )
}

export default function Testes() {
  const fx = D.frac_extra
  const out = D.zona.out
  const dg = D.digitos
  return (
    <section className="py-16 md:py-24" style={{ background: 'var(--paper-2)' }} aria-labelledby="testes">
      <div className="wrap">
        <p className="eyebrow mb-3">Os testes · cada um podia ter dado errado</p>
        <h2 id="testes" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase max-w-[18ch]">Seis perguntas que uma fraude não passaria</h2>
        <p className="prose-p mt-5">
          Um teste só serve como prova se pudesse mostrar o contrário. Por isso, cada pergunta abaixo descreve primeiro a marca que a
          fraude deixaria nos números. Depois mostra o que os dados oficiais revelam. Todos os testes usam só os arquivos públicos do TSE.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 p-3 mono text-[0.66rem]" style={{ background: 'var(--card)', border: '1px solid var(--rule)', color: 'var(--ink-2)' }}>
          <span className="font-semibold" style={{ color: 'var(--ink)' }}>COMO LER OS GRÁFICOS:</span>
          <span className="flex items-center gap-1.5"><QF />ÁREA VERDE = O QUE É NORMAL</span>
          <span className="flex items-center gap-1.5"><QH />LARANJA LISTRADO = COMO SERIA UMA FRAUDE</span>
          <span className="flex items-center gap-1.5"><Q cor="var(--lula)" /><Q cor="var(--flavio)" />VERMELHO E AZUL = O QUE ACONTECEU</span>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Card n="1" pergunta="Os eleitores a mais do 2º turno foram todos para Lula?" leitura="DE CADA 100 PESSOAS A MAIS QUE FORAM VOTAR NO 2º TURNO, QUANTAS ESCOLHERAM CADA UM"
            fraude="Votos inventados para um candidato apareceriam como 'eleitores novos' que votam quase 100% nele."
            vimos={<>De cada 100 pessoas a mais que foram votar, cerca de <b>{Math.round(fx.lula * 100)} escolheram Lula e {Math.round(fx.flavio * 100)} Flávio</b>. Em 2022, a divisão foi {Math.round(fx.l22 * 100)} para Lula e {Math.round(fx.b22 * 100)} para Bolsonaro.</>}>
            <G1 />
          </Card>

          <Card n="2" pergunta="Os números parecem inventados?" leitura={`QUANTAS VEZES CADA ÚLTIMO DÍGITO (0 A 9) APARECE NOS VOTOS DAS ${fmt(D.zonas)} ZONAS, 2º TURNO`}
            fraude="Quem inventa números tende a repetir finais como 0 e 5. Em contagens reais, cada final de 0 a 9 aparece cerca de 10% das vezes."
            vimos={<>Nas {fmt(D.zonas)} zonas eleitorais, os finais dos votos de Lula e de Flávio ficam todos dentro da variação normal (teste qui-quadrado: p = {virg(dg.lula2.p, 2)} para Lula e {virg(dg.flavio2.p, 2)} para Flávio; abaixo de 0,05 seria sinal de alerta).</>}>
            <G2 />
          </Card>

          <Card n="3" pergunta="Alguma urna destoa das vizinhas?" leitura="URNAS MUITO DIFERENTES DAS OUTRAS DA MESMA ESCOLA, E PARA QUEM ELAS PENDEM"
            fraude="Urnas da mesma escola recebem eleitores parecidos. Uma urna adulterada daria um resultado muito diferente das outras do mesmo prédio."
            vimos={<>Só cerca de 1 em cada 800 urnas destoa das vizinhas, a mesma proporção de 2022 e do 1º turno. Elas pendem mais para Lula nas três eleições, também em 2022, mas todas juntas mexem em ~22 mil votos, 0,5% da diferença final. E não surgiram no 2º turno: <b>{D.irmas_persist.pro_lula.ja_pendiam_no_1t_z_maior_que_2} das {D.irmas_persist.pro_lula.urnas}</b> que pendem para Lula já pendiam para ele no 1º turno, quando Flávio venceu. São seções com eleitores diferentes das vizinhas, não urnas que mudaram de comportamento.</>}>
            <G3 />
          </Card>

          <Card n="4" pergunta="As urnas antigas votaram diferente?" leitura="DIFERENÇA NO VOTO EM LULA, EM PONTOS, DE CADA MODELO DE URNA: NO PAÍS TODO (○) E NA MESMA ESCOLA (●)"
            fraude="Se um modelo de urna estivesse adulterado, ele daria mais votos a um candidato do que as urnas novas do mesmo lugar."
            vimos={<>No total, as urnas de 2013 dão um pouco mais a Lula, porque estão mais em regiões onde ele já é forte. Comparadas às urnas novas <b>da mesma escola</b>, a diferença cai para quase zero (0,06 ponto).</>}>
            <G4 />
          </Card>

          <Card n="5" pergunta="Dava para prever o 2º turno olhando o 1º?" leitura={`CADA PONTO É UMA ZONA: O VOTO EM LULA PREVISTO PELO 1º TURNO E O REAL. QUANTO MAIS PERTO DA DIAGONAL, MELHOR A PREVISÃO`}
            fraude="Votos alterados fariam alguns lugares fugirem da previsão, quase sempre a favor de quem ganhou."
            vimos={<>A previsão explica <b>99%</b> das diferenças entre as zonas. Só {out.zonas} zonas fogem do padrão: {out.a_favor_de_lula} a favor de Lula e {out.a_favor_do_22 ?? out.a_favor_de_flavio} a favor de Flávio. Tirando todas, Lula continua vencendo por 4,4 milhões.</>}>
            <G5 />
          </Card>

          <Card n="6" pergunta="De que tamanho teria que ser a fraude?" leitura={`CADA QUADRADO É UMA DAS ${fmt(D.zonas)} ZONAS ELEITORAIS DO PAÍS`}
            fraude="Para inverter o resultado, seria preciso trocar 2,2 milhões de votos de lado sem deixar rastro em nenhum dos testes acima."
            vimos={<>Isso equivale a virar <b>todos os votos de 267 zonas</b> inteiras (em laranja, entre as {fmt(D.zonas)} do país). Concentrada em alguns lugares, uma mudança desse tamanho apareceria nos testes acima. Espalhada igualmente por todas as urnas, ela não deixaria essas marcas: teria de estar no programa de todas as urnas, e é isso que a auditoria do TSE confere no dia da eleição, sorteando urnas para votação paralela.</>}>
            <G6 />
          </Card>
        </div>

        <div className="mt-6 p-5 md:p-6 flex flex-wrap items-center gap-x-8 gap-y-3" style={{ border: '1.5px dashed var(--ok)' }}>
          <span className="chip chip-ok">✓ Conferido</span>
          <p className="flex-1 min-w-[16rem] text-[0.98rem]" style={{ color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>Integridade básica:</b> em {fmt(D.urnas_turno)} registros de urna no Brasil, nenhuma tem mais votos do que eleitores presentes,
            nenhuma tem mais presentes do que eleitores aptos, e a soma das urnas bate exatamente com o total oficial em todas as zonas.
          </p>
        </div>
      </div>
    </section>
  )
}
