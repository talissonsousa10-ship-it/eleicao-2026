"""Testes forenses por URNA (seção eleitoral), 2026, com 2022 como referência.

Por que urna: uma fraude pequena e concentrada em poucas urnas se dilui na zona, mas não na seção.
Testes:
  A. Integridade e impressão digital por urna (comparecimento × voto; urnas "100% de um lado")
  B. Seções irmãs: urnas do mesmo local de votação recebem eleitores parecidos; uma urna adulterada
     destoaria das vizinhas. Comparado com o 1º turno e com 2022.
  C. Modelo da urna: urnas antigas (2013/2015) votaram diferente das novas no MESMO local?
  D. Curva da apuração: a "virada" durante a contagem vem da ordem em que as regiões chegam?
Pré-requisito: python preparar_secoes.py (gera dados_secao/secoes_<ano>.csv.gz)
Uso: python forense_secoes.py      Saídas: analise/forense_secoes/
Dependências: numpy pandas matplotlib
"""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from forense import CORES, FLAVIO, LULA, REGIAO

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'analise' / 'forense_secoes'
LOCAL = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_LOCAL_VOTACAO']
NOME22 = {2022: 'Bolsonaro', 2026: 'Flávio'}


def carregar(ano):
    s = pd.read_csv(ROOT / 'dados_secao' / f'secoes_{ano}.csv.gz', sep=';', low_memory=False)
    if '_origem' in s:
        s = s[s._origem != 'right_only']  # seções não instaladas, sem votos
    s = s[s.SG_UF != 'ZZ'].copy()
    s['validos'] = s.lula + s.n22 + s.outros
    s['regiao'] = s.SG_UF.map(REGIAO)
    return s


# ---------- A. integridade e impressão digital por urna
def teste_a(s26, s22):
    res = {}
    t = s26
    tot = t.lula + t.n22 + t.outros + t.brancos + t.nulos
    res['integridade_2026'] = {
        'urnas_turno': int(len(t)),
        'urnas_com_votos_diferente_do_comparecimento': int((tot != t.QT_COMPARECIMENTO).sum()),
        'urnas_com_comparecimento_maior_que_aptos': int((t.QT_COMPARECIMENTO > t.QT_APTOS).sum()),
        'origem_do_voto': t.DS_ORIGEM_VOTO.value_counts().to_dict()}
    for ano, s in ((2022, s22), (2026, s26)):
        for turno, g in s.groupby('NR_TURNO'):
            g = g[g.validos >= 100]
            pl = g.lula / g.validos
            p22 = g.n22 / g.validos
            r = {'urnas_com_100+_validos': int(len(g)),
                 'urnas_lula_acima_95pct': int((pl > 0.95).sum()), 'urnas_22_acima_95pct': int((p22 > 0.95).sum()),
                 'urnas_com_zero_votos_lula': int((g.lula == 0).sum()), 'urnas_com_zero_votos_22': int((g.n22 == 0).sum())}
            if 'QT_APTOS' in g and g.QT_APTOS.notna().all():
                comp = g.QT_COMPARECIMENTO / g.QT_APTOS
                r['urnas_comparecimento_acima_95pct'] = int((comp > 0.95).sum())
                r['urnas_comp95_e_lula95'] = int(((comp > 0.95) & (pl > 0.95)).sum())
                r['urnas_comp95_e_22_95'] = int(((comp > 0.95) & (p22 > 0.95)).sum())
            res[f'{ano}_t{turno}'] = r
    # as urnas do 2º turno com comparecimento e Lula > 95%: como votaram no 1º turno?
    k = ['SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'NR_SECAO']
    t1, t2 = s26[s26.NR_TURNO == 1], s26[s26.NR_TURNO == 2]
    c = t2[(t2.validos >= 100) & (t2.QT_COMPARECIMENTO / t2.QT_APTOS > 0.95) & (t2.lula / t2.validos > 0.95)]
    c = c.merge(t1[k + ['lula', 'validos', 'QT_COMPARECIMENTO', 'QT_APTOS']], on=k, suffixes=('', '_t1'))
    res['urnas_comp95_lula95_no_2t'] = {
        'urnas': int(len(c)), 'votos_lula': int(c.lula.sum()), 'ufs': c.SG_UF.value_counts().to_dict(),
        'lula_mediano_no_1t_pct': round(float((100 * c.lula_t1 / c.validos_t1).median()), 1),
        'comparecimento_mediano_no_1t_pct': round(float((100 * c.QT_COMPARECIMENTO_t1 / c.QT_APTOS_t1).median()), 1)}
    # figura: impressão digital por urna em 2026
    fig, axes = plt.subplots(2, 2, figsize=(11, 9), sharex=True, sharey=True)
    for i, (col, cmap, nome) in enumerate([('lula', 'Reds', 'Lula'), ('n22', 'Blues', 'Flávio')]):
        for j, turno in enumerate((1, 2)):
            g = s26[(s26.NR_TURNO == turno) & (s26.validos >= 50)]
            ax = axes[i, j]
            ax.hexbin(g.QT_COMPARECIMENTO / g.QT_APTOS, g[col] / g.validos, gridsize=60, cmap=cmap, bins='log',
                      extent=(0.3, 1, 0, 1), mincnt=1)
            ax.axvline(0.95, color='k', lw=0.6, ls=':')
            ax.axhline(0.95, color='k', lw=0.6, ls=':')
            ax.set_title(f'{nome} — {turno}º turno 2026 (cada urna)')
    for ax in axes[-1]:
        ax.set_xlabel('Comparecimento da urna')
    for ax in axes[:, 0]:
        ax.set_ylabel('Votos do candidato / válidos da urna')
    fig.suptitle('Teste A — Impressão digital por urna (~470 mil urnas por turno; cor = nº de urnas, escala log)\n'
                 'Enchimento apareceria como mancha no canto superior direito (acima de 95% / 95%)')
    fig.tight_layout()
    fig.savefig(OUT / 'testeA_impressao_digital_urnas.png', dpi=150)
    plt.close(fig)
    return res


# ---------- B. seções irmãs
def irmas(s, turno, col='lula', min_validos=50, min_irmas=3):
    g = s[(s.NR_TURNO == turno) & (s.validos >= min_validos)].copy()
    loc = g.groupby(LOCAL)
    g['n_local'] = loc.validos.transform('size')
    g = g[g.n_local >= min_irmas]
    loc = g.groupby(LOCAL)
    v_tot, c_tot = loc.validos.transform('sum'), loc[col].transform('sum')
    p = (c_tot - g[col]) / (v_tot - g.validos)          # vizinhas, sem a própria urna
    share = g[col] / g.validos
    pc = p.clip(0.01, 0.99)                                # evita z infinito quando as vizinhas têm ~0% ou ~100%
    sd = np.sqrt(pc * (1 - pc) / g.validos)
    g['z'] = (share - p) / sd
    g['excesso_votos'] = (share - p) * g.validos           # votos acima (ou abaixo) do esperado pelas vizinhas
    return g


def resumo_irmas(g, nome22):
    out = g[g.z.abs() > 5]
    pro_l, pro_22 = out[out.z > 0], out[out.z < 0]
    return {'urnas_testadas': int(len(g)), 'locais': int(g.groupby(LOCAL).ngroups),
            'dispersao_robusta_z_(1=sorteio_puro)': round(float((1.4826 * np.median(np.abs(g.z - np.median(g.z)))) ** 2), 2),
            'urnas_destoantes_|z|>5': int(len(out)), 'pct_destoantes': round(100 * len(out) / len(g), 3),
            'destoantes_pro_lula': int(len(pro_l)), f'destoantes_pro_{nome22.lower()}': int(len(pro_22)),
            'excesso_votos_pro_lula': int(pro_l.excesso_votos.sum()),
            f'excesso_votos_pro_{nome22.lower()}': int(-pro_22.excesso_votos.sum()),
            'efeito_liquido_na_margem_(2x)': int(2 * out.excesso_votos.sum())}


def persistencia(g1, g2, rng=None):
    """As urnas que destoam no 2º turno já pendiam para o mesmo lado no 1º? (mesmos eleitores, mesmo padrão = perfil do
    local, não algo criado no 2º turno). E quantas destoariam só por acaso (sorteio puro com as mesmas vizinhanças)?"""
    k = [*LOCAL, 'NR_SECAO']
    m = g2[k + ['z', 'excesso_votos', 'regiao']].merge(g1[k + ['z']], on=k, how='left', suffixes=('2', '1'))
    o = m[m.z2.abs() > 5]
    out = {}
    for nome, sg in (('pro_lula', 1), ('pro_adversario', -1)):
        x = o[np.sign(o.z2) == sg]
        z1 = x.z1 * sg
        novas = x[z1.fillna(0) < 2]
        out[nome] = {'urnas': int(len(x)), 'ja_pendiam_no_1t_z_maior_que_2': int((z1 > 2).sum()), 'ja_destoavam_no_1t_z_maior_que_5': int((z1 > 5).sum()),
                     'z_mediano_no_1t': round(float(z1.median()), 2), 'novas_no_2t': int(len(novas)), 'excesso_votos_das_novas': int(round(novas.excesso_votos.sum())),
                     'por_regiao': {k_: int(v) for k_, v in x.regiao.value_counts().items()}}
    rng = rng or np.random.default_rng(0)
    loc = g2.groupby(LOCAL)
    p = ((loc.lula.transform('sum') - g2.lula) / (loc.validos.transform('sum') - g2.validos)).clip(0.01, 0.99)
    sorteio = []
    for _ in range(5):
        sim = rng.binomial(g2.validos.astype(int), p)
        z = (sim / g2.validos - p) / np.sqrt(p * (1 - p) / g2.validos)
        sorteio.append(int((np.abs(z) > 5).sum()))
    out['destoantes_em_sorteio_puro_5_simulacoes'] = sorteio
    return out


def teste_b(s26, s22):
    casos = {'2022 · 2º turno': (s22, 2, 2022), '2026 · 1º turno': (s26, 1, 2026), '2026 · 2º turno': (s26, 2, 2026)}
    res, gs = {}, {}
    for nome, (s, t, ano) in casos.items():
        gs[nome] = irmas(s, t)
        res[nome] = resumo_irmas(gs[nome], NOME22[ano])
    # as urnas pró-Lula destoantes no 2º turno já destoavam no 1º? (persistente = padrão do local, não do turno)
    k = [*LOCAL, 'NR_SECAO']
    a = set(map(tuple, gs['2026 · 2º turno'].loc[gs['2026 · 2º turno'].z > 5, k].values))
    b = set(map(tuple, gs['2026 · 1º turno'].loc[gs['2026 · 1º turno'].z > 5, k].values))
    res['destoantes_pro_lula_2t_que_ja_destoavam_no_1t'] = {'urnas': len(a & b), 'de': len(a)}
    res['persistencia_2026'] = persistencia(gs['2026 · 1º turno'], gs['2026 · 2º turno'])
    gs['2026 · 2º turno'].loc[gs['2026 · 2º turno'].z.abs() > 5,
                              [*LOCAL, 'NR_SECAO', 'regiao', 'validos', 'lula', 'n22', 'z', 'excesso_votos']] \
        .sort_values('z', key=np.abs, ascending=False).round(3) \
        .to_csv(OUT / 'urnas_destoantes_2026_t2.csv', sep=';', index=False, encoding='utf-8-sig')
    fig, axes = plt.subplots(1, 2, figsize=(13, 5), gridspec_kw={'width_ratios': [1.4, 1]})
    ax = axes[0]
    bins = np.arange(-15, 15.25, 0.25)
    for (nome, g), cor in zip(gs.items(), ['#999', '#e9a23b', LULA]):
        ax.hist(g.z.clip(-15, 15), bins=bins, histtype='step', lw=1.4, color=cor, label=nome, density=True)
    ax.set_yscale('log')
    ax.axvline(5, color='k', ls=':', lw=0.8)
    ax.axvline(-5, color='k', ls=':', lw=0.8)
    ax.set_xlabel('Desvio da urna em relação às vizinhas do mesmo local (z; + = mais Lula)')
    ax.set_ylabel('Fração das urnas (log)')
    ax.set_title('Distribuição dos desvios: as três curvas se sobrepõem')
    ax.legend(fontsize=8, frameon=False)
    ax = axes[1]
    nomes = list(casos)
    pl = [res[n]['excesso_votos_pro_lula'] / 1e3 for n in nomes]
    p22 = [res[n][f"excesso_votos_pro_{NOME22[casos[n][2]].lower()}"] / 1e3 for n in nomes]
    x = np.arange(len(nomes))
    ax.bar(x - 0.18, pl, 0.36, color=LULA, label='A mais para Lula')
    ax.bar(x + 0.18, p22, 0.36, color=FLAVIO, label='A mais para o nº 22')
    for xi, a, b in zip(x, pl, p22):
        ax.text(xi - 0.18, a, f'{a:.0f}', ha='center', va='bottom', fontsize=8)
        ax.text(xi + 0.18, b, f'{b:.0f}', ha='center', va='bottom', fontsize=8)
    ax.set_xticks(x, nomes, fontsize=8)
    ax.set_ylabel('Mil votos nas urnas destoantes (|z| > 5)')
    ax.set_title('Votos "fora do padrão" nas urnas destoantes')
    ax.legend(fontsize=8, frameon=False)
    fig.suptitle('Teste B — Seções irmãs: cada urna comparada com as outras urnas do mesmo local de votação')
    fig.tight_layout()
    fig.savefig(OUT / 'testeB_secoes_irmas.png', dpi=150)
    plt.close(fig)
    return res


# ---------- C. modelo da urna
def teste_c(s26):
    res = {}
    for turno in (1, 2):
        g = irmas(s26, turno)
        g['dif_pp'] = 100 * g.excesso_votos / g.validos
        m = g.groupby('CD_MODELO_URNA').apply(lambda x: pd.Series({
            'urnas': len(x), 'lula_bruto_pct': 100 * x.lula.sum() / x.validos.sum(),
            'dif_vs_vizinhas_mesmo_local_pp': np.average(x.dif_pp, weights=x.validos)}), include_groups=False)
        res[f't{turno}'] = m.round(3).reset_index().to_dict('records')
    fig, axes = plt.subplots(1, 2, figsize=(12, 4.6))
    for ax, turno in zip(axes, (1, 2)):
        m = pd.DataFrame(res[f't{turno}'])
        m = m[m.CD_MODELO_URNA > 0]
        lab = [f'UE {int(c)}' for c in m.CD_MODELO_URNA]
        ax.bar(np.arange(len(m)) - 0.2, m.lula_bruto_pct - (100 * s26[s26.NR_TURNO == turno].lula.sum()
                                                            / s26[s26.NR_TURNO == turno].validos.sum()),
               0.4, color='#bbb', label='Lula no modelo − média nacional (bruto)')
        ax.bar(np.arange(len(m)) + 0.2, m.dif_vs_vizinhas_mesmo_local_pp, 0.4, color=LULA,
               label='Diferença para urnas vizinhas do mesmo local')
        ax.axhline(0, color='k', lw=0.6)
        ax.set_xticks(np.arange(len(m)), [f'{a}\n({int(n):,} urnas)'.replace(',', '.') for a, n in zip(lab, m.urnas)], fontsize=8)
        ax.set_ylabel('pp dos válidos')
        ax.set_title(f'{turno}º turno 2026')
        ax.legend(fontsize=7, frameon=False)
    fig.suptitle('Teste C — Modelo da urna: a diferença bruta some quando se compara com urnas do mesmo local')
    fig.tight_layout()
    fig.savefig(OUT / 'testeC_modelo_urna.png', dpi=150)
    plt.close(fig)
    return res


# ---------- D. curva da apuração
def teste_d(s26):
    res = {}
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for ax, turno in zip(axes, (1, 2)):
        g = s26[s26.NR_TURNO == turno].copy()
        g['hora'] = pd.to_datetime(g.DT_RECEBIMENTO_BU_HOR_TSE, format='%d/%m/%Y %H:%M:%S', errors='coerce')
        g = g.dropna(subset=['hora']).sort_values('hora')
        g['pct_apurado'] = 100 * g.validos.cumsum() / g.validos.sum()
        g['lula_acum'] = 100 * g.lula.cumsum() / g.validos.cumsum()
        g['n22_acum'] = 100 * g.n22.cumsum() / g.validos.cumsum()
        vis = g.pct_apurado >= 1                              # o primeiro 1% é ruído de poucas urnas
        ax.plot(g.pct_apurado[vis], g.lula_acum[vis], color=LULA, lw=2, label='Lula (Brasil, acumulado)')
        ax.plot(g.pct_apurado[vis], g.n22_acum[vis], color=FLAVIO, lw=2, label='Flávio (Brasil, acumulado)')
        estab = {}
        for r, gr in g.groupby('regiao'):
            ac = 100 * gr.lula.cumsum() / gr.validos.cumsum()
            ok = (gr.validos.cumsum() / gr.validos.sum()) >= 0.01
            ax.plot(g.loc[gr.index, 'pct_apurado'][ok], ac[ok], color=CORES[r], lw=0.9, ls='--', label=f'Lula — {r}')
            depois = ac[(gr.validos.cumsum() / gr.validos.sum()) >= 0.1]
            estab[r] = round(float(depois.max() - depois.min()), 2)
        cruz = g[(g.lula_acum > g.n22_acum) != (g.lula_acum.iloc[-1] > g.n22_acum.iloc[-1])]
        virada = float(g.loc[cruz.index[-1], 'pct_apurado']) if len(cruz) else 0.0
        regs = g.groupby('regiao').apply(lambda x: float(np.average(x.pct_apurado, weights=x.validos)),
                                         include_groups=False)
        lider = 'Lula' if g.lula_acum.iloc[-1] > g.n22_acum.iloc[-1] else 'Flávio'
        res[f't{turno}'] = {'urnas': int(len(g)), 'lider_final': lider,
                            'lider_final_assumiu_a_frente_com_pct_apurado': round(virada, 1),
                            'oscilacao_lula_dentro_de_cada_regiao_apos_10pct_pp': estab,
                            'momento_medio_de_chegada_por_regiao_pct_apurado': {k: round(v, 1) for k, v in regs.items()}}
        if virada >= 1:
            ax.axvline(virada, color='k', lw=0.7, ls=':')
            ax.text(virada + 1, 20, f'{lider} passa à frente\ncom {virada:.0f}% apurado', fontsize=8)
        else:
            ax.text(45, 20, f'{lider} à frente desde o início da apuração', fontsize=8)
        ax.set_ylim(15, 85)
        ax.set_xlabel('% dos votos válidos já apurados (ordem de chegada dos boletins)')
        ax.set_ylabel('% dos válidos')
        ax.set_title(f'{turno}º turno 2026')
    axes[0].legend(fontsize=7, frameon=False, ncol=2, loc='upper right')
    fig.suptitle('Teste D — Curva da apuração: o total nacional muda porque as regiões chegam em ritmos diferentes; dentro de cada região, pouco muda')
    fig.tight_layout()
    fig.savefig(OUT / 'testeD_curva_apuracao.png', dpi=150)
    plt.close(fig)
    return res


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False})
    s26, s22 = carregar(2026), carregar(2022)
    res = {'teste_A': teste_a(s26, s22), 'teste_B_secoes_irmas': teste_b(s26, s22),
           'teste_C_modelo_urna': teste_c(s26), 'teste_D_curva_apuracao': teste_d(s26)}
    (OUT / 'resultados.json').write_text(json.dumps(res, ensure_ascii=False, indent=2, default=float), encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False, indent=1, default=float))


if __name__ == '__main__':
    main()
