"""Baixa os arquivos de Boletim de Urna (bweb) do TSE e confere a assinatura SHA-512 de cada um.

Uso:
    python baixar_boletins.py               # 1º e 2º turno, todos os estados e o exterior
    python baixar_boletins.py --turno 2     # só o 2º turno
    python baixar_boletins.py --uf SP RJ    # só alguns estados
Os arquivos vão para a pasta acima do projeto (onde já estão os outros zips do TSE).
Arquivos já baixados e íntegros são pulados.
"""
import argparse
import hashlib
import sys
import urllib.request
from pathlib import Path

BASE = 'https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/buweb/'
CARIMBO = {1: '051020261403', 2: '261020260742'}
UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO ZZ'.split()
DESTINO = Path(__file__).resolve().parent.parent


def sha512(p: Path) -> str:
    h = hashlib.sha512()
    with p.open('rb') as f:
        while b := f.read(8 << 20):
            h.update(b)
    return h.hexdigest()


def baixar(url: str, alvo: Path):
    tmp = alvo.with_suffix(alvo.suffix + '.parcial')
    with urllib.request.urlopen(url, timeout=120) as r, tmp.open('wb') as f:
        total = int(r.headers.get('content-length') or 0)
        feito = 0
        while b := r.read(4 << 20):
            f.write(b)
            feito += len(b)
            if total:
                print(f'\r    {feito / 1e6:,.0f} de {total / 1e6:,.0f} MB'.replace(',', '.'), end='', flush=True)
    print()
    tmp.replace(alvo)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--turno', type=int, choices=[1, 2], nargs='*', default=[2, 1])
    ap.add_argument('--uf', nargs='*', default=UFS)
    a = ap.parse_args()
    falhas = []
    for t in a.turno:
        for uf in a.uf:
            nome = f'bweb_{t}t_{uf}_{CARIMBO[t]}.zip'
            zp = DESTINO / nome
            esperado = urllib.request.urlopen(BASE + nome + '.sha512', timeout=60).read().decode().split()[0]
            (DESTINO / (nome + '.sha512')).write_text(f'{esperado}  {nome}\n')
            if zp.exists() and sha512(zp) == esperado:
                print(f'{nome}: já baixado, assinatura OK')
                continue
            print(f'{nome}: baixando...')
            baixar(BASE + nome, zp)
            ok = sha512(zp) == esperado
            print(f'  assinatura SHA-512: {"OK" if ok else "NÃO CONFERE"}')
            if not ok:
                falhas.append(nome)
    if falhas:
        print('Arquivos com assinatura diferente da publicada (baixe de novo):', ', '.join(falhas))
        sys.exit(1)
    print('Todos os arquivos baixados e com assinatura conferida.')


if __name__ == '__main__':
    main()
