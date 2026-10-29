"""Compara 2022 (Lula × Bolsonaro) com 2026 (Lula × Flávio), município a município.

Ideia: fraude em 2026 apareceria como municípios que "fogem" do próprio histórico, concentrados
a favor de Lula. Sem fraude, o mapa de 2026 deve ser o de 2022 com um deslocamento pequeno e
regular, e a dinâmica entre turnos deve se parecer com a de 2022 (que tinha o sinal trocado).

Pré-requisito: analise/zona.csv (analisar.py) e analise/zona_2022.csv (preparar_2022.py).
Uso: python comparar_anos.py      Saídas: analise/comparacao_2022_2026/
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
OUT = ROOT / 'analise' / 'comparacao_2022_2026'
SOMA = ['lula1', 'lula2', 'flavio1', 'flavio2', 'validos1', 'validos2', 'aptos2', 'comparecimento2']


def municipios(path):
    z = pd.read_csv(path, sep=';', encoding='utf-8-sig', dtype={'codigo_municipio': str})
    z = z[z.uf != 'ZZ']
    m = z.groupby(['uf', 'codigo_municipio'], as_index=False)[SOMA].sum()
    for t in '12':
        m['lula_pct' + t] = 100 * m['lula' + t] / m['validos' + t]
        m['dupla_lula' + t] = 100 * m['lula' + t] / (m['lula' + t] + m['flavio' + t])
        m['margem_pp' + t] = 100 * (m['lula' + t] - m['flavio' + t]) / m['validos' + t]
    m['comp_pct2'] = 100 * m.comparecimento2 / m.aptos2
    return m


def wstats(x, w):
    mu = np.average(x, weights=w)
    return mu, np.sqrt(np.average((x - mu) ** 2, weights=w))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({'font.size': 9, 'axes.spines.top': False, 'axes.spines.right': False})
    a, b = municipios(ROOT / 'analise' / 'zona_2022.csv'), municipios(ROOT / 'analise' / 'zona.csv')
    m = a.merge(b, on=['uf', 'codigo_municipio'], suffixes=('_22', '_26'))
    nomes = pd.read_csv(ROOT / 'analise' / 'zona.csv', sep=';', encoding='utf-8-sig', dtype={'codigo_municipio': str},
                        usecols=['uf', 'codigo_municipio', 'municipio']).drop_duplicates(['uf', 'codigo_municipio'])
    m = m.merge(nomes, on=['uf', 'codigo_municipio'], how='left')
    m['regiao'] = m.uf.map(REGIAO)
    m['swing2'] = m.lula_pct2_26 - m.lula_pct2_22          # mudança de Lula no 2º turno, 2022 → 2026 (pp)
    m['swing1'] = m.dupla_lula1_26 - m.dupla_lula1_22      # idem 1º turno, só entre os dois finalistas
    w = m.validos2_26
    nac = {ano: {'lula_2t_pct': round(100 * d.lula2.sum() / d.validos2.sum(), 2),
                 'lula_1t_pct': round(100 * d.lula1.sum() / d.validos1.sum(), 2),
                 '22_1t_pct': round(100 * d.flavio1.sum() / d.validos1.sum(), 2),
                 'ganho_lula_entre_turnos_votos': int(d.lula2.sum() - d.lula1.sum()),
                 'ganho_22_entre_turnos_votos': int(d.flavio2.sum() - d.flavio1.sum())}
           for ano, d in (('2022', a), ('2026', b))}
    mu, sd = wstats(m.swing2, w)
    med = np.median(m.swing2)
    mad = 1.4826 * np.median(np.abs(m.swing2 - med))
    m['z'] = (m.swing2 - med) / mad
    out = m[m.z.abs() > 4]
    res = {
        'municipios_pareados': int(len(m)), 'municipios_2022': int(len(a)), 'municipios_2026': int(len(b)),
        'nacional': nac,
        'persistencia': {
            'correlacao_lula_2t_2022_x_2026_municipios': round(float(np.corrcoef(m.lula_pct2_22, m.lula_pct2_26)[0, 1]), 4),
            'correlacao_ponderada': round(float(pd.Series(m.lula_pct2_22).corr(m.lula_pct2_26)), 4),
            'swing_medio_ponderado_pp': round(mu, 2), 'desvio_padrao_ponderado_pp': round(sd, 2),
            'swing_mediano_pp': round(float(med), 2), 'pct_municipios_swing_entre_-5_e_+5pp':
                round(100 * float((m.swing2.abs() <= 5).mean()), 1)},
        'outliers_swing': {
            'criterio': '|z robusto| > 4 na mudança de Lula 2022→2026 (2º turno)',
            'municipios': int(len(out)), 'pro_lula': int((out.z > 0).sum()), 'pro_22': int((out.z < 0).sum()),
            'pct_do_eleitorado_2026': round(100 * out.aptos2_26.sum() / m.aptos2_26.sum(), 2),
            'margem_lula_2026_nesses_municipios': int((out.lula2_26 - out.flavio2_26).sum()),
            'margem_lula_2026_total_pareado': int((m.lula2_26 - m.flavio2_26).sum())},
        'swing_por_regiao_pp': {r: round(float(np.average(g.swing2, weights=g.validos2_26)), 2)
                                for r, g in m.groupby('regiao')},
        'maiores_swings': m.reindex(m.z.abs().sort_values(ascending=False).index)
                          .head(15)[['uf', 'municipio', 'aptos2_26', 'lula_pct2_22', 'lula_pct2_26', 'swing2', 'z']]
                          .round(2).to_dict('records')}
    # viradas nas duas eleições: o mesmo fenômeno, com sinais trocados
    vir = {}
    for ano, d in (('2022', a), ('2026', b)):
        pro_lula = d[(d.lula1 < d.flavio1) & (d.lula2 > d.flavio2)].margem_pp1
        pro_22 = d[(d.lula1 > d.flavio1) & (d.lula2 < d.flavio2)].margem_pp1
        vir[ano] = {'viradas_lula': int(len(pro_lula)), 'viradas_22': int(len(pro_22)),
                    'mediana_distancia_1t_pp': round(float(np.median(np.abs(pd.concat([pro_lula, pro_22])))), 2),
                    'maior_distancia_1t_pp': round(float(np.abs(pd.concat([pro_lula, pro_22])).max()), 2),
                    '_serie': np.abs(pd.concat([pro_lula, pro_22])).to_numpy()}
    res['viradas'] = {k: {kk: vv for kk, vv in v.items() if kk != '_serie'} for k, v in vir.items()}
    # ganho entre turnos por região (pp dos válidos), nas duas eleições
    reg = []
    for ano, d in (('2022', a), ('2026', b)):
        d = d.assign(regiao=d.uf.map(REGIAO))
        for r, g in d.groupby('regiao'):
            reg.append({'ano': ano, 'regiao': r,
                        'lula_pp': 100 * (g.lula2.sum() / g.validos2.sum() - g.lula1.sum() / g.validos1.sum()),
                        '22_pp': 100 * (g.flavio2.sum() / g.validos2.sum() - g.flavio1.sum() / g.validos1.sum())})
    reg = pd.DataFrame(reg)
    res['ganho_entre_turnos_por_regiao_pp'] = reg.round(2).to_dict('records')
    m.round(4).to_csv(OUT / 'municipios_2022_2026.csv', sep=';', index=False, encoding='utf-8-sig')
    (OUT / 'resultados.json').write_text(json.dumps(res, ensure_ascii=False, indent=2, default=float), encoding='utf-8')

    # Figura A: o mapa de 2026 é o de 2022 deslocado?
    fig, axes = plt.subplots(1, 2, figsize=(13, 5.6))
    ax = axes[0]
    for r, g in m.groupby('regiao'):
        ax.scatter(g.lula_pct2_22, g.lula_pct2_26, s=np.sqrt(g.validos2_26) / 5, alpha=0.4, color=CORES[r],
                   label=r, edgecolors='none')
    ax.plot([0, 100], [0, 100], 'k--', lw=0.8, label='Sem mudança')
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.set_xlabel('Lula no 2º turno de 2022 (% dos válidos)')
    ax.set_ylabel('Lula no 2º turno de 2026 (% dos válidos)')
    ax.set_title(f"Cada ponto = um município (r = {res['persistencia']['correlacao_lula_2t_2022_x_2026_municipios']:.3f})")
    ax.legend(fontsize=8, markerscale=0.6, loc='upper left')
    ax = axes[1]
    ax.hist(m.swing2.clip(-20, 20), bins=np.arange(-20, 20.5, 0.5), weights=m.validos2_26 / 1e6, color='#555')
    ax.axvline(mu, color=LULA, lw=1.2)
    ax.text(mu + 1.2, ax.get_ylim()[1] * 0.92, f'média {mu:+.2f} pp', color=LULA, fontsize=9, ha='left')
    ax.set_xlabel('Mudança de Lula entre 2022 e 2026 no 2º turno (pp; cortado em ±20)')
    ax.set_ylabel('Milhões de votos válidos de 2026')
    ax.set_title(f"{res['persistencia']['pct_municipios_swing_entre_-5_e_+5pp']:.0f}% dos municípios mudaram menos de 5 pp")
    fig.suptitle('Comparação 2022 × 2026 — o resultado de 2026 é o mapa de 2022 com um deslocamento pequeno')
    fig.tight_layout()
    fig.savefig(OUT / 'comparacao_mapa_2022_2026.png', dpi=150)
    plt.close(fig)

    # Figura B: dinâmica entre turnos nas duas eleições
    fig, axes = plt.subplots(1, 2, figsize=(13, 5.2), gridspec_kw={'width_ratios': [1.25, 1]})
    ax = axes[0]
    ordem = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
    x = np.arange(len(ordem))
    bw = 0.2
    for i, (ano, col, cor, nome, alpha) in enumerate([('2022', 'lula_pp', LULA, 'Lula 2022', 0.45),
                                                      ('2022', '22_pp', FLAVIO, 'Bolsonaro 2022', 0.45),
                                                      ('2026', 'lula_pp', LULA, 'Lula 2026', 1),
                                                      ('2026', '22_pp', FLAVIO, 'Flávio 2026', 1)]):
        v = reg[reg.ano == ano].set_index('regiao').loc[ordem, col]
        ax.bar(x + (i - 1.5) * bw, v, bw, color=cor, alpha=alpha, label=nome)
    ax.axhline(0, color='k', lw=0.6)
    ax.set_xticks(x, ordem)
    ax.set_ylabel('Ganho entre 1º e 2º turno (pp dos válidos)')
    ax.set_title('Quem cresceu entre os turnos, por região')
    ax.legend(fontsize=8, frameon=False, ncol=2)
    ax = axes[1]
    bins = np.arange(0, 10.5, 0.5)
    ax.hist(vir['2022']['_serie'], bins=bins, color=FLAVIO, alpha=0.55,
            label=f"2022: {vir['2022']['viradas_22']} viradas de Bolsonaro")
    ax.hist(vir['2026']['_serie'], bins=bins, color=LULA, alpha=0.55,
            label=f"2026: {vir['2026']['viradas_lula']} viradas de Lula")
    ax.set_xlabel('Desvantagem no 1º turno do candidato que virou (pp dos válidos)')
    ax.set_ylabel('Municípios')
    ax.set_title('Viradas municipais: mesmo padrão, sinais trocados')
    ax.legend(fontsize=8, frameon=False)
    fig.suptitle('Comparação 2022 × 2026 — a virada de 2026 repete, ao contrário, o que aconteceu em 2022')
    fig.tight_layout()
    fig.savefig(OUT / 'comparacao_entre_turnos.png', dpi=150)
    plt.close(fig)
    print(json.dumps(res, ensure_ascii=False, indent=1, default=float))


if __name__ == '__main__':
    main()
