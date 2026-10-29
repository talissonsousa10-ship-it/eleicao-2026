import re
s = open('bundle.html', encoding='utf-8').read()
styles = re.findall(r'<style[^>]*>.*?</style>', s, flags=re.S)
scripts = re.findall(r'<script[^>]*>.*?</script>', s, flags=re.S)
head = '''<meta charset="utf-8">
<title>Eleição 2026</title>
<meta name="description" content="Relatório com os dados abertos do TSE: a virada de Lula no 2º turno de 2026, urna por urna, e os testes que uma fraude não passaria.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&family=Martian+Mono:wdth,wght@75..112.5,400..700&display=swap">
'''
out = head + '\n'.join(styles) + '\n<div id="root"></div>\n' + '\n'.join(scripts) + '\n'
open('relatorio.html', 'w', encoding='utf-8').write(out)
print(len(out)//1024, 'KB', len(styles), 'styles', len(scripts), 'scripts')
