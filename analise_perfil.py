"""O perfil das urnas: dentro da mesma cidade, urnas com mais jovens, mulheres ou diplomados votaram diferente?

Junta o perfil do eleitorado de cada seção (TSE, cadastro de julho de 2026) ao resultado da urna nos dois turnos.
Compara urnas da MESMA cidade (efeito fixo de município): a diferença entre cidades e regiões sai da conta, e
fica só a variação entre bairros e escolas. O resultado descreve urnas, não pessoas.

Por que não "quantos de cada 100 jovens votaram em Lula": a inferência ecológica com limites (a mesma de
analise_decisao.py) foi tentada para idade, escolaridade e sexo e deu taxas impossíveis (por exemplo, 0% de Lula
entre 60 e 69 anos) e resultados muito diferentes quando refeita estado por estado. As faixas de idade e de
escolaridade andam juntas nas mesmas urnas, e a conta não consegue separá-las. Essa tentativa fica registrada em
'tentativa_taxas' e não é usada no site.

Entradas: dados_secao/perfil_secao_2026.csv.gz (agregar_perfil_secao.py), dados_secao/secoes_2026.csv.gz,
          dados_secao/t1_candidatos_secao.csv.gz
Saída: analise/perfil/resultados.json
"""
import json

import numpy as np
import pandas as pd

from analise_decisao import ROOT, t1_por_secao

OUT = ROOT / 'analise' / 'perfil'
CHAVE = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO']
# variáveis em % dos eleitores da urna; referências: 35 a 59 anos, até fundamental incompleto, homens
VARS = {
    'jovem_16_24': ('Eleitores de 16 a 24 anos', ['id_16_17', 'id_18_24']),
    'id_25_34': ('Eleitores de 25 a 34 anos', ['id_25_34']),
    'id_60_69': ('Eleitores de 60 a 69 anos', ['id_60_69']),
    'id_70': ('Eleitores de 70 anos ou mais', ['id_70_mais']),
    'fund_med': ('Fundamental completo ou médio incompleto', ['esc_fund_med_inc']),
    'medio': ('Médio completo ou superior incompleto', ['esc_med_sup_inc']),
    'superior': ('Superior completo', ['esc_superior']),
    'feminino': ('Mulheres', ['feminino']),
}
QUINTIS = ['jovem_16_24', 'id_70', 'superior', 'esc_baixa', 'feminino']
r = lambda x, d=1: round(float(x), d)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    p = pd.read_csv(ROOT / 'dados_secao' / 'perfil_secao_2026.csv.gz', sep=';')
    s = pd.read_csv(ROOT / 'dados_secao' / 'secoes_2026.csv.gz', sep=';')
    s = s[s._origem == 'both']
    t1 = s[s.NR_TURNO == 1].set_index(CHAVE)
    t2 = s[s.NR_TURNO == 2].set_index(CHAVE)
    u = t1_por_secao().set_index(CHAVE) \
        .join(t1[['QT_APTOS', 'QT_COMPARECIMENTO']].rename(columns={'QT_APTOS': 'aptos1', 'QT_COMPARECIMENTO': 'comp1'}), how='inner') \
        .join(t2[['QT_APTOS', 'QT_COMPARECIMENTO', 'lula', 'n22']].rename(
            columns={'QT_APTOS': 'aptos', 'QT_COMPARECIMENTO': 'comp2', 'lula': 'lula2', 'n22': 'flavio2'}), how='inner') \
        .join(p.set_index(CHAVE), how='inner').reset_index()
    total = len(u)
    dif = (u.eleitores - u.aptos).abs() / u.aptos
    u = u[(u.aptos == u.aptos1) & (u.aptos >= 50) & (dif <= 0.03) & (u.lula + u.flavio > 0) & (u.lula2 + u.flavio2 > 0)].copy()
    E = u.eleitores
    X = pd.DataFrame({k: 100 * u[c].sum(axis=1) / E for k, (_, c) in VARS.items()})
    esc_baixa = 100 * u.esc_ate_fund_inc / E
    Y = {
        'margem_t1': 100 * (u.lula - u.flavio) / (u.lula + u.flavio),
        'margem_t2': 100 * (u.lula2 - u.flavio2) / (u.lula2 + u.flavio2),
        'comparecimento_t2': 100 * u.comp2 / u.aptos,
    }
    Y['virada'] = Y['margem_t2'] - Y['margem_t1']
    w = u.aptos.to_numpy(float)
    g = pd.factorize(u.SG_UF + u.CD_MUNICIPIO.astype(str))[0]
    sw = np.bincount(g, w)
    dm = lambda v: np.asarray(v, float) - (np.bincount(g, w * np.asarray(v, float)) / sw)[g]

    res = {'urnas': int(len(u)), 'urnas_com_perfil': int(total), 'municipios': int(g.max() + 1),
           'eleitores': int(u.aptos.sum()), 'perfil_total_eleitores': int(p.eleitores.sum()),
           'referencias': '35 a 59 anos; até fundamental incompleto; homens',
           'nomes': {k: v[0] for k, v in VARS.items()}, 'regressao': {}, 'quintis': {}}
    Xd = np.column_stack([dm(X[c]) for c in X])
    XtX_inv = np.linalg.inv((Xd * w[:, None]).T @ Xd)
    for k, v in Y.items():
        yd = dm(v)
        b = XtX_inv @ (Xd * w[:, None]).T @ yd
        e = yd - Xd @ b
        sc = pd.DataFrame(Xd * (w * e)[:, None]).groupby(g).sum().to_numpy()
        se = np.sqrt(np.diag(XtX_inv @ (sc.T @ sc) @ XtX_inv))
        r2 = 1 - np.average(e ** 2, weights=w) / np.average(yd ** 2, weights=w)
        # efeito de 10 pontos a mais do grupo, em pontos de margem; faixa = ±2 erros padrão (agrupados por município)
        res['regressao'][k] = {'r2_dentro_da_cidade': r(r2, 3),
                               'por_10_pontos': {c: {'efeito': r(10 * bb, 2), 'faixa': [r(10 * (bb - 2 * ss), 2), r(10 * (bb + 2 * ss), 2)]}
                                                 for c, bb, ss in zip(X.columns, b, se)}}
        print(k, 'R2', r(r2, 3), {c: r(10 * bb, 1) for c, bb in zip(X.columns, b)})
    # quintis dentro da cidade: urnas comparadas com a média da própria cidade
    m1, m2, vi = dm(Y['margem_t1']), dm(Y['margem_t2']), dm(Y['virada'])
    for c in QUINTIS:
        x = esc_baixa if c == 'esc_baixa' else X[c]
        xd = dm(x)
        q = pd.qcut(xd, 5, labels=False)
        lin = []
        for i in range(5):
            sel = q == i
            lin.append({'quinto': i + 1, 'desvio_do_grupo': r(np.average(xd[sel], weights=w[sel])),
                        'margem_t2': r(np.average(m2[sel], weights=w[sel])), 'margem_t1': r(np.average(m1[sel], weights=w[sel])),
                        'virada': r(np.average(vi[sel], weights=w[sel])), 'urnas': int(sel.sum())})
        res['quintis'][c] = lin
        print(c, [(l['desvio_do_grupo'], l['margem_t2'], l['virada']) for l in lin])
    res['nomes']['esc_baixa'] = 'Até fundamental incompleto'
    res['tentativa_taxas'] = ('Inferência ecológica com limites por idade, escolaridade e sexo: taxas impossíveis (ex.: 0% de Lula entre '
                              '60 e 69 anos no 1º turno; 1,6% de Flávio entre 70+) e diferenças de até 57 pontos entre o modelo nacional e a soma '
                              'estado a estado. Descartada.')
    (OUT / 'resultados.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')


if __name__ == '__main__':
    main()
