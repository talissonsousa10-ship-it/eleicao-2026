#!/usr/bin/env bash
# Gera o site em um único HTML (docs/index.html) a partir do código-fonte.
# Requisitos: Node 18+ e pnpm. Uso: cd site && bash construir.sh
set -e
pnpm install
python3 scripts/gerar_decisao.py            # dados da página "Onde foi decidida" (lê ../analise/decisao)
rm -rf dist bundle.html
pnpm exec parcel build index.html --dist-dir dist --no-source-maps
pnpm exec html-inline dist/index.html > bundle.html
python3 finalizar.py                         # adiciona título e fontes -> relatorio.html
python3 paginas_github.py                   # documento completo para o GitHub Pages: ../docs/index.html
echo "Pronto: ../docs/index.html (os dados da busca ficam em ../docs/busca/, gerados por preparar_busca.py)"
