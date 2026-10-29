# Eleição 2026: os dados abertos do TSE, urna por urna

Análise do 2º turno da eleição presidencial de 2026 (Lula 64.256.232 × Flávio Bolsonaro 59.826.041) feita só com arquivos públicos do Tribunal Superior Eleitoral e do IBGE. O objetivo é testar as alegações matemáticas de fraude e explicar onde a eleição foi decidida.

**Site:** [talissonsousa10-ship-it.github.io/eleicao-2026](https://talissonsousa10-ship-it.github.io/eleicao-2026/). São três páginas:

1. **A eleição passou no teste:** seis testes estatísticos, a conferência dos 998.411 boletins de urna com a totalização e a checagem de 11 alegações.
2. **Onde foi decidida:** de onde vieram os votos do 2º turno, a comparação com 2022 e o perfil dos municípios.
3. **Explore sua cidade:** mapa com zoom e busca por cidade, local de votação e urna.

Autor: **Talisson Sousa de Santana**, Analista de Dados Estatísticos.

Toda mudança feita depois da primeira publicação aparece no **registro de mudanças**, no fim de cada página do site (fonte: `site/src/data/mudancas.ts`). Mudanças em números, títulos ou conclusões entram como correção, com o texto anterior.

## O que encontramos

- **Boletins de urna:** os 998.411 boletins dos dois turnos (o papel afixado na porta de cada seção) são idênticos à totalização oficial em todos os campos. Os 56 arquivos `bweb` têm o hash SHA-512 igual ao publicado pelo TSE.
- **Integridade:** nenhuma urna tem mais votos que eleitores presentes, nem mais presentes que eleitores aptos. A soma das urnas bate com o total oficial em todas as zonas.
- **Testes forenses:**
  - o último dígito dos votos é uniforme (p = 0,65 para Lula, 0,71 para Flávio);
  - o 1º turno prevê o 2º com R² de 0,99, e as 36 zonas fora do padrão se dividem em 14 a favor de Lula e 22 a favor de Flávio;
  - as urnas antigas não votam diferente das novas na mesma escola (diferença de 0,06 ponto);
  - as urnas que destoam das vizinhas são 0,13% do total e já votavam assim no 1º turno (397 de 398).
- **2022:** o mesmo padrão aparece com o sinal trocado. Bolsonaro virou 251 municípios entre os turnos; Lula virou 211 em 2026.
- **Onde foi decidida** (estimativas por inferência ecológica):
  - a virada veio de quem não tinha votado em Lula nem em Flávio no 1º turno: somados, os dois ganharam 14,1 milhões de votos, e 74% desse ganho foi de Lula (conta exata);
  - pelo modelo das urnas, o grupo que mais pesou foi o de quem não votou em ninguém (entre 6,0 e 6,2 milhões para Lula, contra 0,1 a 0,9 milhão para Flávio), e os eleitores dos outros candidatos se dividiram quase ao meio. Pelo método das zonas, os outros candidatos foram mais para Flávio (32% × 57%). A divisão entre os dois grupos é a parte menos certa;
  - o simulador da página testa sete teses de transferência, cada uma com uma faixa provável (90% de 200 reamostragens de municípios). Só duas viram o resultado: todos os eleitores dos outros candidatos indo para Flávio, ou quem não votou no 1º turno continuando sem votar;
  - comparado a 2022, Flávio cresceu nas cidades pequenas e recuou nas grandes.

**Limites:**
- Os dados mostram como cada lugar votou, não como cada pessoa votou.
- Testes estatísticos não substituem a auditoria das urnas.
- Os arquivos analisados são do próprio TSE. Falta comparar uma amostra de boletins fotografados por fiscais.

## Como refazer as contas

Requisitos: Python 3.11+ (`pip install -r requirements.txt`). Para gerar o site de novo, também Node 18+ e pnpm.

### 1. Baixe os arquivos do TSE

Os arquivos vêm do [Portal de Dados Abertos do TSE](https://dadosabertos.tse.jus.br/), conjuntos [Resultados 2026](https://dadosabertos.tse.jus.br/dataset/resultados-2026) e [Resultados 2022](https://dadosabertos.tse.jus.br/dataset/resultados-2022). Coloque-os nesta pasta ou na pasta acima.

| Arquivo | Uso |
|---|---|
| `votacao_candidato_munzona_2026_BR` | votos por zona |
| `detalhe_votacao_munzona_2026` | aptos, comparecimento, brancos e nulos por zona |
| `votacao_secao_2026_BR.zip` e `votacao_secao_2022_BR.zip` | votos por urna, com o nome e o endereço do local de votação |
| `detalhe_votacao_secao_2026.zip` | aptos, comparecimento, modelo da urna e hora de chegada do boletim |
| `dados_2022/detalhe_votacao_munzona_2022_BR.csv` | 2022 por zona |
| Boletins de urna (`bweb_*`) | baixados por `python baixar_boletins.py`, que confere o SHA-512 de cada arquivo |

### 2. Rode os programas, nesta ordem

| Programa | O que faz | Saída |
|---|---|---|
| `analisar.py` | resultado por zona, 1º e 2º turno | `analise/zona.csv` |
| `preparar_2022.py` | a mesma base para 2022 | `analise/zona_2022.csv` |
| `forense.py` (e `forense.py --ano 2022`) | testes por zona: impressão digital, novos eleitores, último dígito, Benford, consistência entre turnos | `analise/forense/` |
| `comparar_anos.py` | 2022 × 2026, município a município | `analise/comparacao_2022_2026/` |
| `preparar_secoes.py` | tabelas por urna | `dados_secao/` |
| `forense_secoes.py` | testes por urna: seções irmãs, modelo de urna, curva da apuração | `analise/forense_secoes/` |
| `conferir_boletins.py` | boletins × totalização, horários, votos manuais, prorrogação | `analise/boletins/` |
| `montar_banco.py --parquet` e `testar_banco.py` | banco DuckDB com tudo (ver `BANCO_LEIAME.md`) | `banco/` |
| `baixar_ibge.py` | indicadores do Censo 2022 e PIB 2023 por município | `dados_ibge/` |
| `analise_decisao.py` | transferências de voto, 2022 × 2026, perfil e regressão | `analise/decisao/` |
| `bootstrap_simulador.py` | 200 reamostragens das taxas usadas no simulador, para a faixa provável de cada tese | `analise/decisao/simulador_bootstrap.json` |
| `preparar_busca.py` | dados da busca do site, um arquivo por estado, conferidos com o total oficial de cada município | `docs/busca/` |

Os resultados de cada etapa já estão em `analise/`, para quem quiser conferir sem rodar tudo.

### 3. O site

O código-fonte está em `site/`. Para gerar `docs/index.html` de novo, rode `bash site/construir.sh`.

## Outras fontes

- Contornos dos municípios: [tbrugz/geodata-br](https://github.com/tbrugz/geodata-br), simplificados com mapshaper (`dados_mapa/geo_uf.mjs`).
- Códigos TSE × IBGE: [betafcc/Municipios-Brasileiros-TSE](https://github.com/betafcc/Municipios-Brasileiros-TSE).
- IBGE: [API de agregados](https://servicodados.ibge.gov.br/api/docs/agregados?versao=3), tabelas 4714, 9537, 10297 e 5938.
- Pesquisas citadas: Datafolha (6 a 8/10/2026) e Quaest (10 a 13/10/2026), com os links na página.
