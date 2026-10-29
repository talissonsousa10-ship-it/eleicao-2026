/** Dados por estado (escolas e urnas), baixados só quando a pessoa abre aquele estado. Ver preparar_busca.py. */
export type Urna = [number, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null, number | null]
// [seção, aptos, votaram1, lula1, flavio1, outros1, brancosNulos1, votaram2, lula2, flavio2, brancosNulos2]
export type Local = [number, number, string, string, Urna[]] // [zona, nº local, nome, endereço, urnas]
export type DadosUF = { uf: string; m: Record<string, [string, Local[]]>; g?: Record<string, string> }

const cache = new Map<string, Promise<DadosUF>>()

async function baixar(uf: string): Promise<DadosUF> {
  const r = await fetch(`busca/${uf}.json`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const buf = new Uint8Array(await r.arrayBuffer())
  // se o servidor já descompactou (Content-Encoding: gzip), os bytes não começam com a assinatura do gzip
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') throw new Error('navegador sem suporte a descompactação')
    const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return JSON.parse(await new Response(s).text())
  }
  return JSON.parse(new TextDecoder().decode(buf))
}

export function carregarUF(uf: string) {
  if (!cache.has(uf)) {
    const p = baixar(uf)
    p.catch(() => cache.delete(uf))
    cache.set(uf, p)
  }
  return cache.get(uf)!
}

export type Totais = { urnas: number; locais: number; aptos: number; v1: number; l1: number; f1: number; o1: number; bn1: number; v2: number; l2: number; f2: number; bn2: number }
export function somar(locais: Local[]): Totais {
  const t: Totais = { urnas: 0, locais: locais.length, aptos: 0, v1: 0, l1: 0, f1: 0, o1: 0, bn1: 0, v2: 0, l2: 0, f2: 0, bn2: 0 }
  for (const l of locais) for (const u of l[4]) {
    t.urnas++; t.aptos += u[1] ?? 0; t.v1 += u[2] ?? 0; t.l1 += u[3] ?? 0; t.f1 += u[4] ?? 0; t.o1 += u[5] ?? 0; t.bn1 += u[6] ?? 0
    t.v2 += u[7] ?? 0; t.l2 += u[8] ?? 0; t.f2 += u[9] ?? 0; t.bn2 += u[10] ?? 0
  }
  return t
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
