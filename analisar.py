"""Reproduz a análise dos CSVs presidenciais. Apenas biblioteca padrão.

Uso: python analisar.py [--conferir-tse]
Saídas: analise/ (CSV, JSON e relatório Markdown); não altera os originais.
"""
import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'analise'
VOTES = ROOT / 'votacao_candidato_munzona_2026_BR.csv'
DETAIL = ROOT / 'detalhe_votacao_munzona_2026/detalhe_votacao_munzona_2026_BR.csv'
PORTAL = 'https://dadosabertos.tse.jus.br/dataset/resultados-2026'
FIELDS = {'aptos': 'QT_APTOS', 'comparecimento': 'QT_COMPARECIMENTO',
          'abstencoes': 'QT_ABSTENCOES', 'nao_instaladas': 'QT_ELEITORES_SECOES_NAO_INSTALADAS',
          'validos': 'QT_TOTAL_VOTOS_VALIDOS', 'brancos': 'QT_VOTOS_BRANCOS',
          'nulos': 'QT_TOTAL_VOTOS_NULOS', 'anulados': 'QT_TOTAL_VOTOS_ANULADOS',
          'subjudice': 'QT_TOTAL_VOTOS_ANUL_SUBJUD', 'separado': 'QT_VOTOS_ANULADOS_APU_SEP'}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(row, field):
    value = int(row[field])
    require(value >= 0, f'Contagem ausente/negativa em {field}: {value}')
    return value


def read(path):
    with path.open(encoding='latin1', newline='') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            require(None not in row and all(v is not None for v in row.values()), f'Linha malformada: {path.name}')
            require(row['ANO_ELEICAO'] == '2026' and row['CD_CARGO'] == '1'
                    and row['CD_TIPO_ELEICAO'] == '2' and row['NR_TURNO'] in ('1', '2'),
                    f'Escopo inesperado: {path.name}')
            row['CD_MUNICIPIO'] = str(int(row['CD_MUNICIPIO'])).zfill(5)
            row['NR_ZONA'] = str(int(row['NR_ZONA']))
            yield row


def key(row):
    return tuple(row[k] for k in ('NR_TURNO', 'SG_UF', 'CD_MUNICIPIO', 'NR_ZONA', 'ST_VOTO_EM_TRANSITO'))


def pct(n, d):
    return 100 * n / d if d else None


def compare(a, b, **labels):
    result = dict(labels)
    for field in ('lula', 'flavio', 'outros', *FIELDS):
        result[field + '1'] = a[field]
        result[field + '2'] = b[field]
        result['delta_' + field] = b[field] - a[field]
    for candidate in ('lula', 'flavio'):
        result[candidate + '_pct1'] = pct(a[candidate], a['validos'])
        result[candidate + '_pct2'] = pct(b[candidate], b['validos'])
        p1, p2 = result[candidate + '_pct1'], result[candidate + '_pct2']
        result[candidate + '_pp'] = p2 - p1 if p1 is not None and p2 is not None else None
    result['margem1'] = a['lula'] - a['flavio']
    result['margem2'] = b['lula'] - b['flavio']
    result['delta_margem'] = result['margem2'] - result['margem1']
    result['lider_dupla1'] = 'Lula' if result['margem1'] > 0 else ('Flávio' if result['margem1'] < 0 else 'Empate')
    result['vencedor2'] = 'Lula' if result['margem2'] > 0 else ('Flávio' if result['margem2'] < 0 else 'Empate')
    result['virada_lula'] = result['margem1'] < 0 and result['margem2'] > 0
    result['virada_flavio'] = result['margem1'] > 0 and result['margem2'] < 0
    return result


def save_csv(name, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter=';')
        writer.writeheader()
        writer.writerows(rows)


def fmt(n):
    return f'{n:,.0f}'.replace(',', '.')


def main(fetch=False):
    OUT.mkdir(exist_ok=True)
    detail, candidates, seen = {}, defaultdict(Counter), set()
    totals = defaultdict(Counter)
    names, dates, source_dates = {}, {}, {}
    for row in read(DETAIL):
        k = key(row)
        require(k not in detail, f'Detalhe duplicado: {k}')
        detail[k] = {alias: number(row, field) for alias, field in FIELDS.items()}
        names[(row['SG_UF'], row['CD_MUNICIPIO'])] = row['NM_MUNICIPIO']
        dates[row['NR_TURNO']] = row['DT_ELEICAO']
        source_dates[DETAIL.name] = row['DT_GERACAO'] + ' ' + row['HH_GERACAO']
    for row in read(VOTES):
        k, candidate = key(row), row['NR_CANDIDATO']
        unique = (*k, candidate, row['NM_TIPO_DESTINACAO_VOTOS'])
        require(unique not in seen, f'Votação duplicada: {unique}')
        seen.add(unique)
        require(k in detail, f'Votação sem apuração: {k}')
        value = number(row, 'QT_VOTOS_NOMINAIS_VALIDOS')
        candidates[k][candidate] += value
        totals[k[0]][row['NM_URNA_CANDIDATO']] += value
        source_dates[VOTES.name] = row['DT_GERACAO'] + ' ' + row['HH_GERACAO']
    require(set(candidates) == set(detail), 'Apuração sem votação nominal correspondente')
    require({k[1:] for k in detail if k[0] == '1'} == {k[1:] for k in detail if k[0] == '2'},
            'Cobertura territorial diferente entre turnos: conciliar antes de comparar')
    for k, d in detail.items():
        require(sum(candidates[k].values()) == d['validos'], f'Votos nominais não reconciliados: {k}')
        require(d['aptos'] == d['comparecimento'] + d['abstencoes'] + d['nao_instaladas'], f'Aptos não reconciliados: {k}')
        require(d['comparecimento'] == sum(d[x] for x in ('validos','brancos','nulos','anulados','subjudice','separado')), f'Comparecimento não reconciliado: {k}')
        require({'13','22'} <= candidates[k].keys(), f'Finalista ausente: {k}')
        if k[0] == '2':
            require(set(candidates[k]) == {'13','22'}, 'Segundo turno com outros candidatos')
        d.update(lula=candidates[k]['13'], flavio=candidates[k]['22'],
                 outros=sum(v for c, v in candidates[k].items() if c not in ('13','22')))

    grouped = {level: defaultdict(lambda: defaultdict(Counter)) for level in ('pais','uf','municipio','zona')}
    for k, d in detail.items():
        t, uf, mun, zone, transit = k
        for level, group in [('pais', ('BR',)), ('uf', (uf,)), ('municipio', (uf,mun)), ('zona',(uf,mun,zone,transit))]:
            grouped[level][group][t].update(d)
    outputs = {}
    for level, groups in grouped.items():
        rows = []
        for group, turns in sorted(groups.items()):
            labels = {'uf': group[0]}
            if level in ('municipio','zona'):
                labels.update(codigo_municipio=group[1], municipio=names[group[:2]])
            if level == 'zona':
                labels.update(zona=group[2], transito=group[3])
            rows.append(compare(turns['1'], turns['2'], **labels))
        outputs[level] = rows
        save_csv(f'{level}.csv', rows)
    national = outputs['pais'][0]
    for level in ('uf','municipio','zona'):
        for field in ('lula1','lula2','flavio1','flavio2','validos1','validos2','delta_lula','delta_flavio','delta_margem'):
            require(sum(r[field] for r in outputs[level]) == national[field], f'Agregação inconsistente: {level}.{field}')
    require(national['delta_lula'] == national['outros1'] + national['delta_validos'] - national['delta_flavio'], 'Identidade do ganho de Lula inválida')
    require(national['delta_validos'] == national['delta_comparecimento'] - sum(national['delta_'+x] for x in ('brancos','nulos','anulados','subjudice','separado')), 'Identidade dos válidos inválida')

    official = []
    for turn, election in [('1','6257'),('2','6258')]:
        path = OUT / f'tse_turno_{turn}.json'
        url = f'https://resultados.tse.jus.br/oficial/ele2026/{election}/dados/br/br-c0001-e00{election}-u.json'
        if fetch:
            try:
                with urlopen(url, timeout=30) as response:
                    content = response.read()
                json.loads(content)
                path.write_bytes(content)
            except Exception as error:
                official.append({'turno':turn,'url':url,'status':'indisponível','erro':str(error)})
                continue
        if path.exists():
            data = json.loads(path.read_text(encoding='utf-8-sig'))
            values = {c['n']:int(c['vap']) for cargo in data['carg'] for group in cargo['agr'] for party in group['par'] for c in party['cand']}
            for candidate, alias in [('13','lula'),('22','flavio')]:
                require(values[candidate] == national[alias+turn], f'Divergência com TSE: {alias}, turno {turn}')
            require(int(data['v']['vv']) == national['validos'+turn], f'Válidos divergem do TSE: turno {turn}')
            official.append({'turno':turn,'url':url,'status':'conferido','geracao':data['dg']+' '+data['hg'], 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})

    domestic = [r for r in outputs['municipio'] if r['uf'] != 'ZZ']
    counts = {'municipios_brasil':len(domestic), 'localidades_exterior':len(outputs['municipio'])-len(domestic),
              'municipios_virada_lula':sum(r['virada_lula'] for r in domestic),
              'municipios_virada_flavio':sum(r['virada_flavio'] for r in domestic),
              'municipios_queda_votos_flavio':sum(r['delta_flavio'] < 0 for r in domestic),
              'municipios_flavio_derrotado2':sum(r['vencedor2'] == 'Lula' for r in domestic)}
    quality = {'linhas_candidatos':len(seen),'linhas_apuracao':len(detail), 'unidades_por_turno':len(detail)//2,
               'duplicidades_na_chave':0, 'chaves_sem_correspondencia':0,'divergencias_nominais_apuracao':0,
               'divergencias_identidades':0,'fontes_geracao':source_dates,'conferencia_tse':official,
               'arquivos':[{'arquivo':p.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in (VOTES,DETAIL)],
               'nota_aptos':'O portal do TSE informa 39 registros de aptos duplicados por transferência temporária. Mantidos os valores brutos dos CSVs; nenhuma correção territorial foi inventada. Há também 423 eleitores em seções não instaladas, categoria distinta, reconciliada separadamente.'}
    summary = {'nacional':national,'contagens':counts,'qualidade':quality,'datas_eleicao':dates}
    (OUT/'resumo.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2),encoding='utf-8')
    text = ['# Lula cresceu mais entre os turnos e reverteu a vantagem de Flávio',
            '', 'Análise descritiva de presidente, Brasil e exterior; 04 e 25 de outubro de 2026. Dados locais gerados em 28/10/2026.', '',
            '## Resposta principal', '',
            f"Lula passou de {fmt(national['lula1'])} para {fmt(national['lula2'])}: +{fmt(national['delta_lula'])} votos. Flávio passou de {fmt(national['flavio1'])} para {fmt(national['flavio2'])}: +{fmt(national['delta_flavio'])} votos.", '',
            f"A diferença Lula − Flávio passou de {fmt(national['margem1'])} para {fmt(national['margem2'])}; mudança de {fmt(national['delta_margem'])} votos. Os 10,38 milhões são o crescimento de Lula, não a vantagem final, de 4,43 milhões.", '',
            '## Como a conta fecha', '',
            f"Os outros candidatos somavam {fmt(national['outros1'])} votos no primeiro turno. Os válidos aumentaram {fmt(national['delta_validos'])}. O ganho conjunto dos finalistas foi {fmt(national['delta_lula']+national['delta_flavio'])}.", '',
            f"ΔLula = outros no 1º turno + Δválidos − ΔFlávio = {fmt(national['outros1'])} + {fmt(national['delta_validos'])} − {fmt(national['delta_flavio'])} = {fmt(national['delta_lula'])}.", '',
            f"O aumento dos válidos fecha com +{fmt(national['delta_comparecimento'])} no comparecimento, {fmt(-national['delta_brancos'])} a menos em brancos e {fmt(-national['delta_nulos'])} a menos em nulos.", '',
            'Essa identidade é contábil: não identifica quem mudou de candidato, quem deixou de votar ou quem voltou às urnas. Os fluxos brutos podem ser maiores que as variações líquidas.', '',
            '## Onde a vantagem mudou mais', '', '| UF | Ganho Lula | Ganho Flávio | Mudança da margem Lula − Flávio |', '|---|---:|---:|---:|']
    for row in sorted(outputs['uf'],key=lambda r:r['delta_margem'],reverse=True):
        text.append(f"| {row['uf']} | {fmt(row['delta_lula'])} | {fmt(row['delta_flavio'])} | {fmt(row['delta_margem'])} |")
    text += ['',f"Nos {counts['municipios_brasil']} municípios brasileiros da base: {counts['municipios_virada_lula']} passaram de vantagem de Flávio sobre Lula para vitória de Lula; {counts['municipios_virada_flavio']} fizeram o movimento inverso; {counts['municipios_queda_votos_flavio']} registraram queda absoluta dos votos de Flávio. Exterior é separado.", '',
             '## Método e limites', '',
             '- Votos de candidato: QT_VOTOS_NOMINAIS_VALIDOS. Participação: votos do candidato / QT_TOTAL_VOTOS_VALIDOS, em cada turno. Alteração de participação em pontos percentuais.',
             '- Margem: Lula − Flávio. Sua variação é uma contribuição territorial à mudança nacional, não uma medida de transferência individual.',
             '- Primeiro turno contém outros candidatos: ganhar participação nos válidos não significa ganhar posição relativa contra o outro finalista. A liderança da dupla não implica liderança sobre todos os candidatos.',
             '- Chave: turno, UF, código TSE do município, zona e indicador de trânsito. Apenas arquivos BR; não concatenar BRASIL, UFs ou cópias duplicadas. São recortes sobrepostos.',
             '- Cobertura idêntica entre turnos e conciliação de votos de todos os candidatos com a apuração em cada unidade. Aptos = comparecimento + abstenções + eleitores em seções não instaladas.',
             '- '+quality['nota_aptos'],
             '- Dados de totalização, não amostra: não se atribui margem de erro amostral às somas. Revisões do TSE e erros de processamento continuam possíveis.',
             '- Motivações e trajetórias individuais exigem pesquisa de painel ou outra evidência apropriada; correlação territorial não demonstra causa.', '',
             f'Fonte: [Portal do TSE]({PORTAL}). Arquivos, hashes, conferência nacional e verificações em resumo.json. Tabelas completas em pais.csv, uf.csv, municipio.csv e zona.csv. Reproduzir: python analisar.py --conferir-tse.', '']
    (OUT/'relatorio.md').write_text('\n'.join(text),encoding='utf-8')
    create_snapshot(outputs, summary)
    print(json.dumps({'nacional':national,'contagens':counts,'conferencia_tse':official,'top_uf':sorted(outputs['uf'],key=lambda r:r['delta_margem'],reverse=True)[:5]},ensure_ascii=True))


def create_snapshot(outputs, summary):
    queries = {}
    for level, rows in outputs.items():
        if level == 'zona':
            continue  # ponytail: zonas ficam no CSV; o relatório navega até município.
        queries[level] = {'rows':rows,'source':{'label':'TSE — CSVs de votação e apuração presidencial 2026',
            'files':[VOTES.name, DETAIL.name], 'url':PORTAL, 'filters':['Presidente; eleição ordinária 2026; ambos os turnos; Brasil e exterior'],
            'metricDefinitions':[
                {'label':'Votos e crescimento','definition':'Votos nominais válidos somados por território; delta = segundo turno − primeiro turno.'},
                {'label':'Participação e mudança em pp','definition':'100 × votos do candidato / total de votos válidos no respectivo turno. Diferença em pontos percentuais; sem média simples das taxas locais.'},
                {'label':'Margem e mudança da margem','definition':'Margem = Lula − Flávio; delta_margem = margem2 − margem1. Positivo indica mudança a favor de Lula; negativo a favor de Flávio.'}],
            'evidenceFlow':[{'title':'Origem','detail':json.dumps(summary['qualidade']['arquivos'],ensure_ascii=False)},
                            {'title':'Conferências','detail':json.dumps(summary['qualidade'],ensure_ascii=False)}],
            'caveats':['Contagens agregadas não identificam transferências individuais de votos.',summary['qualidade']['nota_aptos']]},
            'methods':[{'language':'text','code':'python analisar.py --conferir-tse. Ler somente os dois CSVs BR em Latin-1, separados por ponto e vírgula. Validar chaves e conciliar votos por unidade antes de agregar. Somar numeradores e denominadores antes de calcular taxas; manter exterior como ZZ.'}]}
    queries['validacao'] = {'rows':[summary['contagens'] | {k:v for k,v in summary['qualidade'].items() if isinstance(v,int)}],
                             'source':{'label':'Verificações executadas em analisar.py','files':[VOTES.name,DETAIL.name],'evidenceFlow':[{'title':'Resultado','detail':json.dumps(summary['qualidade'],ensure_ascii=False)}]}}
    snapshot = {'surface':'report','title':'Lula cresceu mais entre os turnos e reverteu a vantagem de Flávio',
                'generatedAt':datetime.now(timezone.utc).isoformat(),'status':'reviewed','buildStatus':'creating','filters':[],
                'report':{'asOf':'2026-10-28'},'queries':queries}
    (OUT/'snapshot.json').write_text(json.dumps(snapshot,ensure_ascii=False),encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--conferir-tse',action='store_true')
    main(parser.parse_args().conferir_tse)
