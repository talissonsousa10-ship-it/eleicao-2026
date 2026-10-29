# Banco de dados `eleicoes.duckdb`

Presidente, 1º e 2º turnos de 2022 e 2026, montado a partir dos arquivos abertos do TSE.
Autor: Talisson Santana, analista de dados estatísticos.

## Onde está

Já gerado em `banco/eleicoes.duckdb` (cerca de 200 MB), com as tabelas também em `banco/parquet/` (17 MB).
Para regerar no mesmo lugar: `python montar_banco.py --parquet --arquivo banco/eleicoes.duckdb`.
Nos exemplos abaixo, use `duckdb.connect('banco/eleicoes.duckdb', read_only=True)`.

## Como gerar

```bash
pip install duckdb==1.2.2
python montar_banco.py              # banco padrão, ~20 segundos
python montar_banco.py --parquet    # também exporta cada tabela para parquet/
python montar_banco.py --completo   # inclui o voto de cada candidato em cada urna (lê os zips do TSE; demora)
```

No fim, o script confere dentro do banco que os totais batem com o resultado oficial e que
a soma das urnas é igual à de cada zona. Se algo não bater, ele para com erro.

## Tabelas

| Tabela | O que guarda | Chave |
|---|---|---|
| `eleicao` | ano, turno, data | ano, turno |
| `candidato` | número, nome na urna, partido | ano, numero |
| `municipio` | código TSE, código IBGE, nome, UF, região | cod_tse |
| `zona_apuracao` | aptos, comparecimento, abstenções, válidos, brancos e nulos por zona | ano, turno, cod_tse, zona |
| `zona_votos` | votos de cada candidato por zona | ano, turno, cod_tse, zona, numero |
| `secao` | cada seção e seu local de votação | ano, cod_tse, zona, secao |
| `secao_resultado` | votos de Lula, nº 22, outros, brancos, nulos por urna; em 2026 também aptos, comparecimento, horário do boletim e modelo da urna (pode mudar entre turnos) | ano, turno, cod_tse, zona, secao |
| `boletim_urna` (se houver `dados_bweb/`) | conteúdo do boletim de urna: votos, nº de série, horários, liberações sem biometria | ano, turno, cod_tse, zona, secao |
| `secao_votos` (só com `--completo`) | voto de cada candidato em cada urna | ano, turno, cod_tse, zona, secao, numero |

Regras que o próprio banco garante: aptos = comparecimento + abstenções + seções não instaladas;
válidos + brancos + nulos ≤ comparecimento; na urna, votos = comparecimento ≤ aptos.

"nº 22" é Bolsonaro em 2022 e Flávio em 2026.

## Consultas prontas (views)

- `resultado_brasil`, `resultado_uf`, `resultado_municipio`
- `viradas`: municípios em que o vencedor mudou entre os turnos
- `comparacao_2022_2026`: Lula no 2º turno, município a município
- `urnas_um_candidato`: urnas com votos para um só finalista
- `conferencia_urna_zona`: deve voltar vazia
- `conferencia_boletim_totalizacao`: boletins × totalização; deve voltar vazia

## Exemplos

```python
import duckdb
con = duckdb.connect('eleicoes.duckdb', read_only=True)

con.sql("SELECT * FROM resultado_brasil ORDER BY ano, turno").show()

# as 10 viradas de 2026 com maior desvantagem no 1º turno
con.sql("""
    SELECT nome, uf, margem_1t_pp, margem_2t_pp FROM viradas
    WHERE ano = 2026 ORDER BY margem_1t_pp LIMIT 10""").show()

# curva da apuração: % de Lula conforme os boletins chegavam (2º turno de 2026)
df = con.sql("""
    SELECT date_trunc('minute', hora_boletim) AS minuto,
           100.0 * sum(sum(lula)) OVER (ORDER BY minuto) / sum(sum(lula + n22 + outros)) OVER (ORDER BY minuto) AS lula_acum
    FROM secao_resultado WHERE ano = 2026 AND turno = 2 GROUP BY minuto ORDER BY minuto""").df()

# voto de Lula por modelo de urna
con.sql("""
    SELECT modelo_urna, count(*) AS urnas, round(100.0 * sum(lula) / sum(lula + n22 + outros), 2) AS lula_pct
    FROM secao_resultado WHERE ano = 2026 AND turno = 2 GROUP BY ALL ORDER BY 1""").show()
```

Também dá para abrir o arquivo em ferramentas visuais como DBeaver ou na interface do próprio DuckDB (`duckdb -ui`).
