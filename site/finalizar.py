import re
s = open('bundle.html', encoding='utf-8').read()
styles = re.findall(r'<style[^>]*>.*?</style>', s, flags=re.S)
scripts = re.findall(r'<script[^>]*>.*?</script>', s, flags=re.S)
head = '''<meta charset="utf-8">
<title>Eleição 2026</title>
<meta name="description" content="Análise da eleição presidencial de 2026 com os dados abertos do TSE: 998.411 boletins de urna conferidos, seis testes estatísticos, onde a eleição foi decidida e a busca por cidade, escola e urna.">
<meta name="author" content="Talisson Sousa de Santana · Analista de Dados Estatísticos">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20x%3D%225%22%20y%3D%222%22%20width%3D%2222%22%20height%3D%2228%22%20rx%3D%222%22%20fill%3D%22%23fbfbf9%22%20stroke%3D%22%2314171b%22%20stroke-width%3D%222%22/%3E%3Crect%20x%3D%229%22%20y%3D%228%22%20width%3D%2214%22%20height%3D%223%22%20rx%3D%221%22%20fill%3D%22%2314171b%22/%3E%3Crect%20x%3D%229%22%20y%3D%2215%22%20width%3D%229%22%20height%3D%223%22%20rx%3D%221%22%20fill%3D%22%23c8202f%22/%3E%3Crect%20x%3D%229%22%20y%3D%2221%22%20width%3D%2212%22%20height%3D%223%22%20rx%3D%221%22%20fill%3D%22%231f4fc4%22/%3E%3C/svg%3E">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Eleição 2026 · dados abertos do TSE">
<meta property="og:title" content="Eleição 2026: procuramos fraude em 499 mil urnas">
<meta property="og:description" content="Análise da eleição presidencial de 2026 com os dados abertos do TSE: 998.411 boletins de urna conferidos, seis testes estatísticos, onde a eleição foi decidida e a busca por cidade, escola e urna.">
<meta property="og:url" content="https://talissonsousa10-ship-it.github.io/eleicao-2026/">
<meta property="og:image" content="https://talissonsousa10-ship-it.github.io/eleicao-2026/previa.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Lula ganhou por 4,4 milhões de votos. Procuramos fraude em 499 mil urnas. Não encontramos.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Eleição 2026: procuramos fraude em 499 mil urnas">
<meta name="twitter:description" content="Análise da eleição presidencial de 2026 com os dados abertos do TSE: 998.411 boletins de urna conferidos, seis testes estatísticos, onde a eleição foi decidida e a busca por cidade, escola e urna.">
<meta name="twitter:image" content="https://talissonsousa10-ship-it.github.io/eleicao-2026/previa.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400..600&family=Martian+Mono:wdth,wght@75..112.5,400..700&display=swap">
'''
out = head + '\n'.join(styles) + '\n<div id="root"></div>\n' + '\n'.join(scripts) + '\n'
open('relatorio.html', 'w', encoding='utf-8').write(out)
print(len(out)//1024, 'KB', len(styles), 'styles', len(scripts), 'scripts')
