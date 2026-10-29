"""Monta o banco analítico eleicoes.duckdb (presidente, 2022 e 2026) a partir dos arquivos do TSE.

Uso:
    pip install duckdb
    python montar_banco.py              # banco padrão (rápido): urna, zona e município
    python montar_banco.py --completo   # inclui o voto de CADA candidato em CADA urna
                                        # (lê votacao_secao_<ano>_BR.zip; demora mais)
    python montar_banco.py --parquet    # também exporta as tabelas em parquet/

Entradas (todas nesta pasta, geradas pelos scripts do projeto ou baixadas do TSE):
    votacao_candidato_munzona_2026_BR.csv
    detalhe_votacao_munzona_2026/detalhe_votacao_munzona_2026_BR.csv
    dados_2022/detalhe_votacao_munzona_2022_BR.csv
    dados_2022/votos_zona_2022.csv              (preparar_2022.py)
    dados_secao/secoes_2022.csv.gz, secoes_2026.csv.gz   (preparar_secoes.py)
    dados_mapa/municipios_brasileiros_tse.json  (código TSE → código IBGE)
    dados_bweb/*.parquet (opcional)            (conferir_boletins.py: boletins de urna)

Ao final o script confere, dentro do banco, que os números batem com o resultado oficial
e que urnas, zonas e municípios somam a mesma coisa. Se algo não bater, ele para com erro.
"""
import argparse
import json
import sys
import time
import zipfile
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent
DB = ROOT / 'eleicoes.duckdb'

REGIAO = {**dict.fromkeys(['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'], 'Norte'),
          **dict.fromkeys(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'], 'Nordeste'),
          **dict.fromkeys(['DF', 'GO', 'MS', 'MT'], 'Centro-Oeste'),
          **dict.fromkeys(['ES', 'MG', 'RJ', 'SP'], 'Sudeste'),
          **dict.fromkeys(['PR', 'RS', 'SC'], 'Sul'), 'ZZ': 'Exterior'}

# candidatos de 2022 (o arquivo por seção traz só o número)
CAND_2022 = [(13, 'LULA', 'PT'), (22, 'JAIR BOLSONARO', 'PL'), (15, 'SIMONE TEBET', 'MDB'), (12, 'CIRO GOMES', 'PDT'),
             (44, 'SORAYA THRONICKE', 'UNIÃO'), (30, "FELIPE D'AVILA", 'NOVO'), (14, 'PADRE KELMON', 'PTB'),
             (80, 'LÉO PÉRICLES', 'UP'), (21, 'SOFIA MANZANO', 'PCB'), (16, 'VERA', 'PSTU'), (27, 'CONSTITUINTE EYMAEL', 'DC')]

OFICIAL = {(2022, 2): (60345999, 58206354), (2026, 1): (53879538, 56104503), (2026, 2): (64256232, 59826041),
           (2022, 1): (57259504, 51072345)}

ESQUEMA = """
CREATE TABLE eleicao (
    ano INTEGER, turno INTEGER, data DATE NOT NULL,
    PRIMARY KEY (ano, turno));

CREATE TABLE candidato (
    ano INTEGER, numero INTEGER, nome VARCHAR NOT NULL, partido VARCHAR,
    PRIMARY KEY (ano, numero));

CREATE TABLE municipio (
    cod_tse VARCHAR PRIMARY KEY,           -- código do município no TSE (5 dígitos)
    cod_ibge VARCHAR,                      -- código IBGE (7 dígitos); vazio no exterior
    nome VARCHAR NOT NULL, uf VARCHAR NOT NULL, regiao VARCHAR NOT NULL);

-- apuração por zona eleitoral (soma das seções de cada zona dentro do município)
CREATE TABLE zona_apuracao (
    ano INTEGER, turno INTEGER, cod_tse VARCHAR, zona INTEGER,
    aptos INTEGER NOT NULL, comparecimento INTEGER NOT NULL, abstencoes INTEGER NOT NULL,
    nao_instaladas INTEGER NOT NULL, validos INTEGER NOT NULL, brancos INTEGER NOT NULL, nulos INTEGER NOT NULL,
    PRIMARY KEY (ano, turno, cod_tse, zona),
    FOREIGN KEY (ano, turno) REFERENCES eleicao (ano, turno),
    FOREIGN KEY (cod_tse) REFERENCES municipio (cod_tse),
    CHECK (aptos = comparecimento + abstencoes + nao_instaladas),
    CHECK (validos + brancos + nulos <= comparecimento));

-- votos nominais de cada candidato por zona
CREATE TABLE zona_votos (
    ano INTEGER, turno INTEGER, cod_tse VARCHAR, zona INTEGER, numero INTEGER, votos INTEGER NOT NULL,
    PRIMARY KEY (ano, turno, cod_tse, zona, numero),
    FOREIGN KEY (ano, turno, cod_tse, zona) REFERENCES zona_apuracao (ano, turno, cod_tse, zona),
    FOREIGN KEY (ano, numero) REFERENCES candidato (ano, numero),
    CHECK (votos >= 0));

-- cada seção (urna) e o local de votação onde fica
CREATE TABLE secao (
    ano INTEGER, cod_tse VARCHAR, zona INTEGER, secao INTEGER,
    local_votacao INTEGER,
    PRIMARY KEY (ano, cod_tse, zona, secao),
    FOREIGN KEY (cod_tse) REFERENCES municipio (cod_tse));

-- resultado de cada urna em cada turno
CREATE TABLE secao_resultado (
    ano INTEGER, turno INTEGER, cod_tse VARCHAR, zona INTEGER, secao INTEGER,
    lula INTEGER NOT NULL, n22 INTEGER NOT NULL, outros INTEGER NOT NULL, brancos INTEGER NOT NULL, nulos INTEGER NOT NULL,
    aptos INTEGER, comparecimento INTEGER, abstencoes INTEGER,  -- vazios em 2022 (arquivo de detalhe não carregado)
    hora_boletim TIMESTAMP, origem_voto VARCHAR, modelo_urna INTEGER,  -- só 2026 (a urna pode mudar entre turnos)
    PRIMARY KEY (ano, turno, cod_tse, zona, secao),
    FOREIGN KEY (ano, cod_tse, zona, secao) REFERENCES secao (ano, cod_tse, zona, secao),
    CHECK (comparecimento IS NULL OR comparecimento <= aptos),
    CHECK (comparecimento IS NULL OR lula + n22 + outros + brancos + nulos = comparecimento));
"""

VIEWS = """
CREATE VIEW resultado_municipio AS
SELECT z.ano, z.turno, z.cod_tse, m.nome, m.uf, m.regiao, m.cod_ibge,
       sum(z.aptos) AS aptos, sum(z.comparecimento) AS comparecimento, sum(z.validos) AS validos,
       sum(z.brancos) AS brancos, sum(z.nulos) AS nulos,
       coalesce(sum(v.lula), 0) AS lula, coalesce(sum(v.n22), 0) AS n22,
       sum(z.validos) - coalesce(sum(v.lula), 0) - coalesce(sum(v.n22), 0) AS outros
FROM zona_apuracao z
JOIN municipio m USING (cod_tse)
LEFT JOIN (SELECT ano, turno, cod_tse, zona,
             coalesce(sum(votos) FILTER (WHERE numero = 13), 0) AS lula, coalesce(sum(votos) FILTER (WHERE numero = 22), 0) AS n22
      FROM zona_votos GROUP BY ALL) v USING (ano, turno, cod_tse, zona)
GROUP BY ALL;

CREATE VIEW resultado_uf AS
SELECT ano, turno, uf, regiao, sum(aptos) AS aptos, sum(comparecimento) AS comparecimento, sum(validos) AS validos,
       sum(lula) AS lula, sum(n22) AS n22, round(100.0 * sum(lula) / sum(validos), 2) AS lula_pct
FROM resultado_municipio GROUP BY ALL;

CREATE VIEW resultado_brasil AS
SELECT ano, turno, sum(aptos) AS aptos, sum(comparecimento) AS comparecimento, sum(validos) AS validos,
       sum(lula) AS lula, sum(n22) AS n22, sum(lula) - sum(n22) AS margem,
       round(100.0 * sum(lula) / sum(validos), 2) AS lula_pct, round(100.0 * sum(n22) / sum(validos), 2) AS n22_pct
FROM resultado_municipio GROUP BY ALL;

-- municípios em que o vencedor entre os dois finalistas mudou do 1º para o 2º turno
CREATE VIEW viradas AS
SELECT t1.ano, t1.cod_tse, t1.nome, t1.uf,
       CASE WHEN t1.lula < t1.n22 THEN 'para Lula' ELSE 'para o nº 22' END AS sentido,
       round(100.0 * (t1.lula - t1.n22) / t1.validos, 2) AS margem_1t_pp,
       round(100.0 * (t2.lula - t2.n22) / t2.validos, 2) AS margem_2t_pp
FROM resultado_municipio t1
JOIN resultado_municipio t2 ON t1.ano = t2.ano AND t1.cod_tse = t2.cod_tse AND t1.turno = 1 AND t2.turno = 2
WHERE t1.uf <> 'ZZ' AND sign(t1.lula - t1.n22) <> sign(t2.lula - t2.n22) AND t1.lula <> t1.n22 AND t2.lula <> t2.n22;

-- Lula no 2º turno de 2022 × 2026, por município
CREATE VIEW comparacao_2022_2026 AS
SELECT a.cod_tse, a.nome, a.uf, a.regiao,
       round(100.0 * a.lula / a.validos, 2) AS lula_2022_pct, round(100.0 * b.lula / b.validos, 2) AS lula_2026_pct,
       round(100.0 * b.lula / b.validos - 100.0 * a.lula / a.validos, 2) AS mudanca_pp, b.aptos AS aptos_2026
FROM resultado_municipio a JOIN resultado_municipio b USING (cod_tse)
WHERE a.ano = 2022 AND a.turno = 2 AND b.ano = 2026 AND b.turno = 2 AND a.uf <> 'ZZ';

-- urnas com votos para um só finalista (2º turno)
CREATE VIEW urnas_um_candidato AS
SELECT r.*, m.nome AS municipio, m.uf, CASE WHEN n22 = 0 THEN 'só Lula' ELSE 'só nº 22' END AS caso
FROM secao_resultado r JOIN municipio m USING (cod_tse)
WHERE r.turno = 2 AND lula + n22 + outros > 0 AND (n22 = 0 OR lula = 0);

-- conferência: soma das urnas × zona (ausência = 0 votos). Deve voltar VAZIA.
CREATE VIEW conferencia_urna_zona AS
WITH s AS (SELECT ano, turno, cod_tse, zona, sum(lula) AS lula, sum(n22) AS n22 FROM secao_resultado GROUP BY ALL),
     z AS (SELECT ano, turno, cod_tse, zona, coalesce(sum(votos) FILTER (WHERE numero = 13), 0) AS lula,
                  coalesce(sum(votos) FILTER (WHERE numero = 22), 0) AS n22 FROM zona_votos GROUP BY ALL)
SELECT ano, turno, cod_tse, zona, coalesce(s.lula, 0) AS lula_urnas, coalesce(z.lula, 0) AS lula_zona,
       coalesce(s.n22, 0) AS n22_urnas, coalesce(z.n22, 0) AS n22_zona
FROM s FULL JOIN z USING (ano, turno, cod_tse, zona)
WHERE coalesce(s.lula, 0) <> coalesce(z.lula, 0) OR coalesce(s.n22, 0) <> coalesce(z.n22, 0);
"""


def p(*partes):
    return (ROOT.joinpath(*partes)).as_posix()


def carregar(con):
    con.execute("INSERT INTO eleicao VALUES (2022,1,'2022-10-02'),(2022,2,'2022-10-30'),(2026,1,'2026-10-04'),(2026,2,'2026-10-25')")

    # candidatos
    con.executemany('INSERT INTO candidato VALUES (2022, ?, ?, ?)', CAND_2022)
    con.execute(f"""
        INSERT INTO candidato
        SELECT DISTINCT 2026, NR_CANDIDATO::INT, NM_URNA_CANDIDATO, SG_PARTIDO
        FROM read_csv('{p('votacao_candidato_munzona_2026_BR.csv')}', delim=';', header=true, encoding='latin-1', all_varchar=true)""")

    # municípios: nomes dos arquivos de zona + código IBGE do de-para
    cw = json.loads((ROOT / 'dados_mapa' / 'municipios_brasileiros_tse.json').read_text(encoding='utf-8'))
    con.execute('CREATE TEMP TABLE depara (cod_tse VARCHAR, cod_ibge VARCHAR)')
    con.executemany('INSERT INTO depara VALUES (?, ?)', [(str(int(r['codigo_tse'])).zfill(5), str(r['codigo_ibge'])) for r in cw])
    con.execute('CREATE TEMP TABLE reg (uf VARCHAR, regiao VARCHAR)')
    con.executemany('INSERT INTO reg VALUES (?, ?)', list(REGIAO.items()))
    con.execute(f"""
        CREATE TEMP TABLE det26 AS SELECT * FROM read_csv('{p('detalhe_votacao_munzona_2026', 'detalhe_votacao_munzona_2026_BR.csv')}',
            delim=';', header=true, encoding='latin-1', all_varchar=true);
        CREATE TEMP TABLE det22 AS SELECT * FROM read_csv('{p('dados_2022', 'detalhe_votacao_munzona_2022_BR.csv')}',
            delim=';', header=true, encoding='latin-1', all_varchar=true) WHERE CD_CARGO = '1';
        INSERT INTO municipio
        SELECT cod, d.cod_ibge, any_value(nome), any_value(uf), any_value(r.regiao)
        FROM (SELECT lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0') AS cod, NM_MUNICIPIO AS nome, SG_UF AS uf FROM det26
              UNION ALL
              SELECT lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NM_MUNICIPIO, SG_UF FROM det22) x
        LEFT JOIN depara d ON d.cod_tse = x.cod LEFT JOIN reg r USING (uf)
        GROUP BY cod, d.cod_ibge""")

    # apuração por zona (somando voto em trânsito e normal)
    for tab, ano in (('det26', 2026), ('det22', 2022)):
        con.execute(f"""
            INSERT INTO zona_apuracao
            SELECT {ano}, NR_TURNO::INT, lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NR_ZONA::INT,
                   sum(QT_APTOS::INT), sum(QT_COMPARECIMENTO::INT), sum(QT_ABSTENCOES::INT),
                   sum(QT_ELEITORES_SECOES_NAO_INSTALADAS::INT), sum(QT_TOTAL_VOTOS_VALIDOS::INT),
                   sum(QT_VOTOS_BRANCOS::INT), sum(QT_TOTAL_VOTOS_NULOS::INT)
            FROM {tab} GROUP BY ALL""")

    # votos por candidato e zona
    con.execute(f"""
        INSERT INTO zona_votos
        SELECT 2026, NR_TURNO::INT, lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NR_ZONA::INT, NR_CANDIDATO::INT,
               sum(QT_VOTOS_NOMINAIS_VALIDOS::INT)
        FROM read_csv('{p('votacao_candidato_munzona_2026_BR.csv')}', delim=';', header=true, encoding='latin-1', all_varchar=true)
        GROUP BY ALL""")
    con.execute(f"""
        INSERT INTO zona_votos
        SELECT 2022, NR_TURNO, lpad(CD_MUNICIPIO::VARCHAR, 5, '0'), NR_ZONA, NR_VOTAVEL, sum(QT_VOTOS)
        FROM read_csv('{p('dados_2022', 'votos_zona_2022.csv')}', delim=';', header=true)
        WHERE NR_VOTAVEL NOT IN (95, 96, 97) GROUP BY ALL""")

    # seções e resultado por urna
    for ano in (2022, 2026):
        src = p('dados_secao', f'secoes_{ano}.csv.gz')
        filtro = "WHERE _origem IS DISTINCT FROM 'right_only'" if ano == 2026 else ''
        modelo = "nullif(CD_MODELO_URNA::INT, -1)" if ano == 2026 else 'NULL'
        con.execute(f"CREATE TEMP TABLE s{ano} AS SELECT * FROM read_csv('{src}', delim=';', header=true, all_varchar=true) {filtro}")
        con.execute(f"""
            INSERT INTO secao
            SELECT {ano}, lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NR_ZONA::INT, NR_SECAO::INT,
                   any_value(NR_LOCAL_VOTACAO::INT)
            FROM s{ano} GROUP BY ALL""")
        extra = ("QT_APTOS::DOUBLE::INT, QT_COMPARECIMENTO::DOUBLE::INT, QT_ABSTENCOES::DOUBLE::INT, "
                 "strptime(DT_RECEBIMENTO_BU_HOR_TSE, '%d/%m/%Y %H:%M:%S'), DS_ORIGEM_VOTO, " + modelo) if ano == 2026 \
            else 'NULL, NULL, NULL, NULL, NULL, NULL'
        con.execute(f"""
            INSERT INTO secao_resultado
            SELECT {ano}, NR_TURNO::INT, lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NR_ZONA::INT, NR_SECAO::INT,
                   lula::DOUBLE::INT, n22::DOUBLE::INT, outros::DOUBLE::INT, brancos::DOUBLE::INT, nulos::DOUBLE::INT, {extra}
            FROM s{ano}""")


def carregar_completo(con):
    """Voto de cada candidato em cada urna, direto dos zips do TSE (opcional, mais pesado)."""
    con.execute("""CREATE TABLE IF NOT EXISTS secao_votos (
        ano INTEGER, turno INTEGER, cod_tse VARCHAR, zona INTEGER, secao INTEGER, numero INTEGER, votos INTEGER,
        PRIMARY KEY (ano, turno, cod_tse, zona, secao, numero))""")
    for ano in (2022, 2026):
        zp = next((c for c in (ROOT / f'votacao_secao_{ano}_BR.zip', ROOT.parent / f'votacao_secao_{ano}_BR.zip',
                               ROOT / 'dados_secao' / f'votacao_secao_{ano}_BR.zip') if c.exists()), None)
        if zp is None:
            print(f'  {ano}: votacao_secao_{ano}_BR.zip não encontrado, pulando')
            continue
        csvs = sorted(ROOT.glob(f'_tmp_secao_{ano}.csv'))
        alvo = ROOT / f'_tmp_secao_{ano}.csv'
        if not csvs:
            print(f'  {ano}: extraindo {zp.name} (pode levar alguns minutos)...')
            with zipfile.ZipFile(zp) as z, alvo.open('wb') as out:
                nome = next(n for n in z.namelist() if n.endswith('.csv'))
                with z.open(nome) as f:
                    while chunk := f.read(16 << 20):
                        out.write(chunk)
        con.execute(f"""
            INSERT INTO secao_votos
            SELECT {ano}, NR_TURNO::INT, lpad(CD_MUNICIPIO::INT::VARCHAR, 5, '0'), NR_ZONA::INT, NR_SECAO::INT,
                   NR_VOTAVEL::INT, sum(QT_VOTOS::INT)
            FROM read_csv('{alvo.as_posix()}', delim=';', header=true, encoding='latin-1', all_varchar=true)
            WHERE CD_CARGO = '1' GROUP BY ALL""")
        alvo.unlink(missing_ok=True)


def carregar_boletins(con):
    """Boletins de urna (arquivos bweb), se conferir_boletins.py já tiver gerado dados_bweb/*.parquet."""
    arqs = sorted((ROOT / 'dados_bweb').glob('bu_*_*t.parquet'))
    if not arqs:
        return 0
    con.execute("""CREATE TABLE boletim_urna (
        ano INTEGER, turno INTEGER, uf VARCHAR, cod_tse VARCHAR, zona INTEGER, secao INTEGER, local_votacao INTEGER,
        lula INTEGER, n22 INTEGER, outros INTEGER, brancos INTEGER, nulos INTEGER, aptos INTEGER, comparecimento INTEGER,
        nr_urna VARCHAR, carga VARCHAR, abertura TIMESTAMP, encerramento TIMESTAMP, emissao_bu TIMESTAMP,
        sem_biometria INTEGER, secoes_agregadas VARCHAR,
        PRIMARY KEY (ano, turno, cod_tse, zona, secao))""")
    for a in arqs:
        uf, t = a.stem.split('_')[1].upper(), int(a.stem.split('_')[2][0])
        con.execute(f"""INSERT INTO boletim_urna SELECT 2026, {t}, '{uf}', lpad(cod_mun::VARCHAR, 5, '0'), zona, secao, local_votacao,
            lula, n22, outros, brancos, nulos, aptos, comparecimento, nr_urna, carga, abertura, encerramento, emissao_bu,
            sem_biometria, secoes_agregadas FROM '{a.as_posix()}'""")
    con.execute("""CREATE VIEW conferencia_boletim_totalizacao AS
        SELECT b.ano, b.turno, b.uf, coalesce(b.cod_tse, r.cod_tse) AS cod_tse, coalesce(b.zona, r.zona) AS zona,
               coalesce(b.secao, r.secao) AS secao, b.lula AS lula_bu, r.lula AS lula_tot, b.n22 AS n22_bu, r.n22 AS n22_tot
        FROM boletim_urna b
        FULL JOIN (SELECT r.* FROM secao_resultado r JOIN municipio m USING (cod_tse)
                   WHERE r.ano = 2026 AND (r.turno, m.uf) IN (SELECT DISTINCT turno, uf FROM boletim_urna)) r
          ON b.turno = r.turno AND b.cod_tse = r.cod_tse AND b.zona = r.zona AND b.secao = r.secao
        WHERE b.secao IS NULL OR r.secao IS NULL OR (b.lula, b.n22, b.outros, b.brancos, b.nulos, b.aptos, b.comparecimento)
              <> (r.lula, r.n22, r.outros, r.brancos, r.nulos, r.aptos, r.comparecimento)""")
    return len(arqs)


def conferir(con):
    erros = []
    for (ano, turno), (l, f) in OFICIAL.items():
        r = con.execute('SELECT lula, n22 FROM resultado_brasil WHERE ano=? AND turno=?', [ano, turno]).fetchone()
        if r is None or tuple(r) != (l, f):
            erros.append(f'{ano} {turno}º turno: banco {r} × oficial {(l, f)}')
    n = con.execute('SELECT count(*) FROM conferencia_urna_zona').fetchone()[0]
    if n:
        erros.append(f'{n} zonas em que a soma das urnas não bate com a zona')
    v = dict(con.execute("SELECT ano || ' ' || sentido, count(*) FROM viradas GROUP BY ALL").fetchall())
    u = dict(con.execute("SELECT ano || ' ' || caso, count(*) FROM urnas_um_candidato GROUP BY ALL").fetchall())
    return erros, v, u


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--completo', action='store_true', help='inclui voto por candidato em cada urna (zips do TSE)')
    ap.add_argument('--parquet', action='store_true', help='exporta as tabelas para parquet/')
    ap.add_argument('--arquivo', help='onde gravar o banco (padrão: eleicoes.duckdb nesta pasta)')
    a = ap.parse_args()
    global DB
    if a.arquivo:
        DB = Path(a.arquivo).resolve()
    t0 = time.time()
    DB.unlink(missing_ok=True)
    con = duckdb.connect(DB.as_posix())
    con.execute(ESQUEMA)
    print('Carregando tabelas...')
    carregar(con)
    if a.completo:
        print('Carregando voto por candidato em cada urna...')
        carregar_completo(con)
    con.execute(VIEWS)
    nb = carregar_boletins(con)
    erros, viradas, um = conferir(con)
    if nb:
        dif = con.execute('SELECT count(*) FROM conferencia_boletim_totalizacao').fetchone()[0]
        print(f'Boletins de urna: {nb} arquivo(s), {con.execute("SELECT count(*) FROM boletim_urna").fetchone()[0]:,} boletins, '
              f'{dif} diferenças com a totalização'.replace(',', '.'))
        if dif:
            erros.append(f'{dif} urnas com boletim diferente da totalização')
    for t in ('eleicao', 'candidato', 'municipio', 'zona_apuracao', 'zona_votos', 'secao', 'secao_resultado') + (('boletim_urna',) if nb else ()):
        print(f'  {t:<16} {con.execute(f"SELECT count(*) FROM {t}").fetchone()[0]:>10,}'.replace(',', '.'))
    print('Viradas:', viradas)
    print('Urnas com votos para um só finalista (2º turno):', um)
    if a.parquet:
        out = DB.parent / 'parquet'
        out.mkdir(exist_ok=True)
        tabs = [r[0] for r in con.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='main' AND table_type='BASE TABLE'").fetchall()]
        for t in tabs:
            con.execute(f"COPY {t} TO '{(out / (t + '.parquet')).as_posix()}' (FORMAT parquet, COMPRESSION zstd)")
        print(f'Parquet: {len(tabs)} tabelas em {out.name}/')
    con.close()
    if erros:
        print('ERRO na conferência:\n  ' + '\n  '.join(erros))
        sys.exit(1)
    print(f'OK: totais oficiais conferidos e urnas = zonas. {DB.name} ({DB.stat().st_size / 1e6:.0f} MB) em {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
