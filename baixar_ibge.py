"""Baixa indicadores municipais do IBGE (API de agregados/SIDRA) para cruzar com o voto.

Saída: dados_ibge/municipios_ibge.csv com, por município (código IBGE):
  pop              população residente (Censo 2022, tabela 4714)
  densidade        habitantes por km² (Censo 2022, tabela 4714)
  renda_pc         rendimento domiciliar per capita mensal, em R$ (massa de rendimento / população; Censo 2022, tabela 10297)
  pct_outras_fontes parte do rendimento das famílias que não vem do trabalho (aposentadorias, programas sociais etc.; Censo 2022, tabela 10297)
  pct_evangelicos  % da população de 10 anos ou mais que se declara evangélica (Censo 2022, tabela 9537)
  pib_pc           PIB por habitante em R$ (PIB dos Municípios 2023, tabela 5938, ÷ população do Censo 2022)
Uso: python baixar_ibge.py
"""
import csv, gzip, json, urllib.request
from pathlib import Path

API = 'https://servicodados.ibge.gov.br/api/v3/agregados'
OUT = Path(__file__).resolve().parent / 'dados_ibge'


def get(u):
    b = urllib.request.urlopen(urllib.request.Request(u, headers={'Accept-Encoding': 'gzip'}), timeout=300).read()
    if b[:2] == b'\x1f\x8b':
        b = gzip.decompress(b)
    return json.loads(b)


def serie(tabela, periodo, var, classif=''):
    u = f'{API}/{tabela}/periodos/{periodo}/variaveis/{var}?localidades=N6[all]' + (f'&classificacao={classif}' if classif else '')
    d = get(u)
    out = {}
    for r in d[0]['resultados']:
        for s in r['series']:
            v = list(s['serie'].values())[0]
            try:
                out[s['localidade']['id']] = float(v)
            except (TypeError, ValueError):
                pass   # "-", "..." = sem dado
    print(f'  tabela {tabela} var {var}: {len(out)} municípios')
    return out


def main():
    OUT.mkdir(exist_ok=True)
    pop = serie(4714, 2022, 93)
    dens = serie(4714, 2022, 614)
    massa = serie(10297, 2022, 13506, '11308[79450]')
    outras = serie(10297, 2022, 13504, '11308[79452]')
    ev = serie(9537, 2022, 140, '133[95277]|2[6794]|58[95253]')
    tot10 = serie(9537, 2022, 140, '133[95278]|2[6794]|58[95253]')
    evang = {k: round(100 * ev[k] / tot10[k], 2) for k in ev if tot10.get(k)}
    pib = serie(5938, 2023, 37)
    with (OUT / 'municipios_ibge.csv').open('w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['ibge', 'pop', 'densidade', 'renda_pc', 'pct_outras_fontes', 'pct_evangelicos', 'pib_pc'])
        for k in sorted(pop):
            p = pop[k]
            w.writerow([k, int(p), dens.get(k, ''), round(massa[k] / p, 2) if k in massa and p else '',
                        outras.get(k, ''), evang.get(k, ''), round(1000 * pib[k] / p, 0) if k in pib and p else ''])
    print('Gravado', OUT / 'municipios_ibge.csv')


if __name__ == '__main__':
    main()
