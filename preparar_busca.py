"""Gera os arquivos da busca do site: um por estado, com cada município, local de votação (escola) e urna.

Entradas:
  dados_secao/votacao_secao_2026_BR.zip   (nome e endereço de cada local de votação)
  dados_secao/secoes_2026.csv.gz          (votos por urna nos dois turnos; preparar_secoes.py)
  dados_mapa/municipios_brasileiros_tse.json (código TSE -> IBGE)
  dados_mapa/geo_uf/<cód. IBGE da UF>.json   (contornos detalhados; opcional)
Saída: busca/<UF>.json  (o site baixa só o estado que a pessoa abrir)

Formato de cada arquivo (listas para ficar pequeno):
  {"uf": "BA", "m": {"<ibge ou Z+cód TSE>": [nome, [local, ...]]}, "g": {"<ibge>": "<path SVG>"}}
  local = [zona, nº local, nome, endereço, [urna, ...]]
  urna  = [seção, aptos, votaram1, lula1, flavio1, outros1, brancos+nulos1, votaram2, lula2, flavio2, brancos+nulos2]
Confere: a soma das urnas de cada município tem de bater com o resultado por município da página.
"""
import csv
import gzip
import io
import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
ZIP = next((p for p in (ROOT / 'dados_secao' / 'votacao_secao_2026_BR.zip', ROOT / 'votacao_secao_2026_BR.zip',
                         ROOT.parent / 'votacao_secao_2026_BR.zip') if p.exists()), ROOT / 'dados_secao' / 'votacao_secao_2026_BR.zip')
SECOES = ROOT / 'dados_secao' / 'secoes_2026.csv.gz'
MAPA = ROOT / 'dados_mapa'
OUT = ROOT / 'busca'
UF_IBGE = {'RO': '11', 'AC': '12', 'AM': '13', 'RR': '14', 'PA': '15', 'AP': '16', 'TO': '17', 'MA': '21', 'PI': '22', 'CE': '23',
           'RN': '24', 'PB': '25', 'PE': '26', 'AL': '27', 'SE': '28', 'BA': '29', 'MG': '31', 'ES': '32', 'RJ': '33', 'SP': '35',
           'PR': '41', 'SC': '42', 'RS': '43', 'MS': '50', 'MT': '51', 'GO': '52', 'DF': '53'}


def titulo(s: str) -> str:
    """ESCOLA MUNICIPAL MARIA LEAL -> Escola Municipal Maria Leal (mantém siglas curtas)."""
    pequenas = {'DA', 'DE', 'DO', 'DAS', 'DOS', 'E', 'EM', 'NA', 'NO', 'A', 'O'}
    out = []
    for i, w in enumerate(s.split()):
        if i and w in pequenas:
            out.append(w.lower())
        elif len(w) <= 3 and w.isalpha() and w not in pequenas and not any(c in 'AEIOUÁÉÍÓÚÂÊÔÃÕ' for c in w):
            out.append(w)          # siglas: EMEF, CEU...
        else:
            out.append(w.capitalize())
    return ' '.join(out)


def ler_locais():
    """Nome e endereço de cada local de votação, lendo o CSV grande direto do zip (sem extrair)."""
    locais, muns = {}, {}
    with zipfile.ZipFile(ZIP) as z:
        nome = next(n for n in z.namelist() if n.endswith('.csv'))
        with z.open(nome) as f:
            r = csv.reader(io.TextIOWrapper(f, encoding='latin-1', newline=''), delimiter=';')
            cab = next(r)
            i = {c: cab.index(c) for c in ('SG_UF', 'CD_MUNICIPIO', 'NM_MUNICIPIO', 'NR_ZONA', 'NR_LOCAL_VOTACAO',
                                           'NM_LOCAL_VOTACAO', 'DS_LOCAL_VOTACAO_ENDERECO', 'NR_TURNO')}
            for n, row in enumerate(r):
                k = (row[i['SG_UF']], int(row[i['CD_MUNICIPIO']]), int(row[i['NR_ZONA']]), int(row[i['NR_LOCAL_VOTACAO']]))
                if row[i['NR_TURNO']] != '2' and k in locais:
                    continue
                locais[k] = (row[i['NM_LOCAL_VOTACAO']], row[i['DS_LOCAL_VOTACAO_ENDERECO']])   # o 2º turno, se houver, prevalece
                muns[(k[0], k[1])] = row[i['NM_MUNICIPIO']]
                if n % 2_000_000 == 0:
                    print(f'  {n:,} linhas lidas'.replace(',', '.'), flush=True)
    return locais, muns


def main():
    OUT.mkdir(exist_ok=True)
    print('Lendo nomes dos locais de votação...')
    locais, nomes_mun = ler_locais()
    print(f'  {len(locais):,} locais'.replace(',', '.'))

    s = pd.read_csv(SECOES, sep=';')
    s = s[s._origem == 'both']          # as 85 seções só do detalhe não foram instaladas (sem votos)
    s['bn'] = s.brancos.fillna(0) + s.nulos.fillna(0)
    t1 = s[s.NR_TURNO == 1].set_index(['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO'])
    t2 = s[s.NR_TURNO == 2].set_index(['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO'])
    w = t1[['NR_LOCAL_VOTACAO', 'QT_APTOS', 'QT_COMPARECIMENTO', 'lula', 'n22', 'outros', 'bn']].join(
        t2[['NR_LOCAL_VOTACAO', 'QT_APTOS', 'QT_COMPARECIMENTO', 'lula', 'n22', 'bn']], how='outer', lsuffix='1', rsuffix='2').reset_index()
    w['local'] = w.NR_LOCAL_VOTACAO2.fillna(w.NR_LOCAL_VOTACAO1).astype(int)
    w['aptos'] = w.QT_APTOS2.fillna(w.QT_APTOS1)

    cw = {(c['uf'], c['codigo_tse']): str(c['codigo_ibge']) for c in json.loads((MAPA / 'municipios_brasileiros_tse.json').read_text(encoding='utf-8'))}
    nome_cw = {str(c['codigo_ibge']): c['nome_municipio'] for c in json.loads((MAPA / 'municipios_brasileiros_tse.json').read_text(encoding='utf-8'))}
    iv = lambda v: None if pd.isna(v) else int(v)

    resumo, sem_nome = {}, 0
    for uf, du in w.groupby('SG_UF'):
        m = {}
        for cod, dm in du.groupby('CD_MUNICIPIO'):
            chave = cw.get((uf, int(cod)), f'Z{int(cod)}')
            nome = titulo(nomes_mun.get((uf, int(cod)), nome_cw.get(chave, str(cod))))
            lista = []
            for (zona, loc), dl in dm.groupby(['NR_ZONA', 'local']):
                nm, end = locais.get((uf, int(cod), int(zona), int(loc)), ('', ''))
                sem_nome += not nm
                urnas = [[int(r.NR_SECAO), iv(r.aptos), iv(r.QT_COMPARECIMENTO1), iv(r.lula1), iv(r.n221), iv(r.outros), iv(r.bn1),
                          iv(r.QT_COMPARECIMENTO2), iv(r.lula2), iv(r.n222), iv(r.bn2)] for r in dl.sort_values('NR_SECAO').itertuples()]
                lista.append([int(zona), int(loc), titulo(nm) if nm else f'Local {int(loc)}', titulo(end) if end else '', urnas])
            lista.sort(key=lambda x: -sum(u[1] or 0 for u in x[4]))
            m[chave] = [nome, lista]
            resumo[chave] = (int(dm.lula2.fillna(0).sum()), int(dm.n222.fillna(0).sum()), int(dm.lula1.fillna(0).sum()), int(dm.n221.fillna(0).sum()))
        dado = {'uf': uf, 'm': m}
        g = MAPA / 'geo_uf' / f'{UF_IBGE.get(uf, "xx")}.json'
        if g.exists():
            dado['g'] = json.loads(g.read_text())
        bruto = json.dumps(dado, ensure_ascii=False, separators=(',', ':')).encode()
        (OUT / f'{uf}.json').write_bytes(bruto)
        print(f'{uf}: {len(m)} municípios, {sum(len(v[1]) for v in m.values())} locais, '
              f'{len(bruto) / 1e6:.1f} MB (compactado no envio: ~{len(gzip.compress(bruto, 6)) / 1e6:.2f} MB)')
    (OUT / 'conferencia.json').write_text(json.dumps(resumo))
    print(f'Locais sem nome no arquivo do TSE: {sem_nome}')
    tot = [sum(v[i] for v in resumo.values()) for i in range(4)]
    print(f'Brasil 2º turno: Lula {tot[0]:,} · Flávio {tot[1]:,} · 1º turno: Lula {tot[2]:,} · Flávio {tot[3]:,}'.replace(',', '.'))
    ok = tot[:2] == [64256232, 59826041] and tot[2:] == [53879538, 56104503]
    print('Totais nacionais conferem com o oficial.' if ok else 'ATENÇÃO: totais nacionais diferentes do oficial!')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
