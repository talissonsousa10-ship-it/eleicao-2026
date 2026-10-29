"""Onde a eleição foi decidida: de onde vieram os votos do 2º turno e o que mudou em relação a 2022.

Partes:
  A. A conta do 2º turno (1º → 2º turno de 2026, Brasil)
  B. Para onde foram os eleitores de cada candidato do 1º turno (inferência ecológica por urna, com limites)
  C. 2022 → 2026: de onde veio o aumento da vantagem de Lula (por estado, região e porte), separando
     "mudança de voto" de "mudança no número de votantes"
  D. Tendência por perfil do município (porte, renda, evangélicos, renda vinda de fora do trabalho) e uma
     regressão que olha tudo junto
  E. Comparecimento: onde mais gente votou, quem ganhou?

Entradas: dados_secao/votacao_secao_2026_BR.zip, dados_secao/secoes_2026.csv.gz,
          analise/comparacao_2022_2026/municipios_2022_2026.csv, dados_ibge/municipios_ibge.csv,
          dados_mapa/municipios_brasileiros_tse.json
Saída: analise/decisao/resultados.json (e dados_secao/t1_candidatos_secao.csv.gz, cache)
"""
import csv
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import minimize

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'analise' / 'decisao'
ZIP = next((p for p in (ROOT / 'dados_secao' / 'votacao_secao_2026_BR.zip', ROOT / 'votacao_secao_2026_BR.zip',
                        ROOT.parent / 'votacao_secao_2026_BR.zip') if p.exists()), ROOT / 'dados_secao' / 'votacao_secao_2026_BR.zip')
CACHE = ROOT / 'dados_secao' / 't1_candidatos_secao.csv.gz'
GRUPO = {'13': 'lula', '22': 'flavio', '70': 'cury', '14': 'renan', '55': 'caiado', '30': 'zema'}
NOMES = {'lula': 'Lula', 'flavio': 'Flávio', 'cury': 'Augusto Cury', 'renan': 'Renan Santos', 'caiado': 'Ronaldo Caiado',
         'zema': 'Zema', 'pequenos': 'Outros 6 candidatos', 'bn': 'Branco ou nulo', 'abst': 'Não votou'}
r1 = lambda x, d=2: None if x is None or (isinstance(x, float) and np.isnan(x)) else round(float(x), d)


# ---------------------------------------------------------------- votos por candidato em cada urna (1º turno)
def t1_por_secao():
    if CACHE.exists():
        return pd.read_csv(CACHE)
    acc = {}
    with zipfile.ZipFile(ZIP) as z, z.open(next(n for n in z.namelist() if n.endswith('.csv'))) as f:
        r = csv.reader(io.TextIOWrapper(f, encoding='latin-1', newline=''), delimiter=';')
        cab = next(r)
        i = {c: cab.index(c) for c in ('NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'NR_VOTAVEL', 'QT_VOTOS')}
        for row in r:
            if row[i['NR_TURNO']] != '1':
                continue
            k = (row[i['SG_UF']], int(row[i['CD_MUNICIPIO']]), int(row[i['NR_ZONA']]), int(row[i['NR_SECAO']]))
            nv = row[i['NR_VOTAVEL']]
            g = GRUPO.get(nv, 'bn' if nv in ('95', '96') else 'pequenos')
            d = acc.setdefault(k, {})
            d[g] = d.get(g, 0) + int(row[i['QT_VOTOS']])
    df = pd.DataFrame([(*k, *[v.get(g, 0) for g in ('lula', 'flavio', 'cury', 'renan', 'caiado', 'zema', 'pequenos', 'bn')])
                       for k, v in acc.items()],
                      columns=['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO', 'lula', 'flavio', 'cury', 'renan', 'caiado', 'zema', 'pequenos', 'bn'])
    df.to_csv(CACHE, index=False)
    return df


# ---------------------------------------------------------------- B. matriz de transferência com limites
ORIG = ['lula', 'flavio', 'cury', 'renan', 'caiado', 'zema', 'pequenos', 'bn', 'abst']
DEST = ['lula2', 'flavio2', 'bn2', 'abst2']


def matriz(XtX, XtY):
    """Mínimos quadrados com as restrições de uma matriz de transferência: cada taxa entre 0 e 1 e cada linha somando 1."""
    no, nd = XtY.shape
    esc = np.trace(XtX) / no          # deixa o problema em escala ~1 (o otimizador não converge com números de 10^8)
    XtX, XtY = XtX / esc, XtY / esc
    def f(b):
        B = b.reshape(no, nd)
        return np.trace(B.T @ XtX @ B) - 2 * np.trace(B.T @ XtY)
    def g(b):
        B = b.reshape(no, nd)
        return (2 * XtX @ B - 2 * XtY).ravel()
    cons = [{'type': 'eq', 'fun': (lambda b, i=i: b.reshape(no, nd)[i].sum() - 1)} for i in range(no)]
    b0 = np.full(no * nd, 1 / nd)
    res = minimize(f, b0, jac=g, bounds=[(0, 1)] * (no * nd), constraints=cons, method='SLSQP', options={'maxiter': 1000, 'ftol': 1e-14})
    if not res.success:
        print('  aviso do otimizador:', res.message)
    return res.x.reshape(no, nd)


def transferencias(s, rng, ORIG=ORIG, DEST=DEST, nboot=200):
    X = s[ORIG].to_numpy(float) / s.aptos.to_numpy(float)[:, None]
    Y = s[DEST].to_numpy(float) / s.aptos.to_numpy(float)[:, None]
    w = s.aptos.to_numpy(float)
    # matrizes normais por município, para reamostrar municípios no bootstrap sem refazer as contas por urna
    mun = pd.factorize(s.SG_UF + s.CD_MUNICIPIO.astype(str))[0]
    nm = mun.max() + 1
    A = np.zeros((nm, len(ORIG), len(ORIG)))
    C = np.zeros((nm, len(ORIG), len(DEST)))
    for j in range(len(ORIG)):
        for k in range(len(ORIG)):
            A[:, j, k] = np.bincount(mun, w * X[:, j] * X[:, k], nm)
        for k in range(len(DEST)):
            C[:, j, k] = np.bincount(mun, w * X[:, j] * Y[:, k], nm)
    B = matriz(A.sum(0), C.sum(0))
    boot = []
    for _ in range(nboot):
        cont = np.bincount(rng.integers(0, nm, nm), minlength=nm).astype(float)
        boot.append(matriz(np.tensordot(cont, A, 1), np.tensordot(cont, C, 1)))
    lo, hi = np.percentile(boot, 5, axis=0), np.percentile(boot, 95, axis=0)
    # qualidade: quanto a matriz reproduz o resultado de cada urna
    pred = X @ B
    r2 = {d: r1(1 - np.average((Y[:, k] - pred[:, k]) ** 2, weights=w) / np.average((Y[:, k] - np.average(Y[:, k], weights=w)) ** 2, weights=w), 3)
          for k, d in enumerate(DEST)}
    return B, lo, hi, r2


# ---------------------------------------------------------------- utilidades
def media_pond(v, w):
    v, w = np.asarray(v, float), np.asarray(w, float)
    ok = ~np.isnan(v) & ~np.isnan(w)
    return float(np.average(v[ok], weights=w[ok]))


def faixas_por_eleitor(x, w, n=5):
    """Cortes de x que dividem o ELEITORADO (não os municípios) em n grupos iguais."""
    o = np.argsort(x)
    cw = np.cumsum(w[o]) / w.sum()
    return np.searchsorted(cw, np.arange(1, n) / n).clip(0, len(x) - 1), o


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(2026)
    res = {}

    # ---------------- A. a conta do 2º turno
    s = pd.read_csv(ROOT / 'dados_secao' / 'secoes_2026.csv.gz', sep=';')
    s = s[s._origem == 'both']
    t1 = s[s.NR_TURNO == 1].set_index(['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO'])
    t2 = s[s.NR_TURNO == 2].set_index(['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO'])
    c1 = t1_por_secao().set_index(['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO'])
    u = c1.join(t1[['QT_APTOS', 'QT_COMPARECIMENTO']].rename(columns={'QT_APTOS': 'aptos1', 'QT_COMPARECIMENTO': 'comp1'}), how='inner') \
          .join(t2[['QT_APTOS', 'QT_COMPARECIMENTO', 'lula', 'n22', 'brancos', 'nulos']].rename(
              columns={'QT_APTOS': 'aptos', 'QT_COMPARECIMENTO': 'comp2', 'lula': 'lula2', 'n22': 'flavio2'}), how='inner').reset_index()
    u['bn2'] = u.brancos.fillna(0) + u.nulos.fillna(0)
    u['abst'] = u.aptos1 - u.comp1
    u['abst2'] = u.aptos - u.comp2
    soma = {c: int(u[c].sum()) for c in ['lula', 'flavio', 'cury', 'renan', 'caiado', 'zema', 'pequenos', 'bn', 'abst', 'lula2', 'flavio2', 'bn2', 'abst2', 'comp1', 'comp2']}
    res['conta_2o_turno'] = {
        'lula_1t': soma['lula'], 'flavio_1t': soma['flavio'], 'lula_2t': soma['lula2'], 'flavio_2t': soma['flavio2'],
        'vantagem_flavio_1t': soma['flavio'] - soma['lula'], 'vantagem_lula_2t': soma['lula2'] - soma['flavio2'],
        'votos_dos_outros_candidatos': {k: soma[k] for k in ('cury', 'renan', 'caiado', 'zema', 'pequenos')},
        'brancos_nulos_1t': soma['bn'], 'brancos_nulos_2t': soma['bn2'], 'compareceram_1t': soma['comp1'], 'compareceram_2t': soma['comp2'],
        'ganho_lula': soma['lula2'] - soma['lula'], 'ganho_flavio': soma['flavio2'] - soma['flavio']}
    print('A.', res['conta_2o_turno'])

    # ---------------- B. transferências (urnas com o mesmo eleitorado nos dois turnos)
    uu = u[(u.aptos == u.aptos1) & (u.aptos >= 50)].copy()
    reg = json.loads((ROOT / 'dados_mapa' / 'municipios_brasileiros_tse.json').read_text(encoding='utf-8'))
    REG = {'N': 'Norte', 'NE': 'Nordeste', 'CO': 'Centro-Oeste', 'SE': 'Sudeste', 'S': 'Sul'}
    UF_REG = {**{u_: 'Norte' for u_ in 'AC AM AP PA RO RR TO'.split()}, **{u_: 'Nordeste' for u_ in 'AL BA CE MA PB PE PI RN SE'.split()},
              **{u_: 'Centro-Oeste' for u_ in 'DF GO MS MT'.split()}, **{u_: 'Sudeste' for u_ in 'ES MG RJ SP'.split()},
              **{u_: 'Sul' for u_ in 'PR RS SC'.split()}, 'ZZ': 'Exterior'}
    uu['regiao'] = uu.SG_UF.map(UF_REG)
    B, lo, hi, r2 = transferencias(uu, rng)
    tab = {}
    for i, o in enumerate(ORIG):
        tab[o] = {'nome': NOMES[o], 'votos_1t': int(uu[o].sum()),
                  **{d.replace('2', ''): {'taxa': r1(100 * B[i, k], 1), 'min': r1(100 * lo[i, k], 1), 'max': r1(100 * hi[i, k], 1)} for k, d in enumerate(DEST)}}
    pred = {d: float((uu[ORIG].to_numpy(float) @ B[:, k]).sum()) for k, d in enumerate(DEST)}
    res['transferencias'] = {'metodo': 'regressão ecológica por urna com limites (cada taxa entre 0 e 100%, cada linha soma 100%), '
                                       'ponderada pelo eleitorado; faixa = 90% de 200 reamostragens de municípios',
                             'urnas': int(len(uu)), 'r2_por_destino': r2, 'tabela': tab,
                             'reproduz_total': {d: {'previsto': int(pred[d]), 'real': int(uu[d].sum())} for d in DEST}}
    por_reg = {}
    for rg, d in uu.groupby('regiao'):
        if rg == 'Exterior':
            continue
        X = d[ORIG].to_numpy(float) / d.aptos.to_numpy(float)[:, None]
        Y = d[DEST].to_numpy(float) / d.aptos.to_numpy(float)[:, None]
        w = d.aptos.to_numpy(float)
        Br = matriz((X * w[:, None]).T @ X, (X * w[:, None]).T @ Y)
        por_reg[rg] = {o: {dd.replace('2', ''): r1(100 * Br[i, k], 1) for k, dd in enumerate(DEST)} for i, o in enumerate(ORIG)}
    res['transferencias']['por_regiao'] = por_reg

    # versão simples (4 origens, 3 destinos): menos parâmetros, estimativas mais estáveis
    uu['terceiros'] = uu[['cury', 'renan', 'caiado', 'zema', 'pequenos']].sum(1)
    uu['nenhum'] = uu.bn + uu.abst
    uu['nenhum2'] = uu.bn2 + uu.abst2
    OS, DS = ['lula', 'flavio', 'terceiros', 'nenhum'], ['lula2', 'flavio2', 'nenhum2']
    Bs, los, his, r2s = transferencias(uu, rng, OS, DS)
    # mesma conta estado por estado (cada estado com as suas taxas), somando os votos que mudaram de lado
    fluxo_uf = np.zeros((len(OS), len(DS)))
    por_uf = {}
    for uf_, d in uu.groupby('SG_UF'):
        X = d[OS].to_numpy(float) / d.aptos.to_numpy(float)[:, None]
        Y = d[DS].to_numpy(float) / d.aptos.to_numpy(float)[:, None]
        w = d.aptos.to_numpy(float)
        Bu = matriz((X * w[:, None]).T @ X, (X * w[:, None]).T @ Y)
        f = d[OS].sum().to_numpy(float)[:, None] * Bu
        fluxo_uf += f
        por_uf[uf_] = {'terceiros_lula': r1(100 * Bu[2, 0], 1), 'terceiros_flavio': r1(100 * Bu[2, 1], 1), 'terceiros_nenhum': r1(100 * Bu[2, 2], 1),
                       'nenhum_lula': r1(100 * Bu[3, 0], 1), 'nenhum_flavio': r1(100 * Bu[3, 1], 1), 'votos_terceiros': int(d.terceiros.sum())}
    tot_o = uu[OS].sum().to_numpy(float)
    res['transferencias']['simples'] = {
        'origens': OS, 'destinos': DS, 'r2_por_destino': r2s,
        'taxas': {o: {d.replace('2', ''): {'taxa': r1(100 * Bs[i, k], 1), 'min': r1(100 * los[i, k], 1), 'max': r1(100 * his[i, k], 1)}
                      for k, d in enumerate(DS)} for i, o in enumerate(OS)},
        'votos_origem': {o: int(v) for o, v in zip(OS, tot_o)},
        'fluxos_modelo_nacional': {o: {d.replace('2', ''): int(tot_o[i] * Bs[i, k]) for k, d in enumerate(DS)} for i, o in enumerate(OS)},
        'fluxos_somando_estados': {o: {d.replace('2', ''): int(fluxo_uf[i, k]) for k, d in enumerate(DS)} for i, o in enumerate(OS)},
        'por_uf': por_uf}
    print('B simples', json.dumps(res['transferencias']['simples']['taxas'], ensure_ascii=False))
    print('  fluxos nacional', res['transferencias']['simples']['fluxos_modelo_nacional'])
    print('  fluxos por estado', res['transferencias']['simples']['fluxos_somando_estados'])
    print('B.', json.dumps({o: tab[o] for o in ('cury', 'renan', 'caiado', 'zema', 'abst', 'bn')}, ensure_ascii=False)[:1500], r2)

    # ---------------- C. 2022 → 2026
    m = pd.read_csv(ROOT / 'analise' / 'comparacao_2022_2026' / 'municipios_2022_2026.csv', sep=';', dtype={'codigo_municipio': str})
    cw = {(c['uf'], int(c['codigo_tse'])): c['codigo_ibge'] for c in reg}
    m['ibge'] = [cw.get((a, int(b))) for a, b in zip(m.uf, m.codigo_municipio)]
    ib = pd.read_csv(ROOT / 'dados_ibge' / 'municipios_ibge.csv')
    m = m.merge(ib, on='ibge', how='left')
    m['V22'], m['V26'] = m.lula2_22 + m.flavio2_22, m.lula2_26 + m.flavio2_26
    m['M22'], m['M26'] = m.lula2_22 - m.flavio2_22, m.lula2_26 - m.flavio2_26
    m['p22'], m['p26'] = 100 * m.lula2_22 / m.V22, 100 * m.lula2_26 / m.V26
    m['swing'] = m.p26 - m.p22
    m['ef_voto'] = m.V22 * (m.M26 / m.V26 - m.M22 / m.V22)       # mesma quantidade de votantes, voto diferente
    m['ef_votantes'] = (m.V26 - m.V22) * (m.M26 / m.V26)          # votantes a mais (ou a menos), votando como em 2026
    tot = {k: int(m[k].sum()) for k in ('M22', 'M26', 'V22', 'V26')}
    res['de_2022_a_2026'] = {
        'vantagem_lula_2022': tot['M22'], 'vantagem_lula_2026': tot['M26'], 'mudanca': tot['M26'] - tot['M22'],
        'por_mudanca_de_voto': int(m.ef_voto.sum()), 'por_mudanca_no_numero_de_votantes': int(m.ef_votantes.sum()),
        'validos_2022': tot['V22'], 'validos_2026': tot['V26'],
        'lula_pct_2022': r1(100 * m.lula2_22.sum() / tot['V22']), 'lula_pct_2026': r1(100 * m.lula2_26.sum() / tot['V26']),
        'municipios_em_que_lula_melhorou': int((m.swing > 0).sum()), 'municipios': int(m.swing.notna().sum()),
        'eleitorado_em_municipios_em_que_lula_melhorou_pct': r1(100 * m.loc[m.swing > 0, 'aptos2_26'].sum() / m.aptos2_26.sum(), 1),
        'swing_mediano_municipio': r1(m.swing.median()), 'swing_medio_ponderado': r1(media_pond(m.swing, m.V26))}
    grupos = {}
    m['porte'] = pd.cut(m['pop'], [0, 10_000, 50_000, 200_000, 1_000_000, 1e9], labels=['até 10 mil', '10 a 50 mil', '50 a 200 mil', '200 mil a 1 milhão', 'mais de 1 milhão'])
    for nome, col in (('regiao', 'regiao'), ('uf', 'uf'), ('porte', 'porte')):
        g = m.groupby(col, observed=True).agg(M22=('M22', 'sum'), M26=('M26', 'sum'), ef_voto=('ef_voto', 'sum'), ef_votantes=('ef_votantes', 'sum'),
                                              V22=('V22', 'sum'), V26=('V26', 'sum'), l22=('lula2_22', 'sum'), l26=('lula2_26', 'sum'), n=('swing', 'size'))
        grupos[nome] = [{'grupo': str(k), 'municipios': int(r.n), 'votos_validos_2026': int(r.V26),
                         'lula_2022': r1(100 * r.l22 / r.V22), 'lula_2026': r1(100 * r.l26 / r.V26), 'mudanca_pp': r1(100 * r.l26 / r.V26 - 100 * r.l22 / r.V22),
                         'vantagem_2022': int(r.M22), 'vantagem_2026': int(r.M26), 'mudanca_vantagem': int(r.M26 - r.M22),
                         'por_voto': int(r.ef_voto), 'por_votantes': int(r.ef_votantes)} for k, r in g.iterrows()]
    res['de_2022_a_2026']['grupos'] = grupos

    # ---------------- D. perfil
    ok = m.dropna(subset=['swing', 'renda_pc', 'pct_evangelicos', 'pct_outras_fontes', 'pop']).copy()
    w = ok.V26.to_numpy(float)
    perfis = {}
    for col, rot in (('renda_pc', 'Renda por pessoa'), ('pct_evangelicos', 'Evangélicos'), ('pct_outras_fontes', 'Renda que não vem do trabalho'),
                     ('densidade', 'Densidade')):
        x = ok[col].to_numpy(float)
        cortes, o = faixas_por_eleitor(x, w)
        grp = np.zeros(len(x), int)
        grp[o] = np.searchsorted(np.r_[cortes, len(x)], np.arange(len(x)), side='right')
        lin = []
        for q in range(5):
            sel = grp == q
            d = ok[sel]
            lin.append({'quinto': q + 1, 'de': r1(x[sel].min(), 1), 'ate': r1(x[sel].max(), 1), 'municipios': int(sel.sum()),
                        'lula_2022': r1(100 * d.lula2_22.sum() / d.V22.sum()), 'lula_2026': r1(100 * d.lula2_26.sum() / d.V26.sum()),
                        'mudanca_pp': r1(100 * d.lula2_26.sum() / d.V26.sum() - 100 * d.lula2_22.sum() / d.V22.sum()),
                        'mudanca_vantagem': int(d.M26.sum() - d.M22.sum())})
        perfis[col] = {'rotulo': rot, 'quintos': lin}
    res['perfil'] = perfis

    # regressão: mudança de Lula (pp) ~ perfil padronizado + região, ponderada por votos válidos
    Z = pd.DataFrame({'log_pop': np.log(ok['pop']), 'renda_pc': ok.renda_pc, 'pct_evangelicos': ok.pct_evangelicos,
                      'pct_outras_fontes': ok.pct_outras_fontes, 'lula_2022': ok.p22})
    mu, sd = Z.apply(lambda c: media_pond(c, w)), Z.apply(lambda c: np.sqrt(media_pond((c - media_pond(c, w)) ** 2, w)))
    Zs = (Z - mu) / sd
    regs = pd.get_dummies(ok.regiao).drop(columns='Sudeste').astype(float)
    Xr = np.column_stack([np.ones(len(ok)), Zs.to_numpy(), regs.to_numpy()])
    nomes = ['constante', *Zs.columns, *[f'regiao_{c}' for c in regs.columns]]
    y = ok.swing.to_numpy(float)
    W = np.sqrt(w)
    beta, *_ = np.linalg.lstsq(Xr * W[:, None], y * W, rcond=None)
    e = y - Xr @ beta
    r2 = 1 - np.average(e ** 2, weights=w) / np.average((y - np.average(y, weights=w)) ** 2, weights=w)
    # erro padrão robusto por estado (municípios do mesmo estado não são independentes)
    XtWXi = np.linalg.inv((Xr * w[:, None]).T @ Xr)
    meat = np.zeros((Xr.shape[1],) * 2)
    for _, idx in ok.reset_index(drop=True).groupby('uf').groups.items():
        sc = (Xr[idx] * (w[idx] * e[idx])[:, None]).sum(0)
        meat += np.outer(sc, sc)
    se = np.sqrt(np.diag(XtWXi @ meat @ XtWXi))
    res['regressao'] = {'y': 'mudança de Lula de 2022 para 2026 no 2º turno, em pontos', 'peso': 'votos válidos de 2026',
                        'r2': r1(r2, 3), 'municipios': int(len(ok)),
                        'coeficientes': {n: {'efeito_pp': r1(b, 2), 'erro_padrao': r1(s_, 2)} for n, b, s_ in zip(nomes, beta, se)},
                        'nota': 'variáveis contínuas em desvios-padrão: o efeito é a mudança de Lula, em pontos, para um município 1 desvio-padrão acima da média; regiões comparadas ao Sudeste'}

    # ---------------- E. comparecimento
    m['comp22'], m['comp26'] = m.comparecimento2_22, m.comparecimento2_26
    m['dcomp_pct'] = 100 * (m.comp26 / m.aptos2_26 - m.comp22 / m.aptos2_22)
    okc = m.dropna(subset=['dcomp_pct', 'swing'])
    wc = okc.V26.to_numpy(float)
    xc, yc = okc.dcomp_pct.to_numpy(float), okc.swing.to_numpy(float)
    bc = np.polyfit(xc, yc, 1, w=np.sqrt(wc))
    res['comparecimento'] = {'compareceram_2t_2022': int(m.comp22.sum()), 'compareceram_2t_2026': int(m.comp26.sum()),
                             'taxa_2022': r1(100 * m.comp22.sum() / m.aptos2_22.sum()), 'taxa_2026': r1(100 * m.comp26.sum() / m.aptos2_26.sum()),
                             'lula_pp_por_ponto_de_comparecimento': r1(bc[0], 3),
                             'correlacao': r1(np.corrcoef(xc, yc)[0, 1], 3)}

    # pontos para gráficos na página (amostra leve: todos os municípios, poucas casas)
    pts = ok[['ibge', 'municipio', 'uf', 'regiao', 'pop', 'renda_pc', 'pct_evangelicos', 'pct_outras_fontes', 'p22', 'p26', 'swing', 'V26']].copy()
    res['pontos_cols'] = ['ibge', 'nome', 'uf', 'regiao', 'pop', 'renda', 'evang', 'outras', 'lula22', 'lula26', 'swing', 'validos26']
    res['pontos'] = [[str(int(r.ibge)), r.municipio.title(), r.uf, r.regiao, int(r.pop), round(r.renda_pc), round(r.pct_evangelicos, 1),
                      round(r.pct_outras_fontes, 1), round(r.p22, 1), round(r.p26, 1), round(r.swing, 2), int(r.V26)] for r in pts.itertuples()]

    (OUT / 'resultados.json').write_text(json.dumps(res, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    print('C.', {k: v for k, v in res['de_2022_a_2026'].items() if k != 'grupos'})
    for k in ('regiao', 'porte'):
        for g in res['de_2022_a_2026']['grupos'][k]:
            print('  ', k, g)
    for k, v in res['perfil'].items():
        print('D.', v['rotulo'], [(q['de'], q['ate'], q['lula_2022'], q['lula_2026'], q['mudanca_pp']) for q in v['quintos']])
    print('reg', res['regressao']['r2'], res['regressao']['coeficientes'])
    print('E.', res['comparecimento'])


if __name__ == '__main__':
    main()
