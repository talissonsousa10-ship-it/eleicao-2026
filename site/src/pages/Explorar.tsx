import { memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { select } from 'd3-selection'
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import 'd3-transition'
import { D, GEO, IBGE_UF, UF_NOME, diverge, fmt, fmtPct, useTokens, type Mun } from '@/lib/util'
import { carregarUF, semAcento, somar, type DadosUF, type Local, type Urna } from '@/lib/busca'
import { trocarHash } from '@/lib/rota'

type Modo = 't2' | 't1' | 'v2022'
type Tk = ReturnType<typeof useTokens>
const MUN: Mun[] = D.mun
const BY_ID: Record<string, Mun> = Object.fromEntries(MUN.filter((m) => m[0]).map((m) => [m[0], m]))
const UF_COD: Record<string, string> = Object.fromEntries(Object.entries(IBGE_UF).map(([c, u]) => [u, c]))
const IDS = Object.keys(GEO.mun)
const INDICE = MUN.filter((m) => m[0] && GEO.mun[m[0]]).map((m) => ({ id: m[0], n: semAcento(m[1]), m }))
const UFS = Object.keys(UF_NOME).sort((a, b) => UF_NOME[a].localeCompare(UF_NOME[b]))
const reduz = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const virg = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : 0)

const MODOS: { id: Modo; rot: string }[] = [
  { id: 't2', rot: '2º turno' }, { id: 't1', rot: '1º turno' }, { id: 'v2022', rot: 'Comparado a 2022' },
]

function corDe(m: Mun | undefined, modo: Modo, tk: Tk) {
  if (!m) return tk.neutral
  if (modo === 'v2022') return m[8] == null ? tk.neutral : diverge((m[6] - m[8]) / 12, tk)
  const p = modo === 't1' ? (m[4] + m[5] > 0 ? (100 * m[4]) / (m[4] + m[5]) : 50) : m[6]
  return diverge((p - 50) / 32, tk)
}

/* ---------- dados do estado aberto ---------- */
function useUF(uf: string | null) {
  const [st, setSt] = useState<{ uf: string; dados?: DadosUF; erro?: string } | null>(null)
  useEffect(() => {
    if (!uf) return
    let vivo = true
    setSt((s) => (s?.uf === uf ? s : { uf }))
    carregarUF(uf).then((d) => vivo && setSt({ uf, dados: d }), (e) => vivo && setSt({ uf, erro: String(e?.message ?? e) }))
    return () => { vivo = false }
  }, [uf])
  if (!uf || st?.uf !== uf) return { carregando: !!uf }
  return { dados: st.dados, erro: st.erro, carregando: !st.dados && !st.erro }
}

/* ---------- mapa com zoom ---------- */
type Api = { zoomUF: (cod: string) => void; zoomMun: (id: string) => void; reset: () => void }

const NacPaths = memo(function NacPaths() {
  return <g>{IDS.map((id) => <path key={id} data-id={id} d={GEO.mun[id]} className="map-path" />)}</g>
})

const Detalhe = memo(function Detalhe({ g, modo, tk }: { g: Record<string, string>; modo: Modo; tk: Tk }) {
  return <g>{Object.entries(g).map(([id, d]) => <path key={id} data-id={id} d={d} className="map-path" style={{ fill: corDe(BY_ID[id], modo, tk) }} />)}</g>
})

function MapaZoom({ modo, ufAtivo, geoUF, sel, onPick, carregando, apiRef }: {
  modo: Modo; ufAtivo: string | null; geoUF?: Record<string, string>; sel: string | null; onPick: (id: string) => void; carregando: boolean; apiRef: Ref<Api>
}) {
  const tk = useTokens()
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const els = useRef<Record<string, SVGPathElement>>({})
  const ufEls = useRef<Record<string, SVGPathElement>>({})
  const [hover, setHover] = useState<{ id: string; x: number; y: number; w: number } | null>(null)

  useEffect(() => {
    const svg = svgRef.current!
    svg.querySelectorAll<SVGPathElement>('g.nac path').forEach((el) => { els.current[el.dataset.id!] = el })
    const z = d3zoom<SVGSVGElement, unknown>().scaleExtent([1, 3000]).clickDistance(6)
      .translateExtent([[-250, -250], [GEO.w + 250, GEO.h + 250]])
      .on('zoom', (e) => gRef.current?.setAttribute('transform', e.transform.toString()))
    const s = select(svg)
    s.call(z).on('dblclick.zoom', null)
    zRef.current = z
    return () => { s.on('.zoom', null) }
  }, [])

  // cor dos municípios no mapa nacional
  useEffect(() => {
    for (const id of IDS) { const el = els.current[id]; if (el) el.style.fill = corDe(BY_ID[id], modo, tk) }
  }, [modo, tk])

  // esconde o contorno simplificado do estado que tem contorno detalhado carregado
  useEffect(() => {
    const cod = ufAtivo ? UF_COD[ufAtivo] : null
    for (const id of IDS) {
      const el = els.current[id]
      if (!el) continue
      el.style.visibility = cod && geoUF && id.startsWith(cod) && geoUF[id] ? 'hidden' : ''
      el.style.opacity = cod && !id.startsWith(cod) ? '0.4' : ''
    }
  }, [ufAtivo, geoUF])

  const ir = useCallback((b: DOMRect | SVGRect, frac: number) => {
    const svg = svgRef.current, z = zRef.current
    if (!svg || !z) return
    const bw = Math.max(b.width, 0.5), bh = Math.max(b.height, 0.5)
    const k = Math.min(3000, frac * Math.min(GEO.w / bw, GEO.h / bh))
    const t = zoomIdentity.translate(GEO.w / 2, GEO.h / 2).scale(k).translate(-(b.x + bw / 2), -(b.y + bh / 2))
    select(svg).transition().duration(reduz() ? 0 : 950).call(z.transform, t)
  }, [])

  useImperativeHandle(apiRef, () => ({
    zoomUF: (cod) => { const el = ufEls.current[cod]; if (el) ir(el.getBBox(), 0.88) },
    zoomMun: (id) => { const el = els.current[id]; if (el) ir(el.getBBox(), 0.3) },
    reset: () => { const svg = svgRef.current, z = zRef.current; if (svg && z) select(svg).transition().duration(reduz() ? 0 : 800).call(z.transform, zoomIdentity) },
  }), [ir])

  const passo = (f: number) => { const svg = svgRef.current, z = zRef.current; if (svg && z) select(svg).transition().duration(reduz() ? 0 : 300).call(z.scaleBy, f) }

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    const id = (e.target as SVGElement).getAttribute?.('data-id')
    if (!id || !BY_ID[id]) { setHover(null); return }
    const box = e.currentTarget.getBoundingClientRect()
    setHover({ id, x: e.clientX - box.left, y: e.clientY - box.top, w: box.width })
  }
  const selD = sel ? geoUF?.[sel] ?? GEO.mun[sel] : null
  const hovD = hover ? geoUF?.[hover.id] ?? GEO.mun[hover.id] : null
  const hm = hover ? BY_ID[hover.id] : null

  return (
    <div className="relative overflow-hidden rounded-[4px]" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}
      onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${GEO.w} ${GEO.h}`} className="block w-full h-[58vh] md:h-[72vh] cursor-grab active:cursor-grabbing select-none"
        role="img" aria-label="Mapa do Brasil por município. Toque num estado para aproximar e numa cidade para ver o resultado."
        onClick={(e) => { const id = (e.target as SVGElement).getAttribute?.('data-id'); if (id) onPick(id) }}>
        <g ref={gRef}>
          <g className="nac"><NacPaths /></g>
          {geoUF && <Detalhe g={geoUF} modo={modo} tk={tk} />}
          <g>
            {Object.entries(GEO.uf).map(([cod, d]) => (
              <path key={cod} ref={(el) => { if (el) ufEls.current[cod] = el }} d={d}
                className={`uf-path ${ufAtivo && UF_COD[ufAtivo] === cod ? 'on' : ''}`} />
            ))}
          </g>
          {hovD && hover?.id !== sel && <path d={hovD} className="hover-path" />}
          {selD && <path d={selD} className="sel-path" />}
        </g>
      </svg>

      <div className="absolute right-2 top-2 grid gap-1.5">
        {([['+', 1.8, 'Aproximar'], ['−', 1 / 1.8, 'Afastar']] as const).map(([t, f, a]) => (
          <button key={t} className="map-ctl" onClick={() => passo(f)} aria-label={a}>{t}</button>
        ))}
      </div>
      <AnimatePresence>
        {carregando && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute left-2 top-2 mono text-[0.68rem] px-2 py-1" style={{ background: 'var(--paper)', border: '1px solid var(--rule)' }}>
            CARREGANDO {ufAtivo ? (UF_NOME[ufAtivo] ?? 'EXTERIOR').toUpperCase() : ''}…
          </motion.div>
        )}
      </AnimatePresence>
      {hover && hm && (
        <div className="pointer-events-none absolute z-10 px-3 py-2 text-[0.82rem]"
          style={{ left: hover.x > hover.w - 230 ? Math.max(4, hover.x - 214) : hover.x + 14, top: hover.y + 14, background: 'var(--card)', border: '1px solid var(--rule)', boxShadow: '0 10px 30px -12px rgba(0,0,0,.35)' }}>
          <div className="font-bold" style={{ fontFamily: 'var(--font-display)' }}>{hm[1]} <span style={{ color: 'var(--ink-3)' }}>· {hm[2]}</span></div>
          <div className="mono text-[0.7rem]" style={{ color: 'var(--ink-2)' }}>2º turno: Lula {fmtPct(hm[6])} · Flávio {fmtPct(100 - hm[6])}</div>
        </div>
      )}
    </div>
  )
}

/* ---------- busca ---------- */
function Busca({ onCidade, onUF }: { onCidade: (id: string) => void; onUF: (uf: string) => void }) {
  const [q, setQ] = useState('')
  const [ativo, setAtivo] = useState(0)
  const [aberto, setAberto] = useState(false)
  const inp = useRef<HTMLInputElement>(null)
  const res = useMemo(() => {
    const s = semAcento(q.trim())
    if (s.length < 2) return [] as { tipo: 'mun' | 'uf'; id: string; rot: string; sub: string }[]
    const ufs = UFS.filter((u) => semAcento(UF_NOME[u]).startsWith(s) || u.toLowerCase() === s)
      .map((u) => ({ tipo: 'uf' as const, id: u, rot: UF_NOME[u], sub: 'estado' }))
    const a: typeof INDICE = [], b: typeof INDICE = []
    for (const x of INDICE) { if (x.n.startsWith(s)) a.push(x); else if (x.n.includes(s)) b.push(x) }
    const ord = (p: (typeof INDICE)[number], r: (typeof INDICE)[number]) => r.m[3] - p.m[3]
    const muns = [...a.sort(ord), ...b.sort(ord)].map((x) => ({ tipo: 'mun' as const, id: x.id, rot: x.m[1], sub: `${x.m[2]} · ${fmt(x.m[3])} eleitores` }))
    return [...ufs, ...muns].slice(0, 8)
  }, [q])
  const escolher = (r: (typeof res)[number]) => {
    setQ(''); setAberto(false); inp.current?.blur()
    if (r.tipo === 'uf') onUF(r.id); else onCidade(r.id)
  }
  return (
    <div className="relative w-full">
      <label htmlFor="busca" className="sr-only">Buscar cidade ou estado</label>
      <div className="flex items-center gap-2 px-3 h-12 rounded-[4px]" style={{ background: 'var(--card)', border: '1.5px solid var(--ink)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" style={{ color: 'var(--ink-3)' }}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input id="busca" ref={inp} value={q} autoComplete="off" spellCheck={false}
          role="combobox" aria-expanded={aberto && res.length > 0} aria-controls="busca-lista" aria-autocomplete="list"
          aria-activedescendant={aberto && res[ativo] ? `op-${res[ativo].id}` : undefined}
          placeholder="Digite sua cidade (ex.: Candeias) ou estado"
          className="flex-1 min-w-0 bg-transparent outline-none text-[1rem]" style={{ color: 'var(--ink)', fontFamily: 'var(--font-body)' }}
          onChange={(e) => { setQ(e.target.value); setAtivo(0); setAberto(true) }} onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(res.length - 1, a + 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(0, a - 1)) }
            else if (e.key === 'Enter' && res[ativo]) { e.preventDefault(); escolher(res[ativo]) }
            else if (e.key === 'Escape') setAberto(false)
          }} />
      </div>
      <AnimatePresence>
        {aberto && res.length > 0 && (
          <motion.ul id="busca-lista" role="listbox" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}
            className="absolute z-30 left-0 right-0 mt-1 py-1 rounded-[4px]" style={{ background: 'var(--card)', border: '1px solid var(--rule)', boxShadow: '0 16px 40px -18px rgba(0,0,0,.45)' }}>
            {res.map((r, i) => (
              <li key={r.tipo + r.id} id={`op-${r.id}`} role="option" aria-selected={i === ativo}
                onMouseDown={(e) => { e.preventDefault(); escolher(r) }} onMouseEnter={() => setAtivo(i)}
                className="px-3 py-2 cursor-pointer flex items-baseline justify-between gap-3" style={{ background: i === ativo ? 'var(--paper-2)' : 'transparent' }}>
                <span className="font-semibold truncate">{r.rot}</span>
                <span className="mono text-[0.66rem] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>{r.sub.toUpperCase()}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ---------- peças do painel ---------- */
function Barra({ l, f, o = 0, alto = 10 }: { l: number; f: number; o?: number; alto?: number }) {
  const t = l + f + o || 1
  return (
    <div className="flex w-full overflow-hidden rounded-[2px]" style={{ height: alto, background: 'var(--paper-2)' }}>
      <motion.span initial={{ width: 0 }} animate={{ width: `${(100 * l) / t}%` }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} style={{ background: 'var(--lula)' }} />
      {o > 0 && <motion.span initial={{ width: 0 }} animate={{ width: `${(100 * o) / t}%` }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} style={{ background: 'var(--ink-3)', opacity: 0.45 }} />}
      <motion.span initial={{ width: 0 }} animate={{ width: `${(100 * f) / t}%` }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }} style={{ background: 'var(--flavio)', marginLeft: 'auto' }} />
    </div>
  )
}

function Resultado({ rot, l, f, o }: { rot: string; l: number; f: number; o?: number }) {
  const t = l + f + (o ?? 0)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 mono text-[0.68rem] mb-1">
        <span className="whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>{rot}</span>
        <span><b style={{ color: 'var(--lula)' }}>LULA {fmtPct(pct(l, t))}</b> · <b style={{ color: 'var(--flavio)' }}>FLÁVIO {fmtPct(pct(f, t))}</b>{o ? <span style={{ color: 'var(--ink-3)' }}> · OUTROS {fmtPct(pct(o, t))}</span> : null}</span>
      </div>
      <Barra l={l} f={f} o={o} alto={14} />
    </div>
  )
}

const pagina = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.3 } }

function Inicio({ onUF }: { onUF: (uf: string) => void }) {
  const N = D.nac
  return (
    <motion.div {...pagina} className="grid gap-5">
      <div>
        <p className="eyebrow">Brasil · Presidente</p>
        <h2 className="display uppercase text-[2rem] leading-none mt-1">Escolha um lugar</h2>
        <p className="text-[0.95rem] mt-2" style={{ color: 'var(--ink-2)' }}>
          Toque num estado no mapa ou digite o nome da cidade. Em cada cidade você vê o resultado dos dois turnos, a comparação
          com 2022, cada escola onde se votou e cada urna, com os mesmos números do boletim afixado na porta da seção.
        </p>
      </div>
      <div className="grid gap-3">
        <Resultado rot="1º TURNO" l={N.l1} f={N.f1} o={N.outros1} />
        <Resultado rot="2º TURNO" l={N.l2} f={N.f2} />
      </div>
      <div>
        <p className="eyebrow mb-2">Estados</p>
        <div className="flex flex-wrap gap-1.5">
          {UFS.map((u) => (
            <button key={u} className="mono text-[0.7rem] font-semibold px-2 py-1 rounded-[3px]" onClick={() => onUF(u)} title={UF_NOME[u]}
              style={{ border: '1px solid var(--rule)', background: D.uf[u].l2 > 50 ? 'color-mix(in srgb, var(--lula) 14%, transparent)' : 'color-mix(in srgb, var(--flavio) 14%, transparent)' }}>{u}</button>
          ))}
          <button className="mono text-[0.7rem] font-semibold px-2 py-1 rounded-[3px]" style={{ border: '1px solid var(--rule)' }} onClick={() => onUF('ZZ')}>EXTERIOR</button>
        </div>
      </div>
    </motion.div>
  )
}

function ResumoUF({ uf, onCidade }: { uf: string; onCidade: (id: string) => void }) {
  const u = D.uf[uf]
  const maiores = useMemo(() => MUN.filter((m) => m[2] === uf && m[0]).sort((a, b) => b[3] - a[3]).slice(0, 12), [uf])
  return (
    <motion.div {...pagina} className="grid gap-5">
      <div>
        <p className="eyebrow">{u.reg} · Presidente</p>
        <h2 className="display uppercase text-[2rem] leading-none mt-1">{UF_NOME[uf]}</h2>
        <p className="text-[0.95rem] mt-2" style={{ color: 'var(--ink-2)' }}>
          Do 1º para o 2º turno, a vantagem de Lula aqui {u.dm >= 0 ? 'cresceu' : 'caiu'} {fmt(Math.abs(u.dm))} votos. Toque numa cidade do mapa
          ou escolha uma das maiores.
        </p>
      </div>
      <div className="grid gap-3">
        <Resultado rot="1º TURNO" l={u.l1} f={u.f1} o={Math.max(0, 100 - u.l1 - u.f1)} />
        <Resultado rot="2º TURNO" l={u.l2} f={100 - u.l2} />
      </div>
      <div>
        <p className="eyebrow mb-2">Maiores cidades · Lula no 2º turno</p>
        <ul className="grid gap-1">
          {maiores.map((m, i) => (
            <motion.li key={m[0]} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
              <button className="w-full grid grid-cols-[minmax(0,1fr)_88px_3.2rem] items-center gap-2 text-left py-1" onClick={() => onCidade(m[0])}>
                <span className="truncate text-[0.92rem]">{m[1]}</span>
                <Barra l={m[6]} f={100 - m[6]} />
                <span className="mono text-[0.7rem] text-right">{virg(m[6])}%</span>
              </button>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

function ListaExterior({ dados, onCidade }: { dados?: DadosUF; onCidade: (id: string) => void }) {
  const cidades = useMemo(() => dados ? Object.entries(dados.m).map(([id, [n, l]]) => ({ id, n, t: somar(l) })).sort((a, b) => b.t.aptos - a.t.aptos) : [], [dados])
  const [f, setF] = useState('')
  const vis = cidades.filter((c) => semAcento(c.n).includes(semAcento(f)))
  return (
    <motion.div {...pagina} className="grid gap-4">
      <div>
        <p className="eyebrow">Presidente · fora do Brasil</p>
        <h2 className="display uppercase text-[2rem] leading-none mt-1">Exterior</h2>
        <p className="text-[0.95rem] mt-2" style={{ color: 'var(--ink-2)' }}>Brasileiros votam em {cidades.length || '…'} cidades de outros países. Escolha uma para ver os locais e as urnas.</p>
      </div>
      <input value={f} onChange={(e) => setF(e.target.value)} placeholder="Filtrar cidade" className="campo" />
      <ul className="grid gap-1">
        {vis.map((c) => (
          <li key={c.id}>
            <button className="w-full grid grid-cols-[minmax(0,1fr)_88px_3.2rem] items-center gap-2 text-left py-1" onClick={() => onCidade(c.id)}>
              <span className="truncate text-[0.92rem]">{c.n}</span>
              <Barra l={c.t.l2} f={c.t.f2} />
              <span className="mono text-[0.7rem] text-right">{virg(pct(c.t.l2, c.t.l2 + c.t.f2))}%</span>
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function TabelaUrnas({ urnas }: { urnas: Urna[] }) {
  const [t, setT] = useState<1 | 2>(2)
  const linhas = urnas.map((u) => t === 1 ? [u[0], u[2], u[3], u[4], u[5], u[6]] : [u[0], u[7], u[8], u[9], null, u[10]])
  const tot: number[] = [0, 0, 0, 0, 0, 0]
  for (const r of linhas) for (let i = 1; i < 6; i++) tot[i] += r[i] ?? 0
  const cab = ['SEÇÃO', 'VOTARAM', 'LULA', 'FLÁVIO', ...(t === 1 ? ['OUTROS'] : []), 'BR+NU']
  const cel = (v: number | null) => (v == null ? '—' : fmt(v))
  return (
    <div className="pt-3">
      <div className="flex gap-1.5 mb-2" role="group" aria-label="Turno">
        {([1, 2] as const).map((x) => <button key={x} className="btn !text-[0.64rem] !px-2 !py-1" aria-pressed={t === x} onClick={() => setT(x)}>{x}º turno</button>)}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full mono text-[0.66rem] tnum">
          <thead><tr style={{ color: 'var(--ink-3)' }}>{cab.map((c) => <th key={c} className="text-right font-semibold py-1 pr-1 first:text-left">{c}</th>)}</tr></thead>
          <tbody>
            {linhas.map((r) => (
              <tr key={r[0] as number} style={{ borderTop: '1px dashed var(--rule)' }}>
                <td className="py-1 pr-1">{r[0]}</td><td className="text-right pr-1">{cel(r[1])}</td>
                <td className="text-right pr-1" style={{ color: 'var(--lula)' }}>{cel(r[2])}</td><td className="text-right pr-1" style={{ color: 'var(--flavio)' }}>{cel(r[3])}</td>
                {t === 1 && <td className="text-right pr-1">{cel(r[4])}</td>}<td className="text-right pr-1">{cel(r[5])}</td>
              </tr>
            ))}
            {linhas.length > 1 && (
              <tr className="font-semibold" style={{ borderTop: '1.5px solid var(--ink)' }}>
                <td className="py-1 pr-1">TOTAL</td><td className="text-right pr-1">{fmt(tot[1])}</td><td className="text-right pr-1">{fmt(tot[2])}</td>
                <td className="text-right pr-1">{fmt(tot[3])}</td>{t === 1 && <td className="text-right pr-1">{fmt(tot[4])}</td>}<td className="text-right pr-1">{fmt(tot[5])}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[0.75rem] mt-2" style={{ color: 'var(--ink-3)' }}>Cada linha é uma urna. Os números são os do boletim impresso no fim da votação.</p>
    </div>
  )
}

function Escola({ l }: { l: Local }) {
  const [aberto, setAberto] = useState(false)
  const t = useMemo(() => somar([l]), [l])
  return (
    <li style={{ borderTop: '1px solid var(--rule)' }}>
      <button className="w-full text-left py-2.5 grid grid-cols-[minmax(0,1fr)_76px] gap-3 items-center" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <span className="min-w-0">
          <span className="block font-semibold text-[0.92rem] leading-snug">{l[2]}</span>
          {l[3] && <span className="block text-[0.78rem] truncate" style={{ color: 'var(--ink-3)' }}>{l[3]}</span>}
          <span className="block mono text-[0.62rem] mt-0.5" style={{ color: 'var(--ink-3)' }}>ZONA {l[0]} · {l[4].length} {l[4].length === 1 ? 'URNA' : 'URNAS'} · {fmt(t.aptos)} ELEITORES</span>
        </span>
        <span className="grid gap-1 justify-items-end">
          <span className="mono text-[0.68rem]"><b style={{ color: 'var(--lula)' }}>{virg(pct(t.l2, t.l2 + t.f2), 0)}</b> × <b style={{ color: 'var(--flavio)' }}>{virg(pct(t.f2, t.l2 + t.f2), 0)}</b></span>
          <Barra l={t.l2} f={t.f2} alto={7} />
          <span className="mono text-[0.6rem]" style={{ color: 'var(--ink-3)' }}>{aberto ? 'FECHAR ▲' : 'URNAS ▼'}</span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28 }} style={{ overflow: 'hidden' }}>
            <div className="pb-3"><TabelaUrnas urnas={l[4]} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

const SITE = 'https://talissonsousa10-ship-it.github.io/eleicao-2026/'

function Compartilhar({ id, nome }: { id: string; nome: string }) {
  const [msg, setMsg] = useState<string | null>(null)
  const url = `${SITE}#/mapa/${id}`
  const texto = `Como ${nome} votou para presidente em 2026, escola por escola e urna por urna:`
  const agir = async () => {
    try {
      if (navigator.share && window.matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: `Eleição 2026 · ${nome}`, text: texto, url }); return }
      await navigator.clipboard.writeText(url)
      setMsg('Link copiado')
    } catch {
      setMsg(url)
    }
    setTimeout(() => setMsg(null), 4000)
  }
  return (
    <div className="mt-3">
      <button className="btn !py-1.5 !px-2.5 !text-[0.66rem] inline-flex items-center gap-1.5" onClick={agir} aria-label={`Compartilhar o link de ${nome}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
        Copiar link desta cidade
      </button>
      <AnimatePresence>
        {msg && (
          <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="ml-2 mono text-[0.64rem] break-all" style={{ color: 'var(--ok)' }} role="status">
            {msg === url ? <>Copie: <span style={{ color: 'var(--ink)' }}>{url}</span></> : `✓ ${msg}`}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

function Cidade({ id, dados, erro }: { id: string; dados?: DadosUF; erro?: string }) {
  const m = BY_ID[id]
  const bloco = dados?.m[id]
  const locais = bloco?.[1]
  const nome = m?.[1] ?? bloco?.[0] ?? '…'
  const t = useMemo(() => (locais ? somar(locais) : null), [locais])
  const [f, setF] = useState('')
  const [limite, setLimite] = useState(25)
  useEffect(() => { setF(''); setLimite(25) }, [id])
  const vis = useMemo(() => {
    if (!locais) return []
    const s = semAcento(f.trim())
    return s ? locais.filter((l) => semAcento(l[2] + ' ' + l[3]).includes(s) || String(l[4].map((u) => u[0])).split(',').includes(s)) : locais
  }, [locais, f])
  const margem = t ? t.l2 - t.f2 : m?.[7] ?? 0
  const uf = m?.[2] ?? 'ZZ'

  return (
    <motion.div {...pagina} className="grid gap-5">
      <div>
        <p className="eyebrow">{uf === 'ZZ' ? 'Exterior' : UF_NOME[uf]} · Presidente</p>
        <h2 className="display uppercase text-[clamp(1.8rem,4vw,2.4rem)] leading-[0.95] mt-1">{nome}</h2>
        <div className="flex flex-wrap gap-2 mt-2">
          {m && m[9] !== 0 && <span className="chip" style={{ background: m[9] > 0 ? 'var(--lula)' : 'var(--flavio)', color: '#fff' }}>Virou para {m[9] > 0 ? 'Lula' : 'Flávio'} no 2º turno</span>}
          <span className="chip chip-ink">{margem >= 0 ? 'Lula' : 'Flávio'} venceu por {fmt(Math.abs(margem))} {Math.abs(margem) === 1 ? 'voto' : 'votos'}</span>
        </div>
        {!id.startsWith('Z') && <Compartilhar id={id} nome={nome} />}
      </div>

      <div className="grid gap-3">
        {t ? <Resultado rot="1º TURNO" l={t.l1} f={t.f1} o={t.o1} /> : m && <Resultado rot="1º TURNO" l={m[4]} f={m[5]} o={Math.max(0, 100 - m[4] - m[5])} />}
        {t ? <Resultado rot="2º TURNO" l={t.l2} f={t.f2} /> : m && <Resultado rot="2º TURNO" l={m[6]} f={100 - m[6]} />}
        {m && m[8] != null && (
          <p className="text-[0.88rem]" style={{ color: 'var(--ink-2)' }}>
            Em 2022, Lula teve {fmtPct(m[8])} aqui no 2º turno. Em 2026, {fmtPct(m[6])}: {m[6] >= m[8] ? 'mais' : 'menos'} {virg(Math.abs(m[6] - m[8]))} ponto{Math.abs(m[6] - m[8]) >= 2 ? 's' : ''}.
          </p>
        )}
      </div>

      {t && (
        <div className="grid grid-cols-3 gap-px" style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {([['ELEITORES', t.aptos], ['VOTARAM NO 2º', t.v2], ['URNAS', t.urnas]] as const).map(([r, v]) => (
            <div key={r} className="p-2.5" style={{ background: 'var(--paper)' }}>
              <div className="mono text-[0.58rem]" style={{ color: 'var(--ink-3)' }}>{r}</div>
              <div className="display text-[1.35rem] leading-none mt-1">{fmt(v)}</div>
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <h3 className="text-[1.1rem] font-extrabold" style={{ fontStretch: '85%' }}>Onde se votou</h3>
          {locais && <span className="mono text-[0.64rem]" style={{ color: 'var(--ink-3)' }}>{fmt(locais.length)} {locais.length === 1 ? 'LOCAL' : 'LOCAIS'}</span>}
        </div>
        {erro && <p className="text-[0.88rem]" style={{ color: 'var(--warn)' }}>Não foi possível baixar as escolas deste estado ({erro}). Tente de novo mais tarde.</p>}
        {!locais && !erro && <div className="grid gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-[3px] animate-pulse" style={{ background: 'var(--paper-2)' }} />)}</div>}
        {locais && (
          <>
            {locais.length > 3 && <input value={f} onChange={(e) => { setF(e.target.value); setLimite(25) }} placeholder="Buscar escola, rua, bairro ou nº da seção" className="campo mb-2" aria-label="Buscar escola" />}
            <ul>{vis.slice(0, limite).map((l) => <Escola key={`${l[0]}-${l[1]}`} l={l} />)}</ul>
            {vis.length === 0 && <p className="text-[0.88rem] py-3" style={{ color: 'var(--ink-3)' }}>Nenhum local com esse nome.</p>}
            {vis.length > limite && <button className="btn w-full mt-2" onClick={() => setLimite((x) => x + 50)}>Mostrar mais {Math.min(50, vis.length - limite)} de {fmt(vis.length - limite)}</button>}
          </>
        )}
      </div>
    </motion.div>
  )
}

/* ---------- página ---------- */
export default function Explorar({ arg }: { arg?: string }) {
  const tk = useTokens()
  const [modo, setModo] = useState<Modo>('t2')
  const [uf, setUf] = useState<string | null>(null)
  const [mun, setMun] = useState<string | null>(null)
  const { dados, erro, carregando } = useUF(uf)
  const api = useRef<Api>(null)
  const painel = useRef<HTMLDivElement>(null)

  const abrirUF = useCallback((s: string) => {
    setUf(s); setMun(null); trocarHash(`#/mapa/${s}`)
    if (s !== 'ZZ') api.current?.zoomUF(UF_COD[s]); else api.current?.reset()
  }, [])
  const abrirCidade = useCallback((id: string, rolar = false) => {
    const s = BY_ID[id]?.[2] ?? (id.startsWith('Z') ? uf ?? 'ZZ' : IBGE_UF[id.slice(0, 2)])
    setUf(s); setMun(id); trocarHash(`#/mapa/${id}`)
    if (BY_ID[id]) api.current?.zoomMun(id)
    if (rolar && window.innerWidth < 1024) setTimeout(() => painel.current?.scrollIntoView({ behavior: reduz() ? 'auto' : 'smooth', block: 'start' }), 350)
  }, [uf])
  const brasil = () => { setUf(null); setMun(null); trocarHash('#/mapa'); api.current?.reset() }
  const onPick = (id: string) => { const s = IBGE_UF[id.slice(0, 2)]; if (s !== uf) abrirUF(s); else abrirCidade(id) }

  // endereço direto: #/mapa/2906501 ou #/mapa/BA
  useEffect(() => {
    if (!arg) return
    const t = setTimeout(() => { if (BY_ID[arg]) abrirCidade(arg); else if (UF_NOME[arg] || arg === 'ZZ') abrirUF(arg) }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const m = mun ? BY_ID[mun] : null
  const nomeMun = m?.[1] ?? (mun && dados?.m[mun]?.[0])
  return (
    <section className="wrap py-8 md:py-12">
      <p className="eyebrow mb-2">Explore · {fmt(5570)} municípios · {fmt(94709)} locais de votação · {fmt(499205)} urnas</p>
      <h1 className="display uppercase text-[clamp(2.1rem,5vw,3.6rem)] leading-[0.92]">Como votou a sua cidade</h1>
      <p className="lede mt-3 !text-[1.05rem]">Procure a sua cidade, a escola onde você vota e a sua urna. Todos os números vêm dos arquivos públicos do TSE e batem com o total oficial de cada município.</p>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <Busca onCidade={(id) => abrirCidade(id, true)} onUF={abrirUF} />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="O que o mapa mostra">
          {MODOS.map((x) => <button key={x.id} className="btn !py-2 !px-2.5 sm:!px-[0.9rem] !text-[0.66rem] sm:!text-[0.78rem]" aria-pressed={modo === x.id} onClick={() => setModo(x.id)}>{x.rot}</button>)}
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-1 mono text-[0.7rem] mb-2" aria-label="Você está em">
            <button className="underline-offset-2 hover:underline font-semibold" onClick={brasil}>BRASIL</button>
            {uf && <><span style={{ color: 'var(--ink-3)' }}>›</span><button className="underline-offset-2 hover:underline font-semibold" onClick={() => abrirUF(uf)}>{(UF_NOME[uf] ?? 'Exterior').toUpperCase()}</button></>}
            {nomeMun && <><span style={{ color: 'var(--ink-3)' }}>›</span><span>{nomeMun.toUpperCase()}</span></>}
          </nav>
          <div className="relative">
            <MapaZoom modo={modo} ufAtivo={uf} geoUF={dados?.g} sel={m ? mun : null} onPick={onPick} carregando={carregando} apiRef={api} />
            <AnimatePresence>
              {m && (
                <motion.button key={mun} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="lg:hidden absolute left-2 right-2 bottom-2 flex items-center justify-between gap-3 px-3 py-2 text-left"
                  style={{ background: 'var(--card)', border: '1px solid var(--ink)', boxShadow: '0 12px 30px -14px rgba(0,0,0,.5)' }}
                  onClick={() => painel.current?.scrollIntoView({ behavior: reduz() ? 'auto' : 'smooth', block: 'start' })}>
                  <span className="min-w-0"><b className="block truncate">{m[1]}</b><span className="mono text-[0.66rem]" style={{ color: 'var(--ink-2)' }}>LULA {fmtPct(m[6])} · FLÁVIO {fmtPct(100 - m[6])}</span></span>
                  <span className="mono text-[0.66rem] font-semibold whitespace-nowrap">ESCOLAS ↓</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 mono text-[0.66rem]" style={{ color: 'var(--ink-2)' }}>
            <span className="flex items-center gap-2">
              <span>{modo === 'v2022' ? 'PIOR QUE 2022' : 'MAIS FLÁVIO'}</span>
              <span className="h-2.5 w-28 rounded-sm" style={{ background: `linear-gradient(90deg, ${tk.flavio}, ${tk.neutral}, ${tk.lula})` }} />
              <span>{modo === 'v2022' ? 'MELHOR QUE 2022' : 'MAIS LULA'}</span>
            </span>
            <span style={{ color: 'var(--ink-3)' }}>ARRASTE PARA MOVER · PINÇA OU RODA PARA ZOOM</span>
          </div>
        </div>

        <aside ref={painel} className="min-w-0 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto p-4 md:p-5 scroll-mt-14"
          style={{ background: 'var(--card)', border: '1px solid var(--rule)' }} aria-live="polite">
          <AnimatePresence mode="wait">
            {mun ? <Cidade key={mun} id={mun} dados={dados} erro={erro} />
              : uf === 'ZZ' ? <ListaExterior key="zz" dados={dados} onCidade={(id) => abrirCidade(id)} />
              : uf ? <ResumoUF key={uf} uf={uf} onCidade={(id) => abrirCidade(id)} />
              : <Inicio key="inicio" onUF={abrirUF} />}
          </AnimatePresence>
        </aside>
      </div>
    </section>
  )
}
