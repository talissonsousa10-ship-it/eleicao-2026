"""Testes forenses da eleição presidencial (nível zona eleitoral) — 2026 e, como referência, 2022.

Pergunta de cada teste: "se tivesse havido fraude, que marca ela deixaria nos dados?"
Cada teste pode dar positivo ou negativo — por isso servem como evidência.

Pré-requisito: `python analisar.py` (gera analise/zona.csv) e, para 2022, `python preparar_2022.py`.
Dependências: pip install numpy pandas scipy matplotlib
Uso: python forense.py            (2026 → analise/forense/)
     python forense.py --ano 2022 (2022 → analise/forense_2022/; coluna "flavio" = Bolsonaro, nº 22)
Saídas: resultados.json, outliers.csv, transferencias.csv, figuras PNG
"""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parent
ANOS = {
    2026: {'zona': ROOT / 'analise' / 'zona.csv', 'votos': ROOT / 'votacao_candidato_munzona_2026_BR.csv',
           'out': ROOT / 'analise' / 'forense', 'dir': 'Flávio',
           'terceiros': {'70': 'cury', '14': 'renan', '55': 'caiado', '30': 'zema'}},
    2022: {'zona': ROOT / 'analise' / 'zona_2022.csv', 'votos': ROOT / 'dados_2022' / 'votos_zona_2022.csv',
           'out': ROOT / 'analise' / 'forense_2022', 'dir': 'Bolsonaro',
           'terceiros': {'15': 'tebet', '12': 'ciro', '44': 'soraya', '30': 'davila'}}}
ANO = 2026
CFG = ANOS[ANO]
OUT = CFG['out']
DIR = CFG['dir']  # nome do candidato nº 22 (coluna "flavio")

REGIAO = {**dict.fromkeys(['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'], 'Norte'),
          **dict.fromkeys(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'], 'Nordeste'),
          **dict.fromkeys(['DF', 'GO', 'MS', 'MT'], 'Centro-Oeste'),
          **dict.fromkeys(['ES', 'MG', 'RJ', 'SP'], 'Sudeste'),
          **dict.fromkeys(['PR', 'RS', 'SC'], 'Sul'), 'ZZ': 'Exterior'}
CORES = {'Norte': '#2a9d8f', 'Nordeste': '#e76f51', 'Centro-Oeste': '#e9c46a',
         'Sudeste': '#264653', 'Sul': '#8d6cab', 'Exterior': '#999999'}
LULA, FLAVIO = '#c0392b', '#1f5fa8'


def configurar(ano):
    global ANO, CFG, OUT, DIR
    ANO, CFG = ano, ANOS[ano]
    OUT, DIR = CFG['out'], CFG['dir']


def terceiros_1t():
    """Votos de cada candidato além dos finalistas no 1º turno, por zona."""
    por = defaultdict(lambda: defaultdict(int))
    if ANO == 2026:
        with CFG['votos'].open(encoding='latin1', newline='') as f:
            linhas = [(r['NR_TURNO'], r['SG_UF'], r['CD_MUNICIPIO'], r['NR_ZONA'], r['NR_CANDIDATO'],
                       r['QT_VOTOS_NOMINAIS_VALIDOS']) for r in csv.DictReader(f, delimiter=';')]
    else:
        g = pd.read_csv(CFG['votos'], sep=';')
        linhas = g[['NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_VOTAVEL', 'QT_VOTOS']].astype(str).to_numpy()
    for turno, uf, mun, zona, nr, votos in linhas:
        if turno != '1' or nr in ('13', '22', '95', '96', '97'):
            continue
        por[(uf, str(int(mun)).zfill(5), str(int(zona)))][CFG['terceiros'].get(nr, 'pequenos')] += int(votos)
    return por


def carregar():
    z = pd.read_csv(CFG['zona'], sep=';', encoding='utf-8-sig', dtype={'codigo_municipio': str, 'zona': str})
    z['regiao'] = z['uf'].map(REGIAO)
    por = terceiros_1t()
    nomes = [*CFG['terceiros'].values(), 'pequenos']
    for c in nomes:
        z[c + '1'] = [por[(u, m, zz)][c] for u, m, zz in zip(z.uf, z.codigo_municipio, z.zona)]
    assert (z[[c + '1' for c in nomes]].sum(axis=1) == z.outros1).all(), 'Terceiros não batem com outros1'
    for t in '12':
        z['bn' + t] = z['brancos' + t] + z['nulos' + t]
        z['comp_pct' + t] = z['comparecimento' + t] / z['aptos' + t]
        z['lula_val' + t] = z['lula' + t] / z['validos' + t]
        z['flavio_val' + t] = z['flavio' + t] / z['validos' + t]
    return z


# ---------- Teste 1: impressão digital comparecimento × votação (Klimek et al., PNAS 2012)
def teste_impressao_digital(d):
    """Enchimento de urna empurra unidades para o canto de comparecimento alto E voto alto
    num só candidato, formando uma 'mancha' ou um pico perto de 100%."""
    res = {}
    fig, axes = plt.subplots(2, 2, figsize=(11, 9), sharex=True, sharey=True)
    for i, (cand, cor) in enumerate([('lula', 'Reds'), ('flavio', 'Blues')]):
        for j, t in enumerate('12'):
            x, y, w = d['comp_pct' + t], d[cand + '_val' + t], d['aptos' + t]
            ax = axes[i, j]
            ax.hexbin(x, y, C=w, reduce_C_function=np.sum, gridsize=45, cmap=cor, bins='log',
                      extent=(0.4, 1, 0, 1), mincnt=1)
            ax.set_title(f"{'Lula' if cand == 'lula' else DIR} — {t}º turno ({ANO})")
            ax.axvline(0.9, color='k', lw=0.6, ls=':')
            ax.axhline(0.8, color='k', lw=0.6, ls=':')
            canto = (x > 0.9) & (y > 0.8)
            # correlação dentro de cada UF (remove o efeito "região vota diferente e comparece diferente")
            dentro = []
            for uf, g in d.groupby('uf'):
                if len(g) >= 10:
                    dentro.append((stats.spearmanr(g['comp_pct' + t], g[cand + '_val' + t])[0], g['aptos' + t].sum()))
            r_uf = np.average([r for r, _ in dentro], weights=[p for _, p in dentro])
            res[f'{cand}_t{t}'] = {
                'zonas_canto_comp90_voto80': int(canto.sum()),
                'eleitorado_no_canto_pct': round(100 * w[canto].sum() / w.sum(), 3),
                'zonas_voto_acima_95pct': int((y > 0.95).sum()),
                'spearman_comparecimento_voto_nacional': round(stats.spearmanr(x, y)[0], 3),
                'spearman_medio_dentro_das_UF': round(float(r_uf), 3)}
    for ax in axes[-1]:
        ax.set_xlabel('Comparecimento (comparecimento / aptos)')
    for ax in axes[:, 0]:
        ax.set_ylabel('Votos do candidato / válidos')
    fig.suptitle(f'Teste 1 ({ANO}) — Impressão digital eleitoral por zona (cor = eleitores aptos, escala log)\n'
                 'Fraude por enchimento apareceria como mancha no canto superior direito (linhas pontilhadas)')
    fig.tight_layout()
    fig.savefig(OUT / 'teste1_impressao_digital.png', dpi=150)
    plt.close(fig)
    return res


# ---------- Teste 2: os eleitores "a mais" do 2º turno foram todos para um lado?
def teste_novos_eleitores(d):
    """Enchimento no 2º turno: o aumento de comparecimento viraria quase 100% voto de um
    candidato. Mede-se a fração do comparecimento extra que foi para cada um, controlando
    pelos votos de terceiros e brancos/nulos do 1º turno (regressão ponderada, base aptos)."""
    a = d['aptos1']
    X = np.column_stack([np.ones(len(d)), d['delta_comparecimento'] / a, d['outros1'] / a, d['bn1'] / a])
    W = np.sqrt(a.to_numpy())
    res = {}
    for cand in ('lula', 'flavio'):
        y = (d['delta_' + cand] / a).to_numpy()
        beta, *_ = np.linalg.lstsq(X * W[:, None], y * W, rcond=None)
        resid = y - X @ beta
        # erro-padrão robusto (HC1) com pesos
        Xw, rw = X * W[:, None], resid * W
        bread = np.linalg.inv(Xw.T @ Xw)
        meat = (Xw * rw[:, None] ** 2).T @ Xw
        se = np.sqrt(np.diag(bread @ meat @ bread) * len(d) / (len(d) - X.shape[1]))
        simples = np.polyfit(d['delta_comparecimento'] / a, y, 1, w=W)[0]
        res[cand] = {'fracao_do_comparecimento_extra': round(beta[1], 3), 'erro_padrao': round(se[1], 3),
                     'inclinacao_simples_sem_controles': round(float(simples), 3),
                     'fracao_dos_votos_de_terceiros': round(beta[2], 3),
                     'fracao_dos_brancos_nulos_1t': round(beta[3], 3)}
    d = d.assign(dcomp=d['delta_comparecimento'] / a)
    d['quintil'] = pd.qcut(d['dcomp'], 5, labels=['Q1 (menor)', 'Q2', 'Q3', 'Q4', 'Q5 (maior)'])
    q = d.groupby('quintil', observed=True).apply(lambda g: pd.Series({
        'zonas': len(g), 'aumento_comparecimento_pp': 100 * g['delta_comparecimento'].sum() / g['aptos1'].sum(),
        'ganho_lula_pct_aptos': 100 * g['delta_lula'].sum() / g['aptos1'].sum(),
        'ganho_flavio_pct_aptos': 100 * g['delta_flavio'].sum() / g['aptos1'].sum()}), include_groups=False)
    res['por_quintil_de_aumento_do_comparecimento'] = q.round(3).reset_index().to_dict('records')

    fig, ax = plt.subplots(figsize=(9.5, 5.5))
    x = np.arange(len(q))
    w = 0.27
    ax.bar(x - w, q['aumento_comparecimento_pp'], w, color='#999', label='Variação do comparecimento')
    ax.bar(x, q['ganho_lula_pct_aptos'], w, color=LULA, label='Ganho de Lula')
    ax.bar(x + w, q['ganho_flavio_pct_aptos'], w, color=FLAVIO, label=f'Ganho de {DIR}')
    for xi, v in zip(x, q['ganho_lula_pct_aptos']):
        ax.text(xi, max(v, 0) + 0.15, f'{v:.1f}', ha='center', fontsize=8, color=LULA)
    for xi, v in zip(x + w, q['ganho_flavio_pct_aptos']):
        ax.text(xi, max(v, 0) + 0.15, f'{v:.1f}', ha='center', fontsize=8, color=FLAVIO)
    ax.axhline(0, color='k', lw=0.6)
    ax.set_xticks(x, q.index)
    ax.set_xlabel(f'Zonas agrupadas pelo aumento de comparecimento entre turnos (quintis, ~{len(d) // 5} zonas cada)')
    ax.set_ylabel('Pontos percentuais dos eleitores aptos')
    l, f_ = res['lula']['fracao_do_comparecimento_extra'], res['flavio']['fracao_do_comparecimento_extra']
    ax.set_title(f'Teste 2 ({ANO}) — Para onde foram os eleitores extras do 2º turno?\n'
                 f'De cada 100 eleitores a mais, ~{100 * l:.0f} foram para Lula e ~{100 * f_:.0f} para {DIR} '
                 '(enchimento de urna daria ~100 para um só)', fontsize=10)
    ax.legend(fontsize=8, frameon=False)
    fig.tight_layout()
    fig.savefig(OUT / 'teste2_novos_eleitores.png', dpi=150)
    plt.close(fig)
    return res


# ---------- Teste 3: último dígito (Beber & Scacco, Political Analysis 2012)
def digitos(d):
    cols = [f'{c}{t}' for c in ('lula', 'flavio', 'brancos', 'nulos') for t in '12']
    return {c: d[c][d[c] >= 100].astype(int) for c in cols}


def teste_ultimo_digito(d):
    """Números inventados por pessoas têm último dígito desigual (preferência por 0 e 5, evitar
    repetições). Em contagens reais com 3+ dígitos, o último dígito é ~uniforme (10% cada)."""
    res, todos = {}, []
    for col, v in digitos(d).items():
        obs = np.bincount(v % 10, minlength=10)
        chi2, p = stats.chisquare(obs)
        res[col] = {'n': int(len(v)), 'qui2': round(chi2, 2), 'p': round(p, 4),
                    'pct_zero': round(100 * obs[0] / obs.sum(), 2), 'pct_cinco': round(100 * obs[5] / obs.sum(), 2)}
        todos.append(v % 10)
    obs = np.bincount(np.concatenate(todos), minlength=10)
    chi2, p = stats.chisquare(obs)
    res['todas_as_contagens'] = {'n': int(obs.sum()), 'qui2': round(chi2, 2), 'p': round(p, 4)}
    v2 = np.concatenate([v[v >= 1000] % 100 for v in digitos(d).values()])
    chi2b, pb = stats.chisquare(np.bincount(v2, minlength=100))
    res['ultimos_dois_digitos'] = {'n': int(len(v2)), 'qui2': round(chi2b, 2), 'p': round(pb, 4)}
    res['p_minimo_individual'] = min(r['p'] for k, r in res.items() if k[-1] in '12')
    res['limiar_bonferroni_5pct'] = round(0.05 / 8, 5)

    fig, axes = plt.subplots(2, 4, figsize=(13, 5.5), sharey=True)
    for ax, (col, v) in zip(axes.flat, digitos(d).items()):
        freq = 100 * np.bincount(v % 10, minlength=10) / len(v)
        ax.bar(range(10), freq, color=LULA if col.startswith('lula') else FLAVIO if col.startswith('flavio') else '#777')
        ax.axhline(10, color='k', ls='--', lw=0.8)
        ax.set_ylim(7, 13)
        ax.set_xticks(range(10))
        nome = {'lula': 'Lula', 'flavio': DIR, 'brancos': 'Brancos', 'nulos': 'Nulos'}[col[:-1]]
        ax.set_title(f"{nome} {col[-1]}º turno (p = {res[col]['p']:.2f})", fontsize=9)
    fig.suptitle(f'Teste 3 ({ANO}) — Frequência do último dígito (%) por zona; linha = 10% esperado sem manipulação')
    fig.tight_layout()
    fig.savefig(OUT / 'teste3_ultimo_digito.png', dpi=150)
    plt.close(fig)
    return res


# ---------- Teste 4: segundo dígito de Benford (Mebane) — auxiliar, com ressalvas
def teste_benford(d):
    """Primeiro dígito de Benford NÃO se aplica: zonas têm tamanho limitado por lei e por
    geografia, então as contagens não se espalham por várias ordens de grandeza. O 2º dígito
    (2BL) é o teste usado na literatura, mas é sensível a processos legítimos; serve só de apoio."""
    p2 = np.array([sum(np.log10(1 + 1 / (10 * k + dd)) for k in range(1, 10)) for dd in range(10)])
    media_esp = float((np.arange(10) * p2).sum())
    dp_esp = float(np.sqrt(((np.arange(10) - media_esp) ** 2 * p2).sum()))
    p1 = np.log10(1 + 1 / np.arange(1, 10))
    res = {'media_esperada_2BL': round(media_esp, 3)}
    for col in ('lula1', 'lula2', 'flavio1', 'flavio2'):
        v = d[col][d[col] >= 10].astype(int).astype(str)
        seg = v.str[1].astype(int).to_numpy()
        pri = v.str[0].astype(int).to_numpy()
        m = seg.mean()
        z = (m - media_esp) / (dp_esp / np.sqrt(len(seg)))
        chi1 = stats.chisquare(np.bincount(pri, minlength=10)[1:], p1 * len(pri))
        res[col] = {'n': int(len(seg)), 'media_2o_digito': round(m, 3), 'z_media': round(z, 2),
                    'p_qui2_2o_digito': round(stats.chisquare(np.bincount(seg, minlength=10), p2 * len(seg))[1], 4),
                    'p_qui2_1o_digito_(nao_aplicavel)': float(f'{chi1[1]:.3g}')}
    return res


# ---------- Teste 5: o 2º turno é previsível a partir do 1º? Quem foge do padrão?
def teste_consistencia(d):
    """Regressão ecológica (Goodman): a parcela de cada finalista no 2º turno (base aptos)
    explicada pela composição do 1º turno. Fraude localizada aparece como zonas que fogem do
    padrão (resíduos extremos) concentradas a favor de um candidato."""
    a = d['aptos1']
    cats = ['lula1', 'flavio1', *[c + '1' for c in CFG['terceiros'].values()], 'pequenos1', 'bn1', 'abst1']
    d = d.assign(abst1=d['abstencoes1'] + d['nao_instaladas1'])
    X = np.column_stack([d[c] / a for c in cats])
    W = np.sqrt(a.to_numpy())
    saida, trans = {}, {}
    for alvo, cols in [('lula', ['lula2']), ('flavio', ['flavio2']),
                       ('nao_votou_ou_branco_nulo', ['bn2', 'abstencoes2', 'nao_instaladas2'])]:
        y = (d[cols].sum(axis=1) / d['aptos2']).to_numpy()
        beta, *_ = np.linalg.lstsq(X * W[:, None], y * W, rcond=None)
        pred = X @ beta
        trans[alvo] = dict(zip(cats, np.round(beta, 3)))
        r2 = 1 - np.average((y - pred) ** 2, weights=a) / np.average((y - np.average(y, weights=a)) ** 2, weights=a)
        saida[alvo] = {'r2_ponderado': round(r2, 4)}
        if alvo == 'lula':
            d['pred_lula2'] = pred * d['aptos2']
        if alvo == 'flavio':
            d['pred_flavio2'] = pred * d['aptos2']
    d['resid_margem_votos'] = (d['lula2'] - d['pred_lula2']) - (d['flavio2'] - d['pred_flavio2'])
    rm = 100 * d['resid_margem_votos'] / d['aptos2']
    mad = 1.4826 * np.median(np.abs(rm - np.median(rm)))
    d['z_robusto'] = (rm - np.median(rm)) / mad
    out = d[d['z_robusto'].abs() > 4].copy()
    pro_lula, pro_flavio = out[out.z_robusto > 0], out[out.z_robusto < 0]
    # pontos do gráfico "previsto × real" (para a página)
    pd.DataFrame({'previsto_lula_pct_aptos': (100 * d['pred_lula2'] / d['aptos2']).round(2),
                  'real_lula_pct_aptos': (100 * d['lula2'] / d['aptos2']).round(2),
                  'aptos': d['aptos2'], 'z_robusto': d['z_robusto'].round(2),
                  'fora_do_padrao': np.sign(d['z_robusto']).where(d['z_robusto'].abs() > 4, 0).astype(int)}).to_csv(OUT / 'zonas_previsto_real.csv', sep=';', index=False)
    margem = int(d['margem2'].sum())
    saida['outliers'] = {
        'criterio': '|z robusto| > 4 no resíduo da margem',
        'desvio_tipico_da_margem_pp_(MAD)': round(float(mad), 3),
        'zonas': int(len(out)), 'a_favor_de_lula': int(len(pro_lula)), 'a_favor_do_22': int(len(pro_flavio)),
        'eleitores_aptos_nessas_zonas_pct': round(100 * out['aptos2'].sum() / d['aptos2'].sum(), 2),
        'binomial_p_(simetria)': round(stats.binomtest(len(pro_lula), len(out)).pvalue, 4) if len(out) else None,
        'efeito_liquido_na_margem_votos': int(out['resid_margem_votos'].sum()),
        'margem_nacional_real': margem,
        'margem_sem_o_excesso_dos_outliers_pro_lula': int(margem - pro_lula['resid_margem_votos'].sum()),
        'margem_excluindo_todas_zonas_outlier': int(d.loc[d['z_robusto'].abs() <= 4, 'margem2'].sum())}
    precisa = abs(margem) / 2
    saida['tamanho_da_fraude_necessaria'] = {
        'votos_a_trocar_de_lado': int(np.ceil(precisa)),
        'pct_dos_validos_2t': round(100 * precisa / d['validos2'].sum(), 2),
        'zonas_medianas_inteiras_equivalentes': round(precisa / d['validos2'].median(), 0),
        'zonas_com_maior_ganho_de_margem_necessarias_para_somar_isso':
            int((d['delta_margem'].sort_values(ascending=margem < 0).abs().cumsum() < precisa).sum() + 1)}
    trans_df = pd.DataFrame(trans).T
    cols_o = ['uf', 'municipio', 'zona', 'regiao', 'aptos2', 'lula_val1', 'lula_val2', 'comp_pct1', 'comp_pct2',
              'resid_margem_votos', 'z_robusto']
    out.sort_values('z_robusto', key=np.abs, ascending=False)[[c for c in cols_o if c in out]].round(4).to_csv(
        OUT / 'outliers.csv', sep=';', index=False, encoding='utf-8-sig')
    trans_df.to_csv(OUT / 'transferencias.csv', sep=';', encoding='utf-8-sig')

    fig, axes = plt.subplots(1, 2, figsize=(13, 5.5))
    ax = axes[0]
    for reg, g in d.groupby('regiao'):
        ax.scatter(100 * g['pred_lula2'] / g['aptos2'], 100 * g['lula2'] / g['aptos2'], s=np.sqrt(g['aptos2']) / 6,
                   alpha=0.45, color=CORES[reg], label=reg, edgecolors='none')
    ax.plot([0, 90], [0, 90], 'k--', lw=0.8)
    ax.set_xlabel('Lula no 2º turno PREVISTO pelo 1º turno (% dos aptos)')
    ax.set_ylabel('Lula no 2º turno REAL (% dos aptos)')
    ax.set_title(f"Previsto × real (R² = {saida['lula']['r2_ponderado']:.3f})")
    ax.legend(fontsize=8, markerscale=0.6)
    ax = axes[1]
    ax.hist(d['z_robusto'].clip(-12, 12), bins=120, color='#555')
    ax.axvline(-4, color=FLAVIO, ls='--')
    ax.axvline(4, color=LULA, ls='--')
    ax.set_yscale('log')
    ax.set_xlabel('Desvio da margem em relação ao previsto (z robusto; cortado em ±12)')
    ax.set_ylabel('Zonas (escala log)')
    ax.set_title(f"Outliers: {len(pro_lula)} pró-Lula (direita) × {len(pro_flavio)} pró-{DIR} (esquerda)")
    fig.suptitle(f'Teste 5 ({ANO}) — Consistência entre turnos por zona')
    fig.tight_layout()
    fig.savefig(OUT / 'teste5_consistencia.png', dpi=150)
    plt.close(fig)
    saida['transferencias_estimadas'] = trans_df.round(3).to_dict()
    return saida


# ---------- Teste 6: viradas municipais acontecem onde o 1º turno foi apertado?
def teste_viradas(d):
    m = d[d.uf != 'ZZ'].groupby(['uf', 'codigo_municipio']).agg(
        lula1=('lula1', 'sum'), flavio1=('flavio1', 'sum'), lula2=('lula2', 'sum'), flavio2=('flavio2', 'sum'),
        validos1=('validos1', 'sum'))
    m['margem1_pp'] = 100 * (m.lula1 - m.flavio1) / m.validos1
    v = m[(m.lula1 < m.flavio1) & (m.lula2 > m.flavio2)]
    inv = m[(m.lula1 > m.flavio1) & (m.lula2 < m.flavio2)]
    res = {'municipios_virada_lula': int(len(v)), 'municipios_virada_do_22': int(len(inv)),
           'margem_1t_mediana_todos_municipios_pp': round(float(m['margem1_pp'].median()), 2)}
    if len(v):
        res.update({'margem_1t_mediana_nas_viradas_lula_pp': round(float(v['margem1_pp'].median()), 2),
                    'pct_viradas_lula_com_desvantagem_ate_5pp': round(100 * float((v['margem1_pp'] > -5).mean()), 1),
                    'maior_desvantagem_revertida_por_lula_pp': round(float(v['margem1_pp'].min()), 2)})
    if len(inv):
        res.update({'margem_1t_mediana_nas_viradas_do_22_pp': round(float(inv['margem1_pp'].median()), 2),
                    'pct_viradas_do_22_com_desvantagem_ate_5pp': round(100 * float((inv['margem1_pp'] < 5).mean()), 1),
                    'maior_desvantagem_revertida_pelo_22_pp': round(float(inv['margem1_pp'].max()), 2)})
    return res


def rodar(ano):
    configurar(ano)
    OUT.mkdir(parents=True, exist_ok=True)
    z = carregar()
    dom = z[(z.uf != 'ZZ') & (z.aptos1 >= 100) & (z.validos1 > 0) & (z.validos2 > 0)].copy()
    plt.rcParams.update({'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False})
    res = {'ano': ANO, 'candidato_22': DIR,
           'unidade': 'zona eleitoral dentro do município (Brasil, sem exterior, aptos >= 100)',
           'zonas_analisadas': int(len(dom)), 'zonas_totais': int(len(z)),
           'aptos_diferentes_entre_turnos': {'zonas': int((z.aptos1 != z.aptos2).sum()),
                                             'soma_absoluta': int((z.aptos1 - z.aptos2).abs().sum()),
                                             'saldo_nacional': int((z.aptos2 - z.aptos1).sum())},
           'teste1_impressao_digital': teste_impressao_digital(dom),
           'teste2_novos_eleitores': teste_novos_eleitores(dom),
           'teste3_ultimo_digito': teste_ultimo_digito(dom),
           'teste4_benford_2o_digito': teste_benford(dom),
           'teste5_consistencia': teste_consistencia(dom),
           'teste6_viradas': teste_viradas(z)}
    (OUT / 'resultados.json').write_text(json.dumps(res, ensure_ascii=False, indent=2, default=float), encoding='utf-8')
    return res


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--ano', type=int, choices=sorted(ANOS), default=2026)
    print(json.dumps(rodar(ap.parse_args().ano), ensure_ascii=False, indent=1, default=float))
