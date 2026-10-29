"""Monta a base de 2022 por zona no mesmo formato de analise/zona.csv (2026).

Entradas (pasta dados_2022/):
  - votacao_secao_2022_BR.zip  (ou o .csv extraído) — votos de presidente por seção
  - detalhe_votacao_munzona_2022_BR.csv           — aptos, comparecimento, brancos, nulos por zona
Saídas:
  - dados_2022/votos_zona_2022.csv  (votos por zona e número de candidato, formato longo)
  - analise/zona_2022.csv           (mesmas colunas de zona.csv; "flavio" = Bolsonaro, nº 22)
Uso: python preparar_2022.py      Dependência: pandas
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
D = ROOT / 'dados_2022'
# prefere o .zip (íntegro); o .csv só se tiver o tamanho completo (1.591.148.802 bytes)
CANDIDATOS = [D / 'votacao_secao_2022_BR.zip', ROOT.parent / 'votacao_secao_2022_BR.zip', D / 'votacao_secao_2022_BR.csv']
SECAO = next((p for p in CANDIDATOS if p.exists() and (p.suffix == '.zip' or p.stat().st_size == 1_591_148_802)), None)
DETALHE = D / 'detalhe_votacao_munzona_2022_BR.csv'
CHAVE = ['NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA']
FIELDS = {'aptos': 'QT_APTOS', 'comparecimento': 'QT_COMPARECIMENTO', 'abstencoes': 'QT_ABSTENCOES',
          'nao_instaladas': 'QT_ELEITORES_SECOES_NAO_INSTALADAS', 'validos': 'QT_TOTAL_VOTOS_VALIDOS',
          'brancos': 'QT_VOTOS_BRANCOS', 'nulos': 'QT_TOTAL_VOTOS_NULOS', 'anulados': 'QT_TOTAL_VOTOS_ANULADOS',
          'subjudice': 'QT_TOTAL_VOTOS_ANUL_SUBJUD', 'separado': 'QT_VOTOS_ANULADOS_APU_SEP'}


def votos_por_zona():
    saida = D / 'votos_zona_2022.csv'
    if saida.exists() and (SECAO is None or saida.stat().st_mtime > SECAO.stat().st_mtime):
        return pd.read_csv(saida, sep=';')
    cols = [*CHAVE, 'CD_CARGO', 'NR_VOTAVEL', 'QT_VOTOS']
    partes = []
    for ch in pd.read_csv(SECAO, sep=';', encoding='latin1', usecols=cols, chunksize=2_000_000):
        assert (ch.CD_CARGO == 1).all(), 'Arquivo BR deveria ter só presidente'
        partes.append(ch.groupby([*CHAVE, 'NR_VOTAVEL'], as_index=False).QT_VOTOS.sum())
    g = pd.concat(partes).groupby([*CHAVE, 'NR_VOTAVEL'], as_index=False).QT_VOTOS.sum()
    g.to_csv(saida, sep=';', index=False)
    return g


def main():
    g = votos_por_zona()
    det = pd.read_csv(DETALHE, sep=';', encoding='latin1')
    det = det[det.CD_CARGO == 1].groupby(CHAVE, as_index=False)[list(FIELDS.values())].sum()
    det = det.rename(columns={v: k for k, v in FIELDS.items()})
    cand = g[~g.NR_VOTAVEL.isin([95, 96, 97])]
    piv = cand.assign(c=cand.NR_VOTAVEL.map({13: 'lula', 22: 'flavio'}).fillna('outros')) \
        .pivot_table(index=CHAVE, columns='c', values='QT_VOTOS', aggfunc='sum', fill_value=0).reset_index()
    z = det.merge(piv, on=CHAVE, how='outer', indicator=True)
    # zonas só no detalhe = exterior sem nenhum voto válido (seções não instaladas ou só nulos); outra divergência para
    sem_voto = z._merge == 'left_only'
    assert (z.loc[sem_voto, 'validos'] == 0).all() and (z._merge != 'right_only').all(), z._merge.value_counts()
    z = z.drop(columns='_merge').fillna(0)
    soma = z.lula + z.flavio + z.outros
    assert (soma == z.validos).all(), f'{(soma != z.validos).sum()} zonas com votos ≠ válidos'
    assert (z.aptos == z.comparecimento + z.abstencoes + z.nao_instaladas).all(), 'Aptos não reconciliados'
    t1, t2 = z[z.NR_TURNO == 1], z[z.NR_TURNO == 2]
    k = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA']
    w = t1.merge(t2, on=k, suffixes=('1', '2'))
    assert len(w) == len(t1) == len(t2), 'Cobertura diferente entre turnos'
    w = w.rename(columns={'SG_UF': 'uf', 'CD_MUNICIPIO': 'codigo_municipio', 'NR_ZONA': 'zona'})
    w['codigo_municipio'] = w['codigo_municipio'].astype(int).astype(str).str.zfill(5)
    w['zona'] = w['zona'].astype(int).astype(str)
    for c in ['lula', 'flavio', 'outros', *FIELDS]:
        w['delta_' + c] = w[c + '2'] - w[c + '1']
    w['margem1'] = w.lula1 - w.flavio1
    w['margem2'] = w.lula2 - w.flavio2
    w['delta_margem'] = w.margem2 - w.margem1
    w['transito'] = 'N'
    w.to_csv(ROOT / 'analise' / 'zona_2022.csv', sep=';', index=False, encoding='utf-8-sig')
    print(f'{len(w)} zonas; Lula 2T {int(w.lula2.sum()):,} × Bolsonaro 2T {int(w.flavio2.sum()):,}'.replace(',', '.'))


if __name__ == '__main__':
    main()
