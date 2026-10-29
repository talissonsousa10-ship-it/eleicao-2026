"""Reamostragens das taxas de transferência usadas no simulador do site.

O simulador usa taxas de dois modelos de analise_decisao.py: o detalhado (Cury, Renan, Caiado) e o simples
(outros candidatos somados e quem não votou em ninguém). Aqui os dois são refeitos com as MESMAS reamostragens
de municípios, para que a faixa do simulador respeite a correlação entre as taxas.

Saída: analise/decisao/simulador_bootstrap.json (200 reamostragens, taxas em %)
"""
import json

import numpy as np
import pandas as pd

from analise_decisao import ROOT, OUT, ORIG, DEST, matriz, t1_por_secao

NBOOT = 200


def normais(s, O, D):
    X = s[O].to_numpy(float) / s.aptos.to_numpy(float)[:, None]
    Y = s[D].to_numpy(float) / s.aptos.to_numpy(float)[:, None]
    w = s.aptos.to_numpy(float)
    mun = pd.factorize(s.SG_UF + s.CD_MUNICIPIO.astype(str))[0]
    nm = mun.max() + 1
    A = np.zeros((nm, len(O), len(O)))
    C = np.zeros((nm, len(O), len(D)))
    for j in range(len(O)):
        for k in range(len(O)):
            A[:, j, k] = np.bincount(mun, w * X[:, j] * X[:, k], nm)
        for k in range(len(D)):
            C[:, j, k] = np.bincount(mun, w * X[:, j] * Y[:, k], nm)
    return A, C, nm


def main():
    s = pd.read_csv(ROOT / 'dados_secao' / 'secoes_2026.csv.gz', sep=';')
    s = s[s._origem == 'both']
    chave = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO']
    t1 = s[s.NR_TURNO == 1].set_index(chave)
    t2 = s[s.NR_TURNO == 2].set_index(chave)
    u = t1_por_secao().set_index(chave) \
        .join(t1[['QT_APTOS', 'QT_COMPARECIMENTO']].rename(columns={'QT_APTOS': 'aptos1', 'QT_COMPARECIMENTO': 'comp1'}), how='inner') \
        .join(t2[['QT_APTOS', 'QT_COMPARECIMENTO', 'lula', 'n22', 'brancos', 'nulos']].rename(
            columns={'QT_APTOS': 'aptos', 'QT_COMPARECIMENTO': 'comp2', 'lula': 'lula2', 'n22': 'flavio2'}), how='inner').reset_index()
    u['bn2'] = u.brancos.fillna(0) + u.nulos.fillna(0)
    u['abst'] = u.aptos1 - u.comp1
    u['abst2'] = u.aptos - u.comp2
    uu = u[(u.aptos == u.aptos1) & (u.aptos >= 50)].copy()
    uu['terceiros'] = uu[['cury', 'renan', 'caiado', 'zema', 'pequenos']].sum(1)
    uu['nenhum'] = uu.bn + uu.abst
    uu['nenhum2'] = uu.bn2 + uu.abst2
    OS, DS = ['lula', 'flavio', 'terceiros', 'nenhum'], ['lula2', 'flavio2', 'nenhum2']

    A1, C1, nm = normais(uu, ORIG, DEST)
    A2, C2, _ = normais(uu, OS, DS)
    i1 = {o: ORIG.index(o) for o in ('cury', 'renan', 'caiado')}
    pct = lambda B, i: [round(100 * B[i, 0], 2), round(100 * B[i, 1], 2)]

    def taxas(cont):
        B1 = matriz(np.tensordot(cont, A1, 1), np.tensordot(cont, C1, 1))
        B2 = matriz(np.tensordot(cont, A2, 1), np.tensordot(cont, C2, 1))
        return {**{o: pct(B1, i) for o, i in i1.items()}, 'zema': pct(B2, 2), 'nenhum': pct(B2, 3)}

    ponto = taxas(np.ones(nm))
    print('estimativa central', ponto)
    rng = np.random.default_rng(2027)
    reps = []
    for b in range(NBOOT):
        reps.append(taxas(np.bincount(rng.integers(0, nm, nm), minlength=nm).astype(float)))
        if b % 50 == 49:
            print(' ', b + 1)
    out = {'metodo': f'{NBOOT} reamostragens de municípios, as mesmas para os dois modelos; taxas em % (Lula, Flávio)',
           'grupos': {'cury': 'Augusto Cury', 'renan': 'Renan Santos', 'caiado': 'Ronaldo Caiado',
                      'zema': 'outros candidatos somados (modelo simples), usado para Zema e os outros 6',
                      'nenhum': 'branco, nulo ou não votou (modelo simples)'},
           'central': ponto, 'reamostragens': reps}
    (OUT / 'simulador_bootstrap.json').write_text(json.dumps(out, ensure_ascii=False))
    a = np.array([[r[g][k] for g in ponto for k in (0, 1)] for r in reps])
    print('faixa 5-95%:', dict(zip([f'{g}_{k}' for g in ponto for k in 'lf'], zip(np.percentile(a, 5, 0).round(1), np.percentile(a, 95, 0).round(1)))))


if __name__ == '__main__':
    main()
