# Site do relatório

Código-fonte do site (React + TypeScript + Vite + Tailwind; animações com Motion, mapa com d3-geo e d3-zoom).
O resultado é um único arquivo HTML, publicado em `../docs/index.html`.

- `src/sections/`: seções da página "A eleição passou no teste"
- `src/pages/Decisao.tsx`: página "Onde a eleição foi decidida"
- `src/pages/Explorar.tsx`: página "Explore sua cidade" (mapa com zoom e busca por cidade, escola e urna)
- `src/data/`: dados já calculados pelos programas em Python da pasta principal

Para gerar de novo: `bash construir.sh`
