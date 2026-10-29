const FONTES: [string, string][] = [
  ['Portal de Dados Abertos do TSE — Resultados 2026', 'https://dadosabertos.tse.jus.br/dataset/resultados-2026'],
  ['Portal de Dados Abertos do TSE — Resultados 2022', 'https://dadosabertos.tse.jus.br/dataset/resultados-2022'],
  ['TSE — votos registrados após as 17h no 2º turno', 'https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/eleicoes-2026-mais-de-34-mil-votos-foram-registrados-apos-as-17h-no-2o-turno'],
  ['Fato ou Boato — relatório apócrifo distorce dados', 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/relatorio-apocrifo-distorce-dados-para-sugerir-fraude-nas-eleicoes-2026'],
  ['Fato ou Boato — virada no 2º turno não é impossível', 'https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-virada-de-votos-no-segundo-turno-seja-impossivel-ou-comprove-fraude-nas-eleicoes'],
  ['Lupa — checagem da carta de Flávio Bolsonaro', 'https://www.agencialupa.org/checagem/2026/10/28/apos-fuga-do-brasil-flavio-bolsonaro-mente-sobre-eleicoes-em-carta-com-teor-golpista/'],
  ['Gazeta do Povo — institutos erram o vencedor', 'https://www.gazetadopovo.com.br/eleicoes/2026/institutos-pesquisa-erram-vencedor-eleicao-veja-qual-chegou-mais-perto/'],
  ['TMC — AtlasIntel: pesquisas subestimaram o comparecimento', 'https://tmc.com.br/politica/atlasintel-pesquisas-subestimaram-comparecimento-lula-2turno-2026/'],
  ['Diário do Nordeste — PL reconhece o resultado', 'https://diariodonordeste.verdesmares.com.br/pontopoder/pl-reconhece-resultado-das-eleicoes-2026-mas-cobras-esclarecimentos-apos-derrota-de-flavio-1.3801638'],
]

export default function Metodo() {
  return (
    <section className="wrap py-16 md:py-24" aria-labelledby="metodo">
      <div className="grid gap-12 lg:grid-cols-3">
        <div className="min-w-0">
          <p className="eyebrow mb-3">Como foi feito</p>
          <h2 id="metodo" className="text-[1.9rem] font-extrabold uppercase" style={{ fontStretch: '80%' }}>Só dados públicos</h2>
          <ul className="mt-4 grid gap-3 text-[0.98rem]" style={{ color: 'var(--ink-2)' }}>
            <li>Usamos os arquivos que o TSE publica para qualquer pessoa baixar: votos por zona, por seção (urna), o detalhe de cada urna (modelo e horário de chegada do boletim) e o conteúdo dos boletins de urna.</li>
            <li>Antes de qualquer teste, conferimos que os arquivos batem entre si e com o resultado oficial, voto a voto.</li>
            <li>Quase todos os números da página foram calculados por nós a partir desses arquivos. As exceções vêm marcadas: os votos depois das 17h (comunicado do TSE) e os números das pesquisas (imprensa).</li>
            <li>Os mesmos testes foram aplicados ao 1º turno e à eleição de 2022, para saber o que é "normal" e comparar.</li>
            <li>Os arquivos brutos estão no portal de dados abertos do TSE, para qualquer pessoa baixar e refazer as contas. Os programas da análise, em Python, e o passo a passo para refazer tudo estão no <a className="underline" href="https://github.com/talissonsousa10-ship-it/eleicao-2026" target="_blank" rel="noreferrer">repositório do projeto no GitHub</a>.</li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className="eyebrow mb-3">O que esta análise não diz</p>
          <h2 className="text-[1.9rem] font-extrabold uppercase" style={{ fontStretch: '80%' }}>Limites</h2>
          <ul className="mt-4 grid gap-3 text-[0.98rem]" style={{ color: 'var(--ink-2)' }}>
            <li>Os dados mostram como cada lugar votou, não como cada pessoa votou. Não dá para dizer quem trocou de candidato.</li>
            <li>Os testes procuram as marcas que fraudes costumam deixar. Eles tornam uma fraude capaz de mudar o resultado extremamente improvável, mas nenhuma análise estatística sozinha substitui a auditoria das urnas.</li>
            <li>Os arquivos são do próprio TSE. Conferimos os 998.411 boletins de urna (o papel da porta de cada seção) dos dois turnos, em todos os estados e no exterior, com a totalização, e eles batem em 100% das urnas. Antes, conferimos a assinatura digital (SHA-512) de cada um dos 56 arquivos do TSE. Isso mostra que o resultado oficial é a soma dos boletins; não prova sozinho o que aconteceu dentro de cada urna, e para isso servem os testes estatísticos e a auditoria do próprio TSE. Qualquer pessoa também pode conferir a sua seção pelo QR Code do boletim.</li>
            <li>Discussões jurídicas, como o pedido de cassação, ficam fora do alcance dos dados.</li>
          </ul>
        </div>
        <div className="min-w-0">
          <p className="eyebrow mb-3">Fontes</p>
          <h2 className="text-[1.9rem] font-extrabold uppercase" style={{ fontStretch: '80%' }}>Para conferir</h2>
          <ul className="mt-4 grid gap-2.5 text-[0.92rem]">
            {FONTES.map(([t, u]) => (
              <li key={u}><a href={u} target="_blank" rel="noreferrer" className="underline decoration-[var(--rule)] underline-offset-4 hover:decoration-[var(--ink)]">{t} ↗</a></li>
            ))}
          </ul>
        </div>
      </div>
      <footer className="mt-16 pt-6 flex flex-wrap justify-between gap-4 mono text-[0.7rem]" style={{ borderTop: '1px solid var(--rule)', color: 'var(--ink-3)' }}>
        <span>Talisson Santana · analista de dados estatísticos · análise com dados abertos do TSE</span>
        <span>Arquivos de resultado gerados pelo TSE em 26 e 28/10/2026</span>
      </footer>
    </section>
  )
}
