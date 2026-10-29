"""Resume o perfil do eleitorado por seção (TSE, 2026) em uma linha por seção.

Entrada: perfil_eleitor_secao_2026_<UF>.zip (dadosabertos.tse.jus.br, conjunto "Eleitorado - 2026"),
         uma linha por combinação de gênero, idade, escolaridade, estado civil e raça/cor em cada seção.
Saída:   perfil_secao_2026.csv.gz, uma linha por seção, com o número de eleitores em cada grupo.

Uso: python agregar_perfil_secao.py <pasta com os zips> [saída]
"""
import io
import re
import sys
import zipfile
from pathlib import Path

import pandas as pd

PASTA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.')
SAIDA = Path(sys.argv[2]) if len(sys.argv) > 2 else PASTA / 'perfil_secao_2026.csv.gz'
CHAVE = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO']
COLS = CHAVE + ['CD_GENERO', 'CD_ESTADO_CIVIL', 'DS_FAIXA_ETARIA', 'CD_GRAU_ESCOLARIDADE', 'DS_RACA_COR',
                'QT_ELEITORES', 'QT_ELEITORES_BIOMETRIA', 'QT_ELEITORES_DEFICIENCIA']


def faixa(ds):
    """'30 a 34 anos' -> 'id_25_34'; usa a idade inicial da faixa do TSE."""
    m = re.match(r'\s*(\d+)', str(ds))
    if not m:
        return 'id_nd'
    a = int(m.group(1))
    for lim, nome in ((18, 'id_16_17'), (25, 'id_18_24'), (35, 'id_25_34'), (45, 'id_35_44'), (60, 'id_45_59'), (70, 'id_60_69')):
        if a < lim:
            return nome
    return 'id_70_mais'


ESC = {1: 'esc_ate_fund_inc', 2: 'esc_ate_fund_inc', 3: 'esc_ate_fund_inc', 4: 'esc_fund_med_inc', 5: 'esc_fund_med_inc',
       6: 'esc_med_sup_inc', 7: 'esc_med_sup_inc', 8: 'esc_superior'}
RACA = {'BRANCA': 'raca_branca', 'PRETA': 'raca_preta', 'PARDA': 'raca_parda', 'AMARELA': 'raca_amarela', 'INDÍGENA': 'raca_indigena'}


def resumir(df):
    df['QT_ELEITORES'] = df.QT_ELEITORES.astype('int64')
    q = df.QT_ELEITORES
    partes = {
        'eleitores': q,
        'biometria': df.QT_ELEITORES_BIOMETRIA.astype('int64'),
        'deficiencia': df.QT_ELEITORES_DEFICIENCIA.astype('int64'),
        'feminino': q.where(df.CD_GENERO.astype(str) == '4', 0),
        'casado': q.where(df.CD_ESTADO_CIVIL.astype(str) == '3', 0),
    }
    base = df[CHAVE].copy()
    for k, v in partes.items():
        base[k] = v
    # idade, escolaridade e raça/cor viram colunas de contagem
    out = [base.groupby(CHAVE, sort=False).sum()]
    for col, mapa in (('DS_FAIXA_ETARIA', None), ('CD_GRAU_ESCOLARIDADE', ESC), ('DS_RACA_COR', RACA)):
        if col == 'DS_FAIXA_ETARIA':
            g = df[col].map({d: faixa(d) for d in df[col].unique()})
        elif col == 'CD_GRAU_ESCOLARIDADE':
            g = pd.to_numeric(df[col], errors='coerce').map(ESC).fillna('esc_nd')
        else:
            g = df[col].astype(str).str.upper().str.strip().map(RACA).fillna('raca_nd')
        t = df[CHAVE].assign(g=g.values, q=q.values).pivot_table(index=CHAVE, columns='g', values='q', aggfunc='sum', fill_value=0)
        out.append(t)
    return pd.concat(out, axis=1).fillna(0)


def main():
    zips = sorted(PASTA.glob('perfil_eleitor_secao_2026_*.zip'))
    tabs = []
    for zp in zips:
        with zipfile.ZipFile(zp) as z:
            nome = next(n for n in z.namelist() if n.endswith('.csv'))
            acc = None
            with z.open(nome) as f:
                for ch in pd.read_csv(io.TextIOWrapper(f, encoding='latin-1'), sep=';', usecols=COLS, dtype=str, chunksize=1_000_000):
                    ch['CD_MUNICIPIO'] = ch.CD_MUNICIPIO.astype(int)
                    ch['NR_ZONA'] = ch.NR_ZONA.astype(int)
                    ch['NR_SECAO'] = ch.NR_SECAO.astype(int)
                    r = resumir(ch)
                    acc = r if acc is None else acc.add(r, fill_value=0)
            acc = acc.groupby(level=CHAVE).sum()
            print(zp.stem[-2:], len(acc), 'seções', int(acc.eleitores.sum()), 'eleitores', flush=True)
            tabs.append(acc)
    t = pd.concat(tabs).fillna(0).astype('int64').reset_index()
    t.to_csv(SAIDA, sep=';', index=False)
    print('total', len(t), 'seções', int(t.eleitores.sum()), 'eleitores ->', SAIDA)


if __name__ == '__main__':
    main()
