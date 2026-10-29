import { D, fmt, fmtMi, usePlayOnView } from '@/lib/util'

const N = D.nac

/** De onde vieram os votos que mudaram de dono entre o 1º e o 2º turno. */
export default function ContaVirada() {
  const [ref, play] = usePlayOnView<HTMLDivElement>()
  const pool = N.outros1 + N.dvalidos // 14.098.232 = ganho de Lula + ganho de Flávio
  const ganhoL = N.l2 - N.l1
  const ganhoF = N.f2 - N.f1
  const fontes = [
    { k: 'Votos de quem escolheu outro candidato no 1º turno', v: N.outros1, c: 'var(--ink-2)' },
    { k: 'Votantes a mais no 2º turno (saldo)', v: N.dcomp, c: 'var(--ink-3)' },
    { k: 'Brancos e nulos a menos no 2º turno (saldo)', v: N.dbn, c: 'var(--rule)' },
  ]
  return (
    <section className="wrap py-16 md:py-24" aria-labelledby="conta" style={{ borderTop: '1px solid var(--rule)' }}>
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Alegação nº 1 · "Matematicamente impossível"</p>
          <h2 id="conta" className="display text-[clamp(2.2rem,5vw,3.6rem)] uppercase">A conta da virada fecha</h2>
          <div className="prose-p mt-6 space-y-4">
            <p>
              No 1º turno, Flávio ficou na frente: <strong>{fmtMi(N.f1)}</strong> contra <strong>{fmtMi(N.l1)}</strong> de Lula. No 2º,
              Lula ganhou <strong>{fmtMi(ganhoL)}</strong> a mais e Flávio <strong>{fmtMi(ganhoF)}</strong>. Parece muito, mas esses votos
              tinham de onde vir.
            </p>
            <p>
              Somando os votos dos outros candidatos, o aumento no número de votantes e a queda dos brancos e nulos, havia
              <strong> {fmtMi(pool)}</strong> de votos em disputa. Lula ficou com cerca de 3 em cada 4. É uma virada grande,
              mas é aritmética comum: cada voto a mais de Lula e de Flávio tem uma origem nos números oficiais.
            </p>
          </div>
        </div>

        <div ref={ref} className="min-w-0 self-center">
          <div className="mono text-[0.72rem] mb-2" style={{ color: 'var(--ink-3)' }}>DE ONDE VIERAM · {fmt(pool)} VOTOS</div>
          <div className="flex h-14 w-full overflow-hidden rounded-[3px]" role="img" aria-label="Barra com as três origens dos votos em disputa">
            {fontes.map((f) => (
              <div key={f.k} className={`grow-x ${play ? 'play' : ''} h-full`} style={{ width: `${(100 * f.v) / pool}%`, background: f.c, borderRight: '2px solid var(--paper)' }} />
            ))}
          </div>
          <ul className="mt-3 grid gap-2">
            {fontes.map((f) => (
              <li key={f.k} className="flex items-baseline gap-3 text-[0.95rem]">
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm translate-y-[1px]" style={{ background: f.c }} />
                <span className="flex-1 min-w-0" style={{ color: 'var(--ink-2)' }}>{f.k}</span>
                <span className="mono text-[0.85rem]">{fmtMi(f.v, 2)}</span>
              </li>
            ))}
          </ul>

          <svg viewBox="0 0 600 56" className="w-full my-3" aria-hidden="true">
            <path d="M300 4 L300 22 M300 22 L120 50 M300 22 L520 50" stroke="var(--ink-3)" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
          </svg>

          <div className="mono text-[0.72rem] mb-2" style={{ color: 'var(--ink-3)' }}>PARA ONDE FORAM</div>
          <div className="flex h-14 w-full overflow-hidden rounded-[3px]" role="img" aria-label={`Lula ficou com ${fmt(ganhoL)} e Flávio com ${fmt(ganhoF)}`}>
            <div className={`grow-x ${play ? 'play' : ''} h-full flex items-center px-3`} style={{ width: `${(100 * ganhoL) / pool}%`, background: 'var(--lula)', borderRight: '2px solid var(--paper)', animationDelay: '.35s' }}>
              <span className="mono text-[0.8rem] font-semibold text-white">LULA +{fmtMi(ganhoL)}</span>
            </div>
            <div className={`grow-x ${play ? 'play' : ''} h-full flex items-center px-2`} style={{ width: `${(100 * ganhoF) / pool}%`, background: 'var(--flavio)', animationDelay: '.5s' }}>
              <span className="mono text-[0.75rem] font-semibold text-white whitespace-nowrap">+{fmtMi(ganhoF)}</span>
            </div>
          </div>
          <div className="flex justify-between mono text-[0.75rem] mt-2" style={{ color: 'var(--ink-2)' }} data-fonte="nossa">
            <span>{Math.round((100 * ganhoL) / pool)}% para Lula</span>
            <span>{Math.round((100 * ganhoF) / pool)}% para Flávio</span>
          </div>
          <p className="mt-6 text-[0.95rem] p-4" style={{ background: 'var(--paper-2)', color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>Para comparar:</b> em 2022, foi Bolsonaro quem cresceu mais entre os turnos:
            +7,1 milhões, contra +3,1 milhões de Lula. Ninguém precisa de fraude para crescer no 2º turno.
          </p>
          <p className="mono text-[0.66rem] mt-3" style={{ color: 'var(--ink-3)' }}>NÚMEROS: TOTALIZAÇÃO OFICIAL DO TSE, CONFERIDA POR NÓS VOTO A VOTO NOS ARQUIVOS DE CADA ZONA</p>
        </div>
      </div>
    </section>
  )
}
