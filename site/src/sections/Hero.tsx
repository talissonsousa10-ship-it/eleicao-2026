import { D, fmt, fmtPct } from '@/lib/util'

const N = D.nac

function Receipt() {
  const rows: [string, string][] = [
    ['ELEITORES APTOS', fmt(N.aptos)],
    ['COMPARECIMENTO', fmt(128236074)],
    ['SEÇÕES APURADAS', '499.205'],
  ]
  return (
    <div className="receipt w-full max-w-[340px] px-5 pt-5 pb-7 print-in" aria-label="Resumo do resultado em formato de boletim de urna">
      <div className="text-center" style={{ animationDelay: '0ms' }}>
        <div className="font-semibold tracking-[0.14em]">BOLETIM DE URNA</div>
        <div className="text-[0.7rem]" style={{ color: 'var(--ink-3)' }}>BRASIL · PRESIDENTE · 2º TURNO</div>
        <div className="text-[0.7rem]" style={{ color: 'var(--ink-3)' }}>25/10/2026</div>
      </div>
      <div className="rule-dash my-3" />
      {rows.map(([k, v], i) => (
        <div key={k} className="receipt-row" style={{ animationDelay: `${120 + i * 90}ms` }}>
          <span style={{ color: 'var(--ink-2)' }}>{k}</span><span>{v}</span>
        </div>
      ))}
      <div className="rule-dash my-3" />
      <div className="receipt-row" style={{ animationDelay: '420ms' }}>
        <span><b style={{ color: 'var(--lula)' }}>13</b> LULA</span><span className="font-semibold">{fmt(N.l2)}</span>
      </div>
      <div className="receipt-row" style={{ animationDelay: '510ms' }}>
        <span><b style={{ color: 'var(--flavio)' }}>22</b> FLÁVIO</span><span className="font-semibold">{fmt(N.f2)}</span>
      </div>
      <div className="receipt-row" style={{ animationDelay: '600ms', color: 'var(--ink-3)' }}>
        <span>BRANCOS + NULOS</span><span>{fmt(4153801)}</span>
      </div>
      <div className="rule-dash my-3" />
      <div className="receipt-row font-semibold" style={{ animationDelay: '700ms' }}>
        <span>DIFERENÇA</span><span>{fmt(N.margem)}</span>
      </div>
      <div className="mt-3 flex items-center gap-2" style={{ animationDelay: '820ms' }}>
        <span className="h-2 flex-1 rounded-sm" style={{ background: 'var(--lula)', flexGrow: N.p_l2 }} />
        <span className="h-2 flex-1 rounded-sm" style={{ background: 'var(--flavio)', flexGrow: N.p_f2 }} />
      </div>
      <div className="receipt-row text-[0.7rem] mt-1" style={{ animationDelay: '820ms', color: 'var(--ink-2)' }}>
        <span>{fmtPct(N.p_l2, 2)}</span><span>{fmtPct(N.p_f2, 2)}</span>
      </div>
      <div className="mt-4 grid grid-cols-[repeat(21,1fr)] gap-[2px] opacity-70" aria-hidden="true" style={{ animationDelay: '900ms' }}>
        {Array.from({ length: 21 * 6 }).map((_, i) => (
          <span key={i} className="aspect-square" style={{ background: (i * 7919 + (i >> 3) * 31) % 5 < 2 ? 'var(--ink)' : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <header className="wrap pt-10 pb-14 md:pt-16 md:pb-20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-10 md:mb-14">
        <span className="eyebrow">Por <b style={{ color: 'var(--ink)' }}>Talisson Santana</b> · analista de dados estatísticos</span>
        <span className="eyebrow">Dados abertos do TSE · 29/10/2026</span>
      </div>
      <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <h1 className="display text-[clamp(2.3rem,8.4vw,6.6rem)] uppercase">
            Lula ganhou por <span style={{ color: 'var(--lula)' }}>4,4&nbsp;milhões</span> de votos.
            <br />
            <span style={{ color: 'var(--ink-3)' }}>Procuramos fraude em 499&nbsp;mil urnas.</span>
            <br />
            <span>Não encontramos.</span>
          </h1>
          <p className="lede mt-8">
            Depois do 2º turno, apareceram afirmações de que a eleição teria sido roubada: que a virada era "matematicamente
            impossível", que os números foram manipulados, que as urnas antigas votaram diferente. Pegamos os arquivos públicos
            do Tribunal Superior Eleitoral, urna por urna, e fizemos os testes que uma fraude grande o bastante para mudar o resultado dificilmente passaria.
            Este relatório mostra o que encontramos, em linguagem simples.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn btn-confirma" href="#mapa">Ver o mapa da virada</a>
            <a className="btn" href="#mitos">Checar as alegações</a>
            <a className="btn" href="#/mapa">Procure sua cidade →</a>
          </div>
        </div>
        <div className="flex justify-center md:justify-end">
          <Receipt />
        </div>
      </div>
    </header>
  )
}
