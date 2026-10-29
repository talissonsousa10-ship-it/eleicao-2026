"""Monta src/data/decisao.json (dados da página "Onde a eleição foi decidida") a partir de analise/decisao/resultados.json."""
import json, sys
from pathlib import Path
import numpy as np

ENTRADA = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / 'analise' / 'decisao' / 'resultados.json'
COMP = ENTRADA.parent.parent / 'comparacao_2022_2026' / 'resultados.json'
SAIDA = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'decisao.json'
r = json.loads(ENTRADA.read_text(encoding='utf-8'))
comp = json.loads(COMP.read_text(encoding='utf-8'))
c = r['conta_2o_turno']
t = r['transferencias']
S = t['simples']['taxas']
terc = sum(c['votos_dos_outros_candidatos'].values())
nenhum1 = (158745007 - c['compareceram_1t']) + c['brancos_nulos_1t']
orig = {'lula': c['lula_1t'], 'flavio': c['flavio_1t'], 'terceiros': terc, 'nenhum': nenhum1}
fluxos = {o: {d: round(v * S[o][d]['taxa'] / 100) for d in ('lula', 'flavio', 'nenhum')} for o, v in orig.items()}

# a checagem estado por estado foi feita nas urnas analisadas (mesmo eleitorado nos dois turnos); leva para o total do país
es = t['simples']['fluxos_somando_estados']
escala = {o: orig[o] / sum(es[o].values()) for o in orig}
fluxos_estados = {o: {d: round(v * escala[o]) for d, v in es[o].items()} for o in orig}

cols = r['pontos_cols']
P = np.array([[p[cols.index(k)] for k in ('pop', 'swing', 'validos26', 'renda', 'evang', 'outras')] for p in r['pontos']], float)
w = P[:, 2]
def sdw(x):
    m = np.average(x, weights=w); return float(np.sqrt(np.average((x - m) ** 2, weights=w)))
sd = {'log_pop': sdw(np.log(P[:, 0])), 'renda_pc': sdw(P[:, 3]), 'pct_evangelicos': sdw(P[:, 4]), 'pct_outras_fontes': sdw(P[:, 5])}

regs = {'Norte': 'N', 'Nordeste': 'NE', 'Centro-Oeste': 'CO', 'Sudeste': 'SE', 'Sul': 'S'}
out = {
    'conta': c, 'terceiros_total': terc, 'nenhum_1t': nenhum1, 'fluxos': fluxos,
    'simples': {'taxas': S, 'fluxos_somando_estados': t['simples']['fluxos_somando_estados'], 'fluxos_estados_brasil': fluxos_estados, 'r2': t['simples']['r2_por_destino']},
    'candidatos': {k: t['tabela'][k] for k in ('cury', 'renan', 'caiado', 'zema', 'pequenos')},
    'candidatos_regiao': {rg: {k: v[k] for k in ('cury', 'renan', 'caiado')} for rg, v in t['por_regiao'].items()},
    'pesquisas': {'datafolha_terceiros': {'lula': 32, 'flavio': 46, 'data': '6 a 8/10/2026', 'amostra': 2520,
                                          'link': 'https://www.oliberal.com/politica/46-dos-eleitores-de-cury-renan-santos-caiado-e-zema-migram-para-flavio-aonta-datafolha-1.1179032'},
                  'quaest': {'cury': [34, 30, 36], 'renan': [14, 40, 46], 'caiado': [23, 42, 35], 'data': '10 a 13/10/2026', 'amostra': 2154,
                             'link': 'https://www.oliberal.com/politica/quaest-34-dos-eleitores-de-cury-migram-para-lula-no-2-turno-e-30-para-flavio-1.1182658'}},
    'contrafactual_datafolha': round(c['vantagem_lula_2t'] + terc * (0.32 - S['terceiros']['lula']['taxa'] / 100) - terc * (0.46 - S['terceiros']['flavio']['taxa'] / 100)),
    'd22': {k: v for k, v in r['de_2022_a_2026'].items() if k != 'grupos'},
    'grupos': r['de_2022_a_2026']['grupos'],
    'nac22': comp['nacional'],
    'perfil': r['perfil'], 'regressao': r['regressao'], 'sd': sd, 'comparecimento': r['comparecimento'],
    # pontos: [ibge, nome, uf, região, população, mudança pp, Lula 2026 %, válidos 2026]
    'pontos': [[p[0], p[1], p[2], regs.get(p[3], '?'), p[4], round(p[10], 1), p[9], p[11]] for p in r['pontos']],
}
# simulador: taxas estimadas (9 grupos do 1º turno) e votos de cada grupo no Brasil inteiro
tab = t['tabela']
out['simulador'] = {
    'grupos': {o: {'nome': tab[o]['nome'], 'lula': tab[o]['lula']['taxa'], 'flavio': tab[o]['flavio']['taxa'],
                   'lula_min': tab[o]['lula']['min'], 'lula_max': tab[o]['lula']['max'], 'flavio_min': tab[o]['flavio']['min'], 'flavio_max': tab[o]['flavio']['max']}
               for o in tab},
    'votos_1t': {**{k: v for k, v in c['votos_dos_outros_candidatos'].items()}, 'bn': c['brancos_nulos_1t'],
                 'abst': 158745007 - c['compareceram_1t'], 'lula': c['lula_1t'], 'flavio': c['flavio_1t']},
    'lula_2t': c['lula_2t'], 'flavio_2t': c['flavio_2t'],
}
mel = [p for p in r['pontos'] if p[10] < 0]
out['flavio_melhor_que_2022'] = {'municipios': len(mel), 'validos': int(sum(p[11] for p in mel)), 'validos_total': int(sum(p[11] for p in r['pontos']))}
SAIDA.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print('ok', SAIDA, SAIDA.stat().st_size // 1024, 'KB')
print('fluxos', fluxos)
print('estados (Brasil)', fluxos_estados)
print('sd', sd, 'contrafactual', out['contrafactual_datafolha'], out['flavio_melhor_que_2022'])
