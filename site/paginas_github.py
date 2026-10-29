"""Transforma relatorio.html (feito para o artifact, que recebe o esqueleto HTML ao publicar) em ../docs/index.html
com documento completo (doctype, viewport e idioma), para o GitHub Pages."""
from pathlib import Path
s = Path('relatorio.html').read_text(encoding='utf-8')
cabeca, corpo = s.split('<div id="root"></div>', 1)
out = ('<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
       + cabeca + '</head>\n<body>\n<div id="root"></div>' + corpo + '</body>\n</html>\n')
Path('../docs/index.html').write_text(out, encoding='utf-8')
print('docs/index.html', len(out) // 1024, 'KB')
