import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { D, GEO, IBGE_UF, UF_NOME, diverge, fmt, fmtPct, mix, useTokens, type Mun } from '@/lib/util'

type Modo = 't1' | 't2' | 'viradas' | 'v2022'
const MUN: Mun[] = D.mun
const BY_ID: Record<string, Mun> = Object.fromEntries(MUN.map((m) => [m[0], m]))
const IDS = Object.keys(GEO.mun)

// participação de Lula entre os dois finalistas (para 1º e 2º turno ficarem comparáveis)
const dupla1 = (m: Mun) => (m[4] + m[5] > 0 ? (100 * m[4]) / (m[4] + m[5]) : 50)
const dupla2 = (m: Mun) => m[6]

const MODOS: { id: Modo; rot: string; ajuda: string }[] = [
  { id: 't1', rot: '1º turno', ajuda: 'Cor de cada município: quanto mais vermelho, mais votos de Lula; quanto mais azul, mais de Flávio (comparando só os dois).' },
  { id: 't2', rot: '2º turno', ajuda: 'O mesmo mapa no 2º turno. Quase todo o país ficou um pouco mais vermelho: Lula cresceu em quase todo lugar, não em poucos pontos isolados.' },
  { id: 'viradas', rot: 'Viradas', ajuda: 'Municípios em que o vencedor mudou entre os turnos. Vermelho forte: Flávio liderava e Lula virou (211). Azul forte: o contrário (1).' },
  { id: 'v2022', rot: 'Comparado a 2022', ajuda: 'Quanto Lula mudou em relação ao 2º turno de 2022. Vermelho: foi melhor que em 2022; azul: pior. A maior parte do mapa muda pouco, sinal de que o padrão de voto se manteve.' },
]

const Paths = memo(function Paths() {
  return (
    <g>
      {IDS.map((id) => (
        <path key={id} id={`m${id}`} data-id={id} d={GEO.mun[id]} className="map-path" />
      ))}
    </g>
  )
})

export default function Mapa() {
  const tk = useTokens()
  const gRef = useRef<SVGSVGElement>(null)
  const [modo, setModo] = useState<Modo>('t2')
  const [anim, setAnim] = useState<number | null>(null) // progresso 0..1 da animação 1º→2º turno
  const [hover, setHover] = useState<{ m: Mun; x: number; y: number; w: number } | null>(null)
  const [ufOn, setUfOn] = useState<string | null>(null)
  const raf = useRef<number>(0)
  const els = useRef<Record<string, SVGPathElement>>({})

  useEffect(() => {
    const svg = gRef.current
    if (!svg) return
    IDS.forEach((id) => { const el = svg.querySelector<SVGPathElement>(`#m${id}`); if (el) els.current[id] = el })
  }, [])

  const corDe = useMemo(() => {
    const faded = mix(tk.neutral, tk.paper, 0.35)
    return (m: Mun | undefined, md: Modo, t: number) => {
      if (!m) return tk.neutral
      if (md === 'viradas') {
        if (m[9] === 1) return tk.lula
        if (m[9] === -1) return tk.flavio
        return m[6] > 50 ? mix(faded, tk.lula, 0.12) : mix(faded, tk.flavio, 0.12)
      }
      if (md === 'v2022') return m[8] == null ? tk.neutral : diverge((m[6] - m[8]) / 12, tk)
      const p = md === 't1' ? dupla1(m) : t >= 1 ? dupla2(m) : dupla1(m) + (dupla2(m) - dupla1(m)) * t
      return diverge((p - 50) / 32, tk)
    }
  }, [tk])

  // pinta o mapa
  useEffect(() => {
    const t = anim ?? 1
    const md: Modo = anim != null ? 't2' : modo
    for (const id of IDS) {
      const el = els.current[id]
      if (el) el.style.fill = corDe(BY_ID[id], md, t)
    }
  }, [modo, anim, corDe])

  const tocar = () => {
    cancelAnimationFrame(raf.current)
    const reduz = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduz) { setAnim(null); setModo('t2'); return }
    const t0 = performance.now(), dur = 2600
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setAnim(e)
      if (k < 1) raf.current = requestAnimationFrame(step)
      else { setAnim(null); setModo('viradas') }
    }
    setModo('t2')
    raf.current = requestAnimationFrame(step)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const onMove = (e: React.PointerEvent) => {
    const id = (e.target as SVGElement).getAttribute?.('data-id')
    if (!id) { setHover(null); return }
    const m = BY_ID[id]
    if (!m) { setHover(null); return }
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setHover({ m, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width })
  }

  const ufs = useMemo(() => Object.entries(D.uf as Record<string, any>).sort((a, b) => b[1].dm - a[1].dm), [])
  const maxDm = Math.max(...ufs.map(([, v]) => v.dm))
  const ajuda = MODOS.find((m) => m.id === (anim != null ? 't2' : modo))!.ajuda
  const pctAnim = anim != null ? Math.round(anim * 100) : null

  return (
    <section id="mapa" className="py-16 md:py-24" style={{ background: 'var(--paper-2)' }} aria-labelledby="mapa-t">
      <div className="wrap">
        <p className="eyebrow mb-3">O mapa · 5.570 municípios</p>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <h2 id="mapa-t" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase">Lula cresceu no país inteiro</h2>
          <button className="btn btn-confirma justify-self-start" onClick={tocar} aria-label="Animar a mudança do 1º para o 2º turno">
            ▶ Ver a virada acontecer
          </button>
        </div>
        <p className="prose-p mt-4">
          Se alguém tivesse inventado votos, eles tenderiam a aparecer concentrados em alguns lugares. O mapa mostra outra coisa:
          entre o 1º e o 2º turno, quase todos os municípios ficaram um pouco mais vermelhos ao mesmo tempo. Passe o dedo ou o
          mouse sobre o mapa para ver cada cidade.
        </p>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Escolha o que o mapa mostra">
          {MODOS.map((m) => (
            <button key={m.id} className="btn" aria-pressed={anim == null && modo === m.id} onClick={() => { cancelAnimationFrame(raf.current); setAnim(null); setModo(m.id) }}>
              {m.rot}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="relative" onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
              <svg ref={gRef} viewBox={`0 0 ${GEO.w} ${GEO.h}`} className="w-full h-auto block max-h-[78vh]" role="img" aria-label="Mapa do Brasil por município colorido pelo voto">
                <Paths />
                <g>
                  {Object.entries(GEO.uf).map(([uf, d]) => (
                    <path key={uf} d={d} className={`uf-path ${ufOn && IBGE_UF[uf] === ufOn ? 'on' : ''}`} />
                  ))}
                </g>
              </svg>
              {pctAnim != null && (
                <div className="absolute left-3 top-3 mono text-[0.75rem] px-2 py-1" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
                  1º TURNO → 2º TURNO · {pctAnim}%
                </div>
              )}
              {hover && (
                <div className="pointer-events-none absolute z-10 w-[230px] p-3 text-[0.85rem]"
                  style={{ left: hover.x > hover.w - 250 ? Math.max(4, hover.x - 244) : hover.x + 14, top: hover.y + 14, background: 'var(--card)', border: '1px solid var(--rule)', boxShadow: '0 10px 30px -12px rgba(0,0,0,.35)' }}>
                  <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem' }}>{hover.m[1]} <span style={{ color: 'var(--ink-3)' }}>· {hover.m[2]}</span></div>
                  <div className="mono text-[0.72rem] mt-1 grid gap-0.5" style={{ color: 'var(--ink-2)' }}>
                    <span>1º turno: Lula {fmtPct(hover.m[4])} · Flávio {fmtPct(hover.m[5])}</span>
                    <span>2º turno: Lula {fmtPct(hover.m[6])} · Flávio {fmtPct(100 - hover.m[6])}</span>
                    {hover.m[8] != null && <span>2022: Lula {fmtPct(hover.m[8])}</span>}
                    <span>Eleitores: {fmt(hover.m[3])}</span>
                  </div>
                  {hover.m[9] !== 0 && <div className="chip mt-2 inline-block" style={{ background: hover.m[9] > 0 ? 'var(--lula)' : 'var(--flavio)', color: '#fff' }}>Virou para {hover.m[9] > 0 ? 'Lula' : 'Flávio'}</div>}
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.85rem]" style={{ color: 'var(--ink-2)' }}>
              {modo !== 'viradas' || anim != null ? (
                <div className="flex items-center gap-2 mono text-[0.72rem]">
                  <span>{modo === 'v2022' && anim == null ? 'PIOR QUE 2022' : 'MAIS FLÁVIO'}</span>
                  <span className="h-2.5 w-40 rounded-sm" style={{ background: `linear-gradient(90deg, ${tk.flavio}, ${tk.neutral}, ${tk.lula})` }} />
                  <span>{modo === 'v2022' && anim == null ? 'MELHOR QUE 2022' : 'MAIS LULA'}</span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4 mono text-[0.72rem]">
                  <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{ background: tk.lula }} />VIROU PARA LULA · {D.espelho.n2026}</span>
                  <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{ background: tk.flavio }} />VIROU PARA FLÁVIO · 1</span>
                </div>
              )}
            </div>
            <p className="mt-3 text-[0.95rem] max-w-[62ch]" style={{ color: 'var(--ink-2)' }} aria-live="polite">{ajuda}</p>
          </div>

          <aside className="min-w-0">
            <h3 className="text-[1.05rem] font-bold" style={{ fontStretch: '90%' }}>Onde a diferença mudou mais</h3>
            <p className="text-[0.85rem] mt-1 mb-3" style={{ color: 'var(--ink-3)' }}>Votos que a vantagem de Lula ganhou do 1º para o 2º turno, por estado. Toque para destacar no mapa.</p>
            <ul className="grid gap-[3px]">
              {ufs.map(([uf, v]) => (
                <li key={uf}>
                  <button className="w-full grid grid-cols-[2.2rem_minmax(0,1fr)_4.6rem] items-center gap-2 text-left py-[3px]"
                    onMouseEnter={() => setUfOn(uf)} onMouseLeave={() => setUfOn(null)} onFocus={() => setUfOn(uf)} onBlur={() => setUfOn(null)}
                    onClick={() => setUfOn(ufOn === uf ? null : uf)} aria-label={`${UF_NOME[uf]}: vantagem de Lula mudou ${fmt(v.dm)} votos`}>
                    <span className="mono text-[0.72rem] font-semibold">{uf}</span>
                    <span className="h-[10px] rounded-[2px]" style={{ width: `${Math.max(2, (100 * v.dm) / maxDm)}%`, background: ufOn === uf ? 'var(--ink)' : 'var(--lula)' }} />
                    <span className="mono text-[0.7rem] text-right" style={{ color: 'var(--ink-2)' }}>+{fmt(v.dm)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-[0.8rem] mt-3" style={{ color: 'var(--ink-3)' }}>
              A vantagem de Lula melhorou em todos os 27 estados. São Paulo, sozinho, somou 1,4 milhão.
            </p>
            <a className="btn btn-confirma mt-4 inline-block" href="#/mapa">Explore cidade por cidade →</a>
          </aside>
        </div>
      </div>
    </section>
  )
}
