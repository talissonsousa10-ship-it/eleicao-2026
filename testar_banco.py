"""Testes do banco eleicoes.duckdb. Uso: python testar_banco.py [--regerar]"""
import subprocess, sys, tempfile, time
from pathlib import Path
import duckdb

ROOT = Path(__file__).resolve().parent
BANCO = ROOT / 'banco' / 'eleicoes.duckdb'
ok = falhas = 0

def teste(nome, cond, detalhe=''):
    global ok, falhas
    if cond: ok += 1; print(f'  [OK]    {nome} {detalhe}')
    else: falhas += 1; print(f'  [FALHA] {nome} {detalhe}')

def checar(con, rotulo):
    print(f'\n== {rotulo} ==')
    oficial = {(2022, 1): (57259504, 51072345), (2022, 2): (60345999, 58206354),
               (2026, 1): (53879538, 56104503), (2026, 2): (64256232, 59826041)}
    for (a, t), esp in oficial.items():
        r = con.execute('SELECT lula, n22 FROM resultado_brasil WHERE ano=? AND turno=?', [a, t]).fetchone()
        teste(f'total oficial {a} {t}º turno', tuple(r) == esp, f'{r}')
    teste('soma das urnas = zonas', con.execute('SELECT count(*) FROM conferencia_urna_zona').fetchone()[0] == 0)
    q = lambda s: con.execute(s).fetchone()[0]
    teste('nenhuma urna com mais votantes que aptos', q('SELECT count(*) FROM secao_resultado WHERE comparecimento > aptos') == 0)
    teste('votos da urna = comparecimento (2026)', q('SELECT count(*) FROM secao_resultado WHERE ano=2026 AND lula+n22+outros+brancos+nulos <> comparecimento') == 0)
    teste('zonas: aptos = comparecimento + abstenções + não instaladas', q('SELECT count(*) FROM zona_apuracao WHERE aptos <> comparecimento+abstencoes+nao_instaladas') == 0)
    v = dict(con.execute("SELECT ano||' '||sentido, count(*) FROM viradas GROUP BY ALL").fetchall())
    teste('viradas: 251 em 2022 e 211 em 2026', v.get('2022 para o nº 22') == 251 and v.get('2026 para Lula') == 211, str(v))
    u = dict(con.execute("SELECT ano||' '||caso, count(*) FROM urnas_um_candidato GROUP BY ALL").fetchall())
    teste('urnas só-Lula: 143 (2022) e 106 (2026)', u.get('2022 só Lula') == 143 and u.get('2026 só Lula') == 106, str(u))
    c = q('SELECT round(corr(lula_2022_pct, lula_2026_pct), 3) FROM comparacao_2022_2026')
    teste('correlação 2022 × 2026 = 0,989', c == 0.989, f'({c})')
    h = q("SELECT strftime(max(hora_boletim), '%H:%M') FROM secao_resultado WHERE ano=2026 AND turno=2")
    teste('último boletim às 23:21', h == '23:21', f'({h})')

print(f'DuckDB {duckdb.__version__} · Python {sys.version.split()[0]}')
t = time.time()
con = duckdb.connect(str(BANCO), read_only=True)
print(f'Banco aberto em {time.time() - t:.2f}s: {BANCO} ({BANCO.stat().st_size / 1e6:.0f} MB)')
checar(con, 'Banco pronto (banco/eleicoes.duckdb)')

print('\n== Exemplos do BANCO_LEIAME ==')
t = time.time()
df = con.sql("SELECT nome, uf, margem_1t_pp, margem_2t_pp FROM viradas WHERE ano = 2026 ORDER BY margem_1t_pp LIMIT 5").df()
print(df.to_string(index=False))
curva = con.sql("""SELECT date_trunc('minute', hora_boletim) AS minuto,
       100.0 * sum(sum(lula)) OVER (ORDER BY minuto) / sum(sum(lula + n22 + outros)) OVER (ORDER BY minuto) AS lula_acum
    FROM secao_resultado WHERE ano = 2026 AND turno = 2 GROUP BY minuto ORDER BY minuto""").df()
print(f'curva da apuração: {len(curva)} minutos, de {curva.minuto.min():%H:%M} a {curva.minuto.max():%H:%M}; Lula final {curva.lula_acum.iloc[-1]:.2f}%')
print(con.sql("""SELECT modelo_urna, count(*) AS urnas, round(100.0 * sum(lula) / sum(lula + n22 + outros), 2) AS lula_pct
    FROM secao_resultado WHERE ano = 2026 AND turno = 2 AND modelo_urna IS NOT NULL GROUP BY ALL ORDER BY 1""").df().to_string(index=False))
if con.execute("SELECT count(*) FROM information_schema.tables WHERE table_name = 'boletim_urna'").fetchone()[0]:
    teste('boletins de urna = totalização', con.execute('SELECT count(*) FROM conferencia_boletim_totalizacao').fetchone()[0] == 0,
          f"({con.execute('SELECT count(*) FROM boletim_urna').fetchone()[0]:,} boletins)".replace(',', '.'))
print(f'(consultas em {time.time() - t:.2f}s)')
pq = ROOT / 'banco' / 'parquet' / 'secao_resultado.parquet'
n = duckdb.sql(f"SELECT count(*) FROM '{pq.as_posix()}'").fetchone()[0]
teste('parquet legível sem o banco', n == 1942467, f'({n:,} linhas)'.replace(',', '.'))
con.close()

if '--regerar' in sys.argv:
    print('\n== Regerando do zero com montar_banco.py ==')
    tmp = Path(tempfile.gettempdir()) / 'eleicoes_teste.duckdb'
    t = time.time()
    r = subprocess.run([sys.executable, str(ROOT / 'montar_banco.py'), '--arquivo', str(tmp)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(r.stdout.strip().splitlines()[-1] if r.stdout else r.stderr[-800:])
    teste('montar_banco.py terminou sem erro', r.returncode == 0, f'({time.time() - t:.0f}s)')
    if r.returncode == 0:
        checar(duckdb.connect(str(tmp), read_only=True), f'Banco regerado ({tmp})')

print(f'\nResultado: {ok} testes OK, {falhas} falhas')
sys.exit(1 if falhas else 0)
