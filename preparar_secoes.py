"""Monta tabelas por seção (urna) de presidente, 2022 e 2026: votos de Lula (13), nº 22, outros,
brancos (95) e nulos (96) por seção, com o local de votação. Lê os .zip do TSE diretamente.

Entradas: votacao_secao_<ano>_BR.zip (pasta do projeto, dados_<ano>/ ou a pasta acima)
          detalhe_votacao_secao_2026.zip (aptos/comparecimento por seção; opcional para 2022)
Saídas:   dados_secao/secoes_<ano>.csv.gz
Uso: python preparar_secoes.py     Dependência: pandas
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dados_secao'
CH = ['NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO']


def achar(nome):
    for p in (ROOT / nome, ROOT / 'dados_2022' / nome, ROOT / 'dados_secao' / nome, ROOT.parent / nome):
        if p.exists():
            return p
    return None


def votos(ano):
    src = achar(f'votacao_secao_{ano}_BR.zip')
    cols = [*CH, 'CD_CARGO', 'NR_VOTAVEL', 'QT_VOTOS', 'NR_LOCAL_VOTACAO']
    import zipfile
    partes = []
    zf = zipfile.ZipFile(src)
    csv_ = next(n for n in zf.namelist() if n.endswith('.csv'))
    for ch in pd.read_csv(zf.open(csv_), sep=';', encoding='latin1', usecols=cols, chunksize=3_000_000):
        assert (ch.CD_CARGO == 1).all()
        ch['c'] = ch.NR_VOTAVEL.map({13: 'lula', 22: 'n22', 95: 'brancos', 96: 'nulos'}).fillna('outros')
        partes.append(ch.groupby([*CH, 'NR_LOCAL_VOTACAO', 'c']).QT_VOTOS.sum())
    s = pd.concat(partes).groupby(level=list(range(7))).sum().unstack('c', fill_value=0).reset_index()
    s.columns.name = None
    for c in ('lula', 'n22', 'outros', 'brancos', 'nulos'):
        if c not in s:
            s[c] = 0
    return s


def detalhe(ano):
    """Aptos, comparecimento, modelo da urna e horário de chegada do boletim, por seção (arquivo _BR = presidente)."""
    src = achar(f'detalhe_votacao_secao_{ano}.zip')
    if src is None:
        return None
    import zipfile
    zf = zipfile.ZipFile(src)
    nome = next(n for n in zf.namelist() if n.endswith(f'detalhe_votacao_secao_{ano}_BR.csv'))
    cols = [*CH, 'CD_CARGO', 'QT_APTOS', 'QT_COMPARECIMENTO', 'QT_ABSTENCOES', 'CD_MODELO_URNA',
            'DT_RECEBIMENTO_BU_HOR_TSE', 'DS_ORIGEM_VOTO', 'ST_SECAO_INSTALADA', 'ST_SECAO_ANULADA']
    d = pd.read_csv(zf.open(nome), sep=';', encoding='latin1', usecols=lambda c: c in cols)
    assert (d.CD_CARGO == 1).all()
    d = d.drop(columns='CD_CARGO')
    assert not d.duplicated(CH).any(), 'Seção duplicada no detalhe'
    return d


def main():
    OUT.mkdir(exist_ok=True)
    for ano in (2022, 2026):
        if achar(f'votacao_secao_{ano}_BR.zip') is None:
            print(f'{ano}: arquivo de seção não encontrado, pulando')
            continue
        s = votos(ano)
        det = detalhe(ano)
        if det is not None:
            s = s.merge(det, on=CH, how='outer', validate='one_to_one', indicator='_origem')
            print(ano, s._origem.value_counts().to_dict())
        s.to_csv(OUT / f'secoes_{ano}.csv.gz', sep=';', index=False)
        print(ano, len(s), 'seções-turno;', 'com aptos' if det is not None else 'sem aptos',
              {t: int(g.lula.sum()) for t, g in s.groupby('NR_TURNO')})


if __name__ == '__main__':
    main()
