"""Confere os Boletins de Urna (arquivos bweb do TSE) com a totalização, urna por urna.

O boletim de urna (BU) é o papel que cada urna imprime ao encerrar a votação e que fica afixado
na porta da seção, com QR Code. O arquivo bweb traz o conteúdo de cada BU. Este script verifica:
  1. se todas as urnas da totalização têm boletim, e vice-versa;
  2. se votos de cada candidato, brancos, nulos, aptos e comparecimento são idênticos;
  3. se números de série e códigos de carga das urnas não se repetem;
  4. horários de abertura e encerramento;
  5. "votos manuais": urnas com mais eleitores liberados sem biometria dão mais votos a Lula
     do que as urnas vizinhas do mesmo local?
  6. horários na hora de Brasília (o boletim usa a hora local) e as urnas que ficaram abertas até as 19h
     no 2º turno: quanto pesaram e se votaram diferente do resto da cidade.

Uso: python conferir_boletins.py            (procura bweb_*.zip nesta pasta e na pasta acima)
     python conferir_boletins.py --so-resumo (refaz só o resumo nacional, sem reler os zips)
Entradas: bweb_<turno>t_<UF>_*.zip, dados_secao/secoes_2026.csv.gz (preparar_secoes.py)
Saídas: dados_bweb/bu_<uf>_<turno>t.parquet e analise/boletins/resultados.json
Dependências: duckdb, numpy, pandas
"""
import hashlib
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'analise' / 'boletins'
DADOS = ROOT / 'dados_bweb'
SECOES = ROOT / 'dados_secao' / 'secoes_2026.csv.gz'


def ler_bweb(zp: Path, con):
    """Extrai só os boletins de presidente para parquet (o CSV completo tem ~2 GB)."""
    m = re.search(r'bweb_(\d)t_([A-Z]{2})_', zp.name)
    turno, uf = int(m.group(1)), m.group(2)
    destino = DADOS / f'bu_{uf.lower()}_{turno}t.parquet'
    if destino.exists():
        return uf, turno, destino
    with tempfile.TemporaryDirectory() as tmp, zipfile.ZipFile(zp) as z:
        nome = next(n for n in z.namelist() if n.endswith('.csv'))
        csv = Path(tmp) / 'bweb.csv'
        # copia só o cabeçalho e as linhas de presidente (CD_CARGO_PERGUNTA = 1, 17ª coluna)
        with z.open(nome) as f, csv.open('wb') as out:
            cab = f.readline()
            out.write(cab)
            col = [c.strip(b'"') for c in cab.rstrip(b'\r\n').split(b';')].index(b'CD_CARGO_PERGUNTA')
            for linha in f:
                if linha.split(b';', col + 1)[col].strip(b'"') == b'1':
                    out.write(linha)
        con.execute(f"""
            COPY (
              SELECT CD_MUNICIPIO::INT AS cod_mun, NR_ZONA::INT AS zona, NR_SECAO::INT AS secao,
                any_value(NR_LOCAL_VOTACAO::INT) AS local_votacao,
                sum(CASE WHEN CD_TIPO_VOTAVEL='1' AND NR_VOTAVEL='13' THEN QT_VOTOS::INT ELSE 0 END) AS lula,
                sum(CASE WHEN CD_TIPO_VOTAVEL='1' AND NR_VOTAVEL='22' THEN QT_VOTOS::INT ELSE 0 END) AS n22,
                sum(CASE WHEN CD_TIPO_VOTAVEL='1' AND NR_VOTAVEL NOT IN ('13','22') THEN QT_VOTOS::INT ELSE 0 END) AS outros,
                sum(CASE WHEN CD_TIPO_VOTAVEL='2' THEN QT_VOTOS::INT ELSE 0 END) AS brancos,
                sum(CASE WHEN CD_TIPO_VOTAVEL='3' THEN QT_VOTOS::INT ELSE 0 END) AS nulos,
                any_value(QT_APTOS::INT) AS aptos, any_value(QT_COMPARECIMENTO::INT) AS comparecimento,
                count(DISTINCT QT_APTOS) AS versoes_aptos,
                any_value(NR_URNA_EFETIVADA) AS nr_urna,
                any_value(CD_CARGA_1_URNA_EFETIVADA || CD_CARGA_2_URNA_EFETIVADA) AS carga,
                any_value(DS_TIPO_URNA) AS tipo_urna,
                any_value(strptime(DT_ABERTURA, '%Y-%m-%d %H:%M:%S')) AS abertura,
                any_value(strptime(DT_ENCERRAMENTO, '%Y-%m-%d %H:%M:%S')) AS encerramento,
                any_value(strptime(DT_EMISSAO_BU, '%Y-%m-%d %H:%M:%S')) AS emissao_bu,
                any_value(QT_ELEI_BIOM_SEM_HABILITACAO::INT) AS sem_biometria,
                any_value(DS_SECOES_AGREGADAS) AS secoes_agregadas
              FROM read_csv('{csv.as_posix()}', delim=';', header=true, encoding='latin-1', all_varchar=true)
              WHERE CD_CARGO_PERGUNTA = '1'
              GROUP BY 1, 2, 3
            ) TO '{destino.as_posix()}' (FORMAT parquet)""")
    return uf, turno, destino


def assinatura(zp: Path):
    """Compara o SHA-512 do zip com o .sha512 publicado pelo TSE (se estiver ao lado)."""
    f = zp.with_name(zp.name + '.sha512')
    if not f.exists():
        return None
    h = hashlib.sha512()
    with zp.open('rb') as arq:
        while b := arq.read(8 << 20):
            h.update(b)
    return h.hexdigest() == f.read_text().split()[0]


def conferir(uf, turno, pq, con):
    con.execute(f"CREATE OR REPLACE TEMP TABLE bu AS SELECT * FROM '{pq.as_posix()}'")
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE tot AS
        SELECT CD_MUNICIPIO::INT cod_mun, NR_ZONA::INT zona, NR_SECAO::INT secao,
               lula::DOUBLE::INT lula, n22::DOUBLE::INT n22, outros::DOUBLE::INT outros, brancos::DOUBLE::INT brancos,
               nulos::DOUBLE::INT nulos, QT_APTOS::DOUBLE::INT aptos, QT_COMPARECIMENTO::DOUBLE::INT comparecimento
        FROM read_csv('{SECOES.as_posix()}', delim=';', header=true, all_varchar=true)
        WHERE SG_UF = '{uf}' AND NR_TURNO = '{turno}' AND _origem IS DISTINCT FROM 'right_only'""")
    q = lambda s: con.execute(s).fetchone()
    cmp = q("""
        SELECT count(*) FILTER (WHERE b.secao IS NULL), count(*) FILTER (WHERE t.secao IS NULL),
               count(*) FILTER (WHERE b.secao IS NOT NULL AND t.secao IS NOT NULL AND
                    (b.lula, b.n22, b.outros, b.brancos, b.nulos) <> (t.lula, t.n22, t.outros, t.brancos, t.nulos)),
               count(*) FILTER (WHERE b.secao IS NOT NULL AND t.secao IS NOT NULL AND
                    (b.aptos, b.comparecimento) <> (t.aptos, t.comparecimento))
        FROM bu b FULL JOIN tot t USING (cod_mun, zona, secao)""")
    tb = q('SELECT count(*), sum(lula), sum(n22), sum(outros), sum(brancos), sum(nulos), sum(aptos), sum(comparecimento) FROM bu')
    tt = q('SELECT count(*), sum(lula), sum(n22), sum(outros), sum(brancos), sum(nulos), sum(aptos), sum(comparecimento) FROM tot')
    res = {
        'uf': uf, 'turno': turno, 'boletins': int(tb[0]),
        'totais_boletins': dict(zip(['urnas', 'lula', 'n22', 'outros', 'brancos', 'nulos', 'aptos', 'comparecimento'], map(int, tb))),
        'totais_totalizacao': dict(zip(['urnas', 'lula', 'n22', 'outros', 'brancos', 'nulos', 'aptos', 'comparecimento'], map(int, tt))),
        'urnas_so_na_totalizacao': cmp[0], 'urnas_so_nos_boletins': cmp[1],
        'urnas_com_votos_diferentes': cmp[2], 'urnas_com_aptos_ou_comparecimento_diferentes': cmp[3],
        'numeros_de_urna_repetidos': q('SELECT count(*) FROM (SELECT nr_urna FROM bu GROUP BY 1 HAVING count(*) > 1)')[0],
        'codigos_de_carga_repetidos': q('SELECT count(*) FROM (SELECT carga FROM bu GROUP BY 1 HAVING count(*) > 1)')[0],
        'urnas_nao_apuradas': q("SELECT count(*) FROM bu WHERE tipo_urna <> 'Apurada'")[0],
        'abertura_mais_cedo': str(q('SELECT min(abertura) FROM bu')[0]),
        'urnas_abertas_antes_das_8h': q("SELECT count(*) FROM bu WHERE strftime(abertura, '%H:%M:%S') < '08:00:00'")[0],
        'urnas_encerradas_antes_das_17h': q("SELECT count(*) FROM bu WHERE strftime(encerramento, '%H:%M:%S') < '17:00:00'")[0],
        'urnas_encerradas_depois_das_17h10': q("SELECT count(*) FROM bu WHERE strftime(encerramento, '%H:%M:%S') > '17:10:00'")[0],
        'encerramento_mais_tarde': str(q('SELECT max(encerramento) FROM bu')[0]),
        'urnas_encerradas_depois_das_19h': q("SELECT count(*) FROM bu WHERE strftime(encerramento, '%H:%M:%S') > '19:00:00'")[0],
        'eleitores_liberados_sem_biometria': int(q('SELECT sum(sem_biometria) FROM bu')[0]),
        'pct_sem_biometria': round(float(q('SELECT 100.0 * sum(sem_biometria) / sum(comparecimento) FROM bu')[0]), 2),
    }
    res['bate_100pct'] = all(res[k] == 0 for k in ('urnas_so_na_totalizacao', 'urnas_so_nos_boletins',
                                                     'urnas_com_votos_diferentes', 'urnas_com_aptos_ou_comparecimento_diferentes'))

    # "votos manuais": urnas com mais liberação sem biometria que as vizinhas dão mais votos a Lula?
    d = con.execute('SELECT * FROM bu').df()
    d['validos'] = d.lula + d.n22 + d.outros
    d = d[(d.validos >= 50) & (d.comparecimento > 0)].copy()
    d['sb'] = 100 * d.sem_biometria / d.comparecimento
    d['pl'] = 100 * d.lula / d.validos
    d['pf'] = 100 * d.n22 / d.validos
    k = ['cod_mun', 'zona', 'local_votacao']
    d['n'] = d.groupby(k).secao.transform('size')
    d = d[d.n >= 3].copy()
    for c in ('sb', 'pl', 'pf'):
        s = d.groupby(k)[c].transform('sum')
        d[c + '_dev'] = d[c] - (s - d[c]) / (d.n - 1)   # diferença para a média das vizinhas
    if len(d) < 50:
        res['votos_manuais'] = {'urnas_testadas': int(len(d)), 'obs': 'poucas urnas para o teste'}
        return res
    d['quintil'] = pd.qcut(d.sb_dev.rank(method='first'), 5, labels=['Q1', 'Q2', 'Q3', 'Q4', 'Q5'])
    qt = d.groupby('quintil', observed=True).agg(urnas=('secao', 'size'), sem_biometria_vs_vizinhas_pp=('sb_dev', 'mean'),
                                                 lula_vs_vizinhas_pp=('pl_dev', 'mean')).round(3)
    res['votos_manuais'] = {
        'urnas_testadas': int(len(d)), 'locais': int(d.groupby(k).ngroups),
        'lula_pp_por_pp_sem_biometria': round(float(np.polyfit(d.sb_dev, d.pl_dev, 1)[0]), 3),
        'flavio_pp_por_pp_sem_biometria': round(float(np.polyfit(d.sb_dev, d.pf_dev, 1)[0]), 3),
        'se_fosse_fraude_para_lula': '~1 ponto de Lula por ponto de liberação manual',
        'correlacao_dentro_do_local': round(float(np.corrcoef(d.sb_dev, d.pl_dev)[0, 1]), 3),
        'por_quintil': qt.reset_index().to_dict('records')}
    return res


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    if '--so-resumo' in sys.argv:   # refaz só o resumo nacional a partir de resultados.json e dos parquet já gerados
        return resumir(json.loads((OUT / 'resultados.json').read_text(encoding='utf-8')), duckdb.connect())
    DADOS.mkdir(exist_ok=True)
    zips = sorted({*ROOT.glob('bweb_*t_*_*.zip'), *ROOT.parent.glob('bweb_*t_*_*.zip')})
    if not zips:
        raise SystemExit('Nenhum arquivo bweb_*.zip encontrado (baixe em dadosabertos.tse.jus.br, conjunto "Boletim de urna").')
    con = duckdb.connect()
    todos = []
    for zp in zips:
        print(f'{zp.name}: ', end='', flush=True)
        ok_hash = assinatura(zp)
        uf, turno, pq = ler_bweb(zp, con)
        r = conferir(uf, turno, pq, con)
        r['arquivo'], r['assinatura_sha512_confere'] = zp.name, ok_hash
        todos.append(r)
        print(f"{r['boletins']:,} boletins · assinatura {'OK' if ok_hash else ('?' if ok_hash is None else 'NÃO CONFERE')} · "
              f"bate 100%: {r['bate_100pct']}".replace(',', '.'))
    (OUT / 'resultados.json').write_text(json.dumps(todos, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    resumir(todos, con)



def prorrogacao(con, margem_lula):
    """2º turno: urnas que ficaram abertas até cerca das 19h (horário estendido em algumas cidades).
    Quanto votaram, para quem, e se mudaram de um turno para o outro diferente das outras urnas da mesma cidade."""
    lista = lambda t: ', '.join("'%s'" % p.as_posix() for p in sorted(DADOS.glob(f'bu_*_{t}t.parquet')))
    con.execute(f"""CREATE OR REPLACE TEMP TABLE pj AS
        WITH b1 AS (SELECT * FROM read_parquet([{lista(1)}], filename=true)),
             b2 AS (SELECT * FROM read_parquet([{lista(2)}], filename=true))
        SELECT regexp_extract(b2.filename, 'bu_([a-z]{{2}})_', 1) uf, b2.cod_mun, b2.comparecimento, b2.lula l2, b2.n22 f2,
               b2.lula::DOUBLE / nullif(b2.lula + b2.n22, 0) p2, b1.lula::DOUBLE / nullif(b1.lula + b1.n22, 0) p1,
               strftime(b2.encerramento, '%H:%M') >= '18:58' tarde
        FROM b2 JOIN b1 ON regexp_extract(b1.filename, 'bu_([a-z]{{2}})_', 1) = regexp_extract(b2.filename, 'bu_([a-z]{{2}})_', 1)
             AND b1.cod_mun = b2.cod_mun AND b1.zona = b2.zona AND b1.secao = b2.secao
        WHERE b2.encerramento IS NOT NULL""")
    urnas, eleitores, lula, flavio = con.execute('SELECT count(*), sum(comparecimento), sum(l2), sum(f2) FROM pj WHERE tarde').fetchone()
    did = con.execute("""WITH m AS (SELECT uf, cod_mun, count(*) FILTER (WHERE tarde) nt,
            avg(p2) FILTER (WHERE tarde) - avg(p2) FILTER (WHERE NOT tarde) g2, avg(p1) FILTER (WHERE tarde) - avg(p1) FILTER (WHERE NOT tarde) g1
            FROM pj GROUP BY ALL)
        SELECT 100 * sum(nt * (g2 - g1)) / sum(nt) FROM m WHERE nt > 0 AND g2 IS NOT NULL AND g1 IS NOT NULL""").fetchone()[0]
    cidades = con.execute("""SELECT upper(uf) uf, cod_mun, count(*) urnas FROM pj WHERE tarde GROUP BY ALL ORDER BY urnas DESC LIMIT 10""").df()
    return {'criterio': 'urnas do 2º turno encerradas às 18h58 ou depois (hora local)',
            'urnas': int(urnas), 'eleitores_que_votaram': int(eleitores), 'lula': int(lula), 'flavio': int(flavio),
            'lula_pct': round(100 * lula / (lula + flavio), 2), 'saldo_lula': int(lula - flavio),
            'margem_lula_sem_essas_urnas': int(margem_lula - (lula - flavio)),
            'mudanca_1t_2t_vs_resto_da_cidade_pp': round(float(did), 3),
            'cidades_com_mais_urnas': cidades.to_dict('records')}


FAIXAS = [('ate_17h15', 0, 17 * 60 + 15), ('17h15_18h', 17 * 60 + 15, 18 * 60), ('18h_19h', 18 * 60, 19 * 60), ('depois_19h', 19 * 60, 99 * 60)]


def resumir(todos, con):
    """Resumo por turno do Brasil inteiro, com horários na hora de Brasília e o teste das urnas que fecharam tarde."""
    resumo = {}
    for t in sorted({r['turno'] for r in todos}):
        rs = [r for r in todos if r['turno'] == t]
        pqs = [(DADOS / ('bu_%s_%dt.parquet' % (r['uf'].lower(), t))).as_posix() for r in rs]
        lista = ', '.join("'%s'" % x for x in pqs)
        con.execute(f"CREATE OR REPLACE TEMP VIEW bt AS SELECT * FROM read_parquet([{lista}], filename=true)")
        # O boletim registra a hora LOCAL. A votação vai das 8h às 17h de Brasília, então em MT, MS, RO, RR e AM
        # a urna abre às 7h locais e no AC (e oeste do AM) às 6h. No exterior vale a hora local do país.
        # Deslocamento de cada município = 8 - hora de abertura mais comum ali.
        con.execute("""CREATE OR REPLACE TEMP TABLE fuso AS SELECT filename, cod_mun, 8 - mode(hour(abertura)) desloc
                       FROM bt WHERE abertura IS NOT NULL GROUP BY ALL""")
        con.execute("""CREATE OR REPLACE TEMP TABLE bh AS SELECT bt.*, coalesce(desloc, 0) desloc,
                         (hour(abertura) + desloc) * 60 + minute(abertura) abre_bsb,
                         (hour(encerramento) + desloc) * 60 + minute(encerramento) fecha_bsb
                       FROM bt LEFT JOIN fuso USING (filename, cod_mun)""")
        q = lambda sql: con.execute(sql).fetchone()[0]
        # urnas que fecharam tarde (fila às 17h) x vizinhas do mesmo local de votação
        tarde = con.execute(f"""
            WITH g AS (SELECT *, lula + n22 v, sum(lula) OVER w sl, sum(lula + n22) OVER w sv, count(*) OVER w n
                       FROM bh WHERE fecha_bsb IS NOT NULL
                       WINDOW w AS (PARTITION BY filename, cod_mun, zona, local_votacao))
            SELECT CASE {' '.join(f"WHEN fecha_bsb >= {a} AND fecha_bsb < {b} THEN '{nome}'" for nome, a, b in FAIXAS)} END faixa,
                   count(*) urnas, round(100.0 * sum(lula) / sum(v), 2) lula_pct,
                   round(100 * avg(lula / v - (sl - lula) / (sv - v)), 3) lula_vs_vizinhas_pp,
                   round(avg(comparecimento)) comparecimento_medio
            FROM g WHERE n > 1 AND v > 0 AND sv - v > 0 GROUP BY 1""").df()
        tarde['ordem'] = tarde.faixa.map({f[0]: i for i, f in enumerate(FAIXAS)})
        tarde = tarde.sort_values('ordem').drop(columns='ordem')
        repetidas = con.execute("""SELECT nr_urna, count(*) secoes, count(*) FILTER (WHERE abertura IS NULL) sem_horario,
                                          list(DISTINCT regexp_extract(filename, 'bu_([a-z]{2})_', 1)) ufs, sum(comparecimento) eleitores
                                   FROM bh GROUP BY nr_urna HAVING count(*) > 1""").df()

        # votos manuais, Brasil inteiro
        d = con.execute('SELECT * FROM bh').df()
        d['validos'] = d.lula + d.n22 + d.outros
        d = d[(d.validos >= 50) & (d.comparecimento > 0)].copy()
        d['sb'], d['pl'] = 100 * d.sem_biometria / d.comparecimento, 100 * d.lula / d.validos
        k = ['filename', 'cod_mun', 'zona', 'local_votacao']
        d['n'] = d.groupby(k).secao.transform('size')
        d = d[(d.n >= 3) & d.sb.notna()].copy()
        for c in ('sb', 'pl'):
            s_ = d.groupby(k)[c].transform('sum')
            d[c + '_dev'] = d[c] - (s_ - d[c]) / (d.n - 1)
        d['quintil'] = pd.qcut(d.sb_dev.rank(method='first'), 5, labels=['Q1', 'Q2', 'Q3', 'Q4', 'Q5'])
        qt = d.groupby('quintil', observed=True).agg(urnas=('secao', 'size'), sem_biometria_vs_vizinhas_pp=('sb_dev', 'mean'),
                                                     lula_vs_vizinhas_pp=('pl_dev', 'mean')).round(3)

        soma = lambda c: int(sum(r[c] for r in rs))
        tot = lambda k_: {c: int(sum(r[k_][c] for r in rs)) for c in rs[0][k_]}
        resumo[f'{t}_turno'] = {
            'arquivos': len(rs), 'ufs': sorted(r['uf'] for r in rs), 'boletins': soma('boletins'),
            'todos_batem_100pct': all(r['bate_100pct'] for r in rs),
            'assinaturas_conferidas': sum(1 for r in rs if r['assinatura_sha512_confere']),
            'urnas_com_qualquer_diferenca': soma('urnas_com_votos_diferentes') + soma('urnas_com_aptos_ou_comparecimento_diferentes')
                                            + soma('urnas_so_na_totalizacao') + soma('urnas_so_nos_boletins'),
            'totais_boletins': tot('totais_boletins'), 'totais_totalizacao': tot('totais_totalizacao'),
            'lula_boletins': int(sum(r['totais_boletins']['lula'] for r in rs)),
            'n22_boletins': int(sum(r['totais_boletins']['n22'] for r in rs)),
            'codigos_de_carga_repetidos': soma('codigos_de_carga_repetidos'),
            'numeros_de_urna_repetidos': soma('numeros_de_urna_repetidos'),
            'urnas_repetidas_detalhe': repetidas.to_dict('records'),
            'horario_local': {'urnas_abertas_antes_das_8h': soma('urnas_abertas_antes_das_8h'),
                              'urnas_encerradas_antes_das_17h': soma('urnas_encerradas_antes_das_17h'),
                              'urnas_encerradas_depois_das_19h': soma('urnas_encerradas_depois_das_19h')},
            'horario_brasilia': {
                'urnas_sem_horario': q('SELECT count(*) FROM bh WHERE abertura IS NULL'),
                'urnas_abertas_antes_das_8h': q('SELECT count(*) FROM bh WHERE abre_bsb < 8 * 60'),
                'urnas_encerradas_antes_das_17h': q('SELECT count(*) FROM bh WHERE fecha_bsb < 17 * 60'),
                'urnas_encerradas_depois_das_19h': q('SELECT count(*) FROM bh WHERE fecha_bsb > 19 * 60'),
                'urnas_por_fuso': {str(a): int(b) for a, b in con.execute('SELECT desloc, count(*) FROM bh GROUP BY 1 ORDER BY 1').fetchall()}},
            'fechamento_tardio_vs_vizinhas': tarde.to_dict('records'),
            'eleitores_liberados_sem_biometria': soma('eleitores_liberados_sem_biometria'),
            'pct_sem_biometria': round(100 * soma('eleitores_liberados_sem_biometria') / tot('totais_boletins')['comparecimento'], 2),
            'votos_manuais': {'urnas_testadas': int(len(d)), 'locais': int(d.groupby(k).ngroups),
                              'lula_pp_por_pp_sem_biometria': round(float(np.polyfit(d.sb_dev, d.pl_dev, 1)[0]), 3),
                              'correlacao_dentro_do_local': round(float(np.corrcoef(d.sb_dev, d.pl_dev)[0, 1]), 3),
                              'por_quintil': qt.reset_index().to_dict('records')}}
        r_ = resumo[f'{t}_turno']
        print(f"\n{t}º turno: {r_['boletins']:,} boletins em {len(rs)} arquivos · diferenças: {r_['urnas_com_qualquer_diferenca']} · "
              f"votos manuais: {r_['votos_manuais']['lula_pp_por_pp_sem_biometria']} pp de Lula por pp · "
              f"abertas antes das 8h (Brasília): {r_['horario_brasilia']['urnas_abertas_antes_das_8h']}".replace(',', '.'))
    if {1, 2} <= {r['turno'] for r in todos}:
        t2 = resumo['2_turno']['totais_boletins']
        resumo['prorrogacao_2_turno'] = pr = prorrogacao(con, t2['lula'] - t2['n22'])
        print(f"Prorrogação (2º turno): {pr['urnas']} urnas, {pr['eleitores_que_votaram']:,} eleitores, Lula {pr['lula_pct']}% · "
              f"sem essas urnas Lula venceria por {pr['margem_lula_sem_essas_urnas']:,} · "
              f"mudança 1º→2º turno vs resto da cidade: {pr['mudanca_1t_2t_vs_resto_da_cidade_pp']} pp".replace(',', '.'))
    (OUT / 'resumo.json').write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    print(f'Resultados em {OUT.relative_to(ROOT)}/ (resultados.json por arquivo, resumo.json por turno)')


if __name__ == '__main__':
    main()
