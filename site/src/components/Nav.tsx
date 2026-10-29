import type { Rota } from '@/lib/rota'

const LINKS: { href: string; rot: string; curto: string; pagina: Rota['pagina'] }[] = [
  { href: '#/', rot: 'A eleição passou no teste', curto: 'O teste', pagina: 'teste' },
  { href: '#/decisao', rot: 'Onde foi decidida', curto: 'Por quê', pagina: 'decisao' },
  { href: '#/mapa', rot: 'Explore sua cidade', curto: 'Sua cidade', pagina: 'mapa' },
]

export default function Nav({ rota }: { rota: Rota }) {
  return (
    <nav className="sticky top-0 z-40" style={{ background: 'color-mix(in srgb, var(--paper) 92%, transparent)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--rule)' }} aria-label="Páginas do relatório">
      <div className="wrap flex items-center justify-between gap-3 h-12">
        <a href="#/" className="display uppercase text-[1.05rem] tracking-tight whitespace-nowrap hidden min-[420px]:inline" style={{ color: 'var(--ink)' }}>
          Eleição <span style={{ color: 'var(--lula)' }}>2026</span>
        </a>
        <div className="flex gap-1.5 ml-auto">
          {LINKS.map((l) => {
            const on = rota.pagina === l.pagina
            return (
              <a key={l.href} href={l.href} aria-current={on ? 'page' : undefined} className="mono uppercase text-[0.66rem] sm:text-[0.72rem] font-semibold tracking-[0.06em] px-2.5 py-1.5 rounded-[3px] whitespace-nowrap"
                style={{ background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--paper)' : 'var(--ink-2)', border: `1.5px solid ${on ? 'var(--ink)' : 'var(--rule)'}` }}>
                <span className="hidden md:inline">{l.rot}</span><span className="md:hidden">{l.curto}</span>
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
