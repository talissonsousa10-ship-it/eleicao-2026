import { ATUALIZADO, MUDANCAS } from '@/data/mudancas'

const COR = { 'correção': 'var(--warn)', novo: 'var(--ok)', visual: 'var(--ink-3)' } as const

export function irParaRegistro() {
  document.getElementById('registro')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const d = document.getElementById('registro-detalhes') as HTMLDetailsElement | null
  if (d) d.open = true
}

export function LinhaAtualizado() {
  const nc = MUDANCAS.flatMap((m) => m.itens).filter((i) => i.tipo === 'correção').length
  return (
    <div className="wrap pt-3 mono text-[0.62rem] flex flex-wrap gap-x-2" style={{ color: 'var(--ink-3)' }}>
      <span>ATUALIZADO EM {ATUALIZADO}</span>
      <span aria-hidden>·</span>
      <button className="underline underline-offset-2 hover:text-[var(--ink)]" onClick={irParaRegistro}>
        O QUE MUDOU{nc ? ` (${nc} ${nc > 1 ? 'CORREÇÕES' : 'CORREÇÃO'})` : ''}
      </button>
    </div>
  )
}

export default function Registro() {
  return (
    <section id="registro" className="wrap pb-14 scroll-mt-16" aria-labelledby="registro-t">
      <details id="registro-detalhes" className="p-5" style={{ background: 'var(--card)', border: '1px solid var(--rule)' }}>
        <summary className="cursor-pointer flex flex-wrap items-baseline gap-x-3">
          <h2 id="registro-t" className="inline text-[1.1rem] font-extrabold uppercase" style={{ fontStretch: '85%' }}>Registro de mudanças</h2>
          <span className="mono text-[0.62rem]" style={{ color: 'var(--ink-3)' }}>ATUALIZADO EM {ATUALIZADO}</span>
        </summary>
        <p className="mt-3 text-[0.88rem]" style={{ color: 'var(--ink-2)' }}>
          Toda mudança feita depois da primeira publicação fica listada aqui. Quando um número, um título ou uma conclusão muda, ela aparece
          como correção, com o que estava escrito antes. O histórico completo, linha por linha, está no{' '}
          <a href="https://github.com/talissonsousa10-ship-it/eleicao-2026/commits/main" target="_blank" rel="noreferrer" className="underline underline-offset-2">repositório do projeto ↗</a>.
        </p>
        {MUDANCAS.map((m) => (
          <div key={m.data} className="mt-4">
            <p className="mono text-[0.66rem] font-semibold">{m.data}</p>
            <ul className="mt-2 grid gap-2.5">
              {m.itens.map((i, k) => (
                <li key={k} className="grid sm:grid-cols-[5.6rem_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-[0.88rem]">
                  <span className="mono text-[0.58rem] pt-[0.2rem] leading-tight" style={{ color: COR[i.tipo] }}>{i.tipo.toUpperCase()}<br className="hidden sm:block" /><span className="sm:hidden"> · </span><span style={{ color: 'var(--ink-3)' }}>{i.hora}</span></span>
                  <span style={{ color: 'var(--ink-2)' }}><span className="mono text-[0.6rem]" style={{ color: 'var(--ink-3)' }}>{i.pagina.toUpperCase()} · </span>{i.texto}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
    </section>
  )
}
