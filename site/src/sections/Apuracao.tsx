import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { D, fmtPct } from '@/lib/util'

type Pt = { p: number; h: string; l: number; f: number; r: Record<string, number> }
const PTS: Pt[] = D.curvas.t2
const REG = ['Nordeste', 'Norte', 'Sudeste', 'Centro-Oeste', 'Sul'] as const
const COR_REG: Record<string, string> = { Nordeste: '#d0623f', Norte: '#2a9d8f', Sudeste: 'var(--ink-2)', 'Centro-Oeste': '#c19a2e', Sul: '#8d6cab' }
const VIRADA = PTS.findIndex((p, i) => i > 20 && p.l > p.f) // Lula retoma a frente

const PADL = 40

function Painel({ W, h, y0, y1, ticks, idx, linhas, titulo }: { W: number; h: number; y0: number; y1: number; ticks: number[]; idx: number; linhas: { k: string; v: (p: Pt) => number | undefined; cor: string; w: number; rot: string }[]; titulo: string }) {
  const PADR = W < 560 ? 96 : 130
  const x = (p: number) => PADL + ((W - PADL - PADR) * (p - 1)) / 99
  const y = (v: number) => 10 + ((h - 30) * (y1 - v)) / (y1 - y0)
  const vis = PTS.slice(0, idx + 1)
  // posições finais dos rótulos, afastadas para não se sobreporem
  const fins = linhas.map((L) => { const last = [...vis].reverse().find((p) => L.v(p) != null); return { k: L.k, v: last ? (L.v(last) as number) : null } })
  const ord = fins.filter((f) => f.v != null).sort((a, b) => (b.v as number) - (a.v as number))
  const ly: Record<string, number> = {}
  let prev = -Infinity
  for (const f of ord) { const yy = Math.max(y(f.v as number), prev + 14); ly[f.k] = yy; prev = yy }
  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="w-full h-auto block" role="img" aria-label={titulo}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PADL} x2={W - PADR} y1={y(t)} y2={y(t)} stroke="var(--rule)" strokeWidth={t === 50 ? 1.4 : 0.8} strokeDasharray={t === 50 ? undefined : '2 4'} />
          <text x={PADL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-mono)">{t}%</text>
        </g>
      ))}
      {(W < 560 ? [1, 50, 100] : [1, 25, 50, 75, 100]).map((p) => (
        <text key={p} x={x(p)} y={h - 4} textAnchor="middle" fontSize="11" fill="var(--ink-3)" fontFamily="var(--font-mono)">{p}%</text>
      ))}
      {linhas.map((L) => {
        const pts = vis.map((p) => [x(p.p), L.v(p)] as const).filter(([, v]) => v != null) as [number, number][]
        if (!pts.length) return null
        const d = pts.map(([px, v], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${y(v).toFixed(1)}`).join('')
        const [lx, lv] = pts[pts.length - 1]
        return (
          <g key={L.k}>
            <path d={d} fill="none" stroke={L.cor} strokeWidth={L.w} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={lx} cy={y(lv)} r={L.w + 1.5} fill={L.cor} />
            <text x={lx + 8} y={(ly[L.k] ?? y(lv)) + 4} fontSize={W < 560 ? 10 : 12} fill={L.cor} fontFamily="var(--font-mono)" fontWeight="600">{L.rot} {lv.toFixed(1).replace('.', ',')}</text>
          </g>
        )
      })}
    </svg>
  )
}

function useLargura() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(900)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(300, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export default function Apuracao() {
  const [boxRef, W] = useLargura()
  const [idx, setIdx] = useState(PTS.length - 1)
  const [tocando, setTocando] = useState(false)
  const timer = useRef<number>(0)

  useEffect(() => {
    if (!tocando) return
    timer.current = window.setInterval(() => {
      setIdx((i) => { if (i >= PTS.length - 1) { setTocando(false); return i } return i + 1 })
    }, 45)
    return () => clearInterval(timer.current)
  }, [tocando])

  const play = () => { if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setIdx(PTS.length - 1); return } setIdx(0); setTocando(true) }
  const pt = PTS[idx]
  const frente = pt.l > pt.f ? 'Lula' : 'Flávio'

  return (
    <section className="wrap py-16 md:py-24" aria-labelledby="apur">
      <p className="eyebrow mb-3">Alegação · "A virada às 20h26 foi suspeita"</p>
      <h2 id="apur" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase">A noite da apuração, de novo</h2>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] mt-6">
        <div className="prose-p space-y-4 min-w-0">
          <p>
            As urnas não chegam ao TSE todas ao mesmo tempo. Cada uma manda seu boletim quando termina, e algumas regiões
            costumam chegar antes de outras. Por isso o placar nacional sobe e desce durante a noite.
          </p>
          <p>
            Reconstruímos a apuração do 2º turno usando o horário em que cada um dos <strong>499 mil boletins</strong> chegou.
            Repare no painel de baixo: dentro de cada região, o percentual de Lula muda pouco do começo ao fim.
            O que muda é <strong>quais regiões já foram contadas</strong>. No primeiro quarto da contagem, 38% dos votos vinham do Sul
            e do Centro-Oeste, onde Flávio vai melhor. No último quarto, dois em cada três votos vinham do Sudeste, e Lula teve 54% nesse bloco.
          </p>
          <p>
            O último boletim chegou às <strong>23h21</strong> do próprio domingo. Não houve "72 horas sem boletins", como circulou nas redes.
          </p>
        </div>
        <div className="min-w-0" ref={boxRef}>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <button className="btn btn-confirma" onClick={play}>{tocando ? 'Apurando…' : '▶ Rever a apuração'}</button>
            <div className="mono text-[0.8rem] px-3 py-2" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} aria-live="polite">
              <b>{pt.h}</b> · {fmtPct(pt.p, 0)} apurado · <span style={{ color: frente === 'Lula' ? 'var(--lula)' : 'var(--flavio)' }}>{frente} na frente</span>
            </div>
          </div>
          <label htmlFor="slider-apur" className="sr-only">Avançar na apuração</label>
          <input id="slider-apur" type="range" min={0} max={PTS.length - 1} value={idx} onChange={(e) => { setTocando(false); setIdx(+e.target.value) }} className="w-full mb-2" />
          <div className="mono text-[0.7rem] mb-1" style={{ color: 'var(--ink-3)' }}>BRASIL · % DOS VOTOS VÁLIDOS JÁ CONTADOS</div>
          <Painel W={W} h={W < 560 ? 200 : 220} y0={46} y1={54} ticks={[46, 48, 50, 52, 54]} idx={idx} titulo="Placar nacional durante a apuração"
            linhas={[{ k: 'l', v: (p) => p.l, cor: 'var(--lula)', w: 3, rot: 'LULA' }, { k: 'f', v: (p) => p.f, cor: 'var(--flavio)', w: 3, rot: 'FLÁVIO' }]} />
          {idx >= VIRADA && (
            <p className="mono text-[0.72rem] -mt-1 mb-4" style={{ color: 'var(--ink-2)' }}>
              ↳ Lula volta à frente às {PTS[VIRADA].h}, com {fmtPct(PTS[VIRADA].p, 0)} das urnas contadas
            </p>
          )}
          <div className="mono text-[0.7rem] mb-1 mt-3" style={{ color: 'var(--ink-3)' }}>LULA EM CADA REGIÃO · QUASE PLANO DO INÍCIO AO FIM</div>
          <Painel W={W} h={W < 560 ? 240 : 250} y0={30} y1={75} ticks={[30, 40, 50, 60, 70]} idx={idx} titulo="Percentual de Lula por região durante a apuração"
            linhas={REG.map((r) => ({ k: r, v: (p: Pt) => p.r[r], cor: COR_REG[r], w: 2, rot: W < 560 ? ({ Nordeste: 'NE', Norte: 'N', Sudeste: 'SE', 'Centro-Oeste': 'CO', Sul: 'S' } as Record<string, string>)[r] : r.toUpperCase() }))} />
          <p className="text-[0.8rem] mt-2" style={{ color: 'var(--ink-3)' }}>
            A divulgação da contagem ficou parada até 19h por causa da prorrogação do horário de votação (informação do TSE), por isso a curva começa nesse horário. As curvas são cálculo nosso, a partir do horário de chegada de cada boletim.
          </p>
        </div>
      </div>
    </section>
  )
}
