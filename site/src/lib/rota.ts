import { useEffect, useState } from 'react'

/** Rotas por hash: "#/mapa", "#/mapa/2906501". Outros hashes ("#mitos") continuam sendo âncoras da página principal. */
export type Rota = { pagina: 'teste' | 'mapa' | 'decisao'; arg?: string }

function ler(): Rota {
  const h = window.location.hash
  if (!h.startsWith('#/')) return { pagina: 'teste' }
  const [p, arg] = h.slice(2).split('/')
  return p === 'mapa' ? { pagina: 'mapa', arg } : p === 'decisao' ? { pagina: 'decisao' } : { pagina: 'teste' }
}

export function useRota() {
  const [r, setR] = useState(ler)
  useEffect(() => {
    const on = () => setR(ler())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}

/** Atualiza o endereço sem empilhar histórico (para seleção de cidade no mapa). */
export function trocarHash(h: string) {
  try { history.replaceState(null, '', h) } catch { /* iframe sem permissão: ignora */ }
}
