const itens = [
  { n: '14,1 mi', t: 'votos ficaram "em jogo" entre os turnos', d: 'São os votos dos outros candidatos, o aumento no número de votantes e a queda dos votos brancos e nulos, em saldo. Lula ficou com 10,4 milhões deles e Flávio com 3,7 milhões. A conta fecha sem sobrar nem faltar voto.' },
  { n: '0', t: 'urnas com mais votos do que eleitores', d: 'Em quase 1 milhão de registros (cada urna, em cada turno), o número de votos é exatamente igual ao de pessoas que compareceram. Nenhuma recebeu mais gente do que tinha eleitores.' },
  { n: '99%', t: 'das diferenças entre lugares se explicam pelo 1º turno', d: 'Sabendo como cada zona votou no 1º turno, dá para prever o 2º com enorme precisão. Fraude apareceria como lugares que fogem dessa previsão a favor de quem ganhou. Isso não aconteceu.' },
  { n: '2022', t: 'teve a mesma virada, com o sinal trocado', d: 'Há quatro anos foi Bolsonaro quem cresceu mais entre os turnos e virou 251 municípios. Em 2026, Lula virou 211, com o mesmo padrão. Virada entre turnos é normal.' },
]

export default function Essencial() {
  return (
    <section className="wrap pb-16 md:pb-24" aria-labelledby="essencial">
      <h2 id="essencial" className="eyebrow mb-6">O essencial em 4 números</h2>
      <div className="grid gap-px md:grid-cols-4" style={{ background: 'var(--rule)', border: '1px solid var(--rule)' }}>
        {itens.map((i) => (
          <article key={i.t} className="p-6 md:p-7 flex flex-col gap-3 min-w-0" style={{ background: 'var(--paper)' }}>
            <div className="display text-[3.4rem] leading-none">{i.n}</div>
            <h3 className="text-[1.05rem] font-bold" style={{ fontStretch: '90%' }}>{i.t}</h3>
            <p className="text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{i.d}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
