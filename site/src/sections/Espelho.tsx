import { D, usePlayOnView } from '@/lib/util'

const E = D.espelho
const BINS = ['0–1', '1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8']
const ORD = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']

export default function Espelho() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const mx = Math.max(...E.h2022, ...E.h2026)
  const reg = (ano: string, r: string) => (E.reg as any[]).find((x) => x.ano === ano && x.regiao === r)
  return (
    <section className="wrap py-16 md:py-24" aria-labelledby="espelho">
      <p className="eyebrow mb-3">Comparação · eleição de 2022</p>
      <h2 id="espelho" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase">2026 é 2022 no espelho</h2>
      <p className="prose-p mt-5">
        Em 2022, Lula ficou na frente no 1º turno e Bolsonaro foi quem mais cresceu no 2º. Ele virou <strong>{E.n2022} municípios</strong>.
        Em 2026 aconteceu o contrário: Flávio liderou o 1º turno e Lula virou <strong>{E.n2026}</strong>. Nos dois anos, as viradas
        aconteceram nos mesmos tipos de lugar, onde o 1º turno tinha sido apertado. Nenhuma virada superou 8 pontos de diferença.
      </p>

      <div ref={ref} className="mt-10 grid gap-12 lg:grid-cols-2">
        <figure className="min-w-0">
          <figcaption className="text-[1.05rem] font-bold mb-1" style={{ fontStretch: '90%' }}>Municípios virados, pela diferença que tinham no 1º turno</figcaption>
          <p className="text-[0.85rem] mb-4" style={{ color: 'var(--ink-3)' }}>Cada linha é uma faixa de diferença, em pontos percentuais. As barras dos dois lados quase se espelham.</p>
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[minmax(0,1fr)_3.6rem_minmax(0,1fr)] mono text-[0.68rem] mb-1" style={{ color: 'var(--ink-3)' }}>
              <span className="text-right pr-2">2022 · BOLSONARO VIROU</span><span className="text-center">PONTOS</span><span className="pl-2">2026 · VIRADAS (211 DE LULA)</span>
            </div>
            {BINS.map((b, i) => (
              <div key={b} className="grid grid-cols-[minmax(0,1fr)_3.6rem_minmax(0,1fr)] items-center">
                <div className="flex justify-end items-center gap-2">
                  <span className="mono text-[0.7rem]" style={{ color: 'var(--ink-2)' }}>{E.h2022[i]}</span>
                  <span className={`grow-x ${play ? 'play' : ''} h-5 rounded-l-[2px]`} style={{ width: `${(100 * E.h2022[i]) / mx}%`, background: 'var(--flavio)', transformOrigin: 'right center', animationDelay: `${i * 60}ms` }} />
                </div>
                <span className="mono text-[0.72rem] text-center">{b}</span>
                <div className="flex items-center gap-2">
                  <span className={`grow-x ${play ? 'play' : ''} h-5 rounded-r-[2px]`} style={{ width: `${(100 * E.h2026[i]) / mx}%`, background: 'var(--lula)', animationDelay: `${i * 60}ms` }} />
                  <span className="mono text-[0.7rem]" style={{ color: 'var(--ink-2)' }}>{E.h2026[i]}</span>
                </div>
              </div>
            ))}
          </div>
        </figure>

        <figure className="min-w-0">
          <figcaption className="text-[1.05rem] font-bold mb-1" style={{ fontStretch: '90%' }}>Quanto cada um cresceu do 1º para o 2º turno, por região</figcaption>
          <p className="text-[0.85rem] mb-4" style={{ color: 'var(--ink-3)' }}>Pontos percentuais dos votos válidos. Em 2022 o azul domina; em 2026, o vermelho.</p>
          <div className="grid gap-4">
            {ORD.map((r) => {
              const a = reg('2022', r), b = reg('2026', r)
              const row = (ano: string, x: any, op: number) => (
                <div className="grid grid-cols-[2.6rem_minmax(0,1fr)] items-center gap-2">
                  <span className="mono text-[0.66rem]" style={{ color: 'var(--ink-3)' }}>{ano}</span>
                  <div className="grid gap-[3px]">
                    {(['lula_pp', '22_pp'] as const).map((k) => (
                      <div key={k} className="flex items-center gap-2">
                        <span className={`grow-x ${play ? 'play' : ''} h-[9px] rounded-[2px]`} style={{ width: `${Math.max(0.6, (100 * Math.max(0, x[k])) / 8)}%`, background: k === 'lula_pp' ? 'var(--lula)' : 'var(--flavio)', opacity: op }} />
                        <span className="mono text-[0.64rem]" style={{ color: 'var(--ink-2)' }}>{x[k] > 0 ? '+' : ''}{x[k].toFixed(1).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
              return (
                <div key={r} className="grid gap-1.5">
                  <span className="text-[0.88rem] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{r}</span>
                  {row('2022', a, 0.55)}
                  {row('2026', b, 1)}
                </div>
              )
            })}
          </div>
          <div className="flex gap-5 mt-4 mono text-[0.68rem]" style={{ color: 'var(--ink-2)' }}>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 inline-block" style={{ background: 'var(--lula)' }} />LULA</span>
            <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 inline-block" style={{ background: 'var(--flavio)' }} />BOLSONARO (2022) · FLÁVIO (2026)</span>
          </div>
        </figure>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          ['0,989', 'é a semelhança entre o mapa de 2022 e o de 2026, município a município (1 seria idêntico).'],
          ['85%', 'dos municípios mudaram menos de 5 pontos em relação a 2022.'],
          ['10 de 10', 'municípios que mais fugiram do próprio histórico se moveram contra Lula, não a favor.'],
        ].map(([n, t]) => (
          <div key={n} className="pt-4" style={{ borderTop: '3px solid var(--ink)' }}>
            <div className="display text-[2.6rem] leading-none">{n}</div>
            <p className="text-[0.95rem] mt-2" style={{ color: 'var(--ink-2)' }}>{t}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
