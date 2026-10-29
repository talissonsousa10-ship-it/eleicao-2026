import { useEffect, useRef, useState } from 'react'
import dadosRaw from '../data/dados.json'
import geoRaw from '../data/geo_paths.json'

export type Mun = [string, string, string, number, number, number, number, number, number | null, number]
// [ibge, nome, uf, aptos, lula1%, flavio1%, lula2%, margem2 (votos), lula2022%, virada (1 Lula, -1 Flávio, 0)]
export const D = dadosRaw as any
export const GEO = geoRaw as { w: number; h: number; mun: Record<string, string>; uf: Record<string, string>; ufc: Record<string, [number, number]> }

const nf = new Intl.NumberFormat('pt-BR')
export const fmt = (n: number) => nf.format(Math.round(n))
export const fmtPct = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'
export const fmtMi = (n: number, d = 1) => (n / 1e6).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' mi'

export const UF_NOME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba',
  PE: 'Pernambuco', PI: 'Piauí', PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima',
  RS: 'Rio Grande do Sul', SC: 'Santa Catarina', SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
}
export const IBGE_UF: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN',
  '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC',
  '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

/** Lê as cores do tema atual (CSS vars) e atualiza quando o tema muda. */
export function useTokens() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement)
    const g = (n: string) => cs.getPropertyValue(n).trim()
    return { lula: g('--lula'), flavio: g('--flavio'), neutral: g('--neutral-map'), ink: g('--ink'), ink3: g('--ink-3'), rule: g('--rule'), paper: g('--paper'), ok: g('--ok'), lulaSoft: g('--lula-soft'), flavioSoft: g('--flavio-soft') }
  }
  const [t, setT] = useState(read)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const on = () => setT(read())
    mq.addEventListener('change', on)
    const mo = new MutationObserver(on)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
    return () => { mq.removeEventListener('change', on); mo.disconnect() }
  }, [])
  return t
}

/** Marca .play quando o elemento entra na tela (o estado de repouso já é o final). */
export function usePlayOnView<T extends Element>() {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setSeen(true); io.disconnect() } }, { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  return [ref, seen] as const
}

const hex = (c: string) => {
  const rgb = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]]
  const m = c.replace('#', '')
  const v = m.length === 3 ? m.split('').map((x) => x + x).join('') : m
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}
export function mix(a: string, b: string, t: number) {
  const A = hex(a), B = hex(b)
  const r = A.map((x, i) => Math.round(x + (B[i] - x) * t))
  return `rgb(${r[0]},${r[1]},${r[2]})`
}
/** Escala divergente: v em [-1, 1]; -1 azul (Flávio), +1 vermelho (Lula). */
export function diverge(v: number, tk: { lula: string; flavio: string; neutral: string }) {
  const x = Math.max(-1, Math.min(1, v))
  const e = Math.sign(x) * Math.pow(Math.abs(x), 0.8)
  return e >= 0 ? mix(tk.neutral, tk.lula, e) : mix(tk.neutral, tk.flavio, -e)
}

/** Largura real de um elemento (para desenhar SVG em pixels de verdade, com texto legível no celular). */
export function useLargura<T extends Element>(inicial = 640) {
  const ref = useRef<T>(null)
  const [w, setW] = useState(inicial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((es) => { const x = Math.round(es[0].contentRect.width); if (x > 0) setW(x) })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}
