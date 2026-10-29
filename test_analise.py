"""Verificação dos casos que podem distorcer o relatório; executar com Python."""
import csv
from collections import Counter
from pathlib import Path
from tempfile import TemporaryDirectory
from analisar import compare, read, number, pct


def test():
    a = Counter(lula=40,flavio=50,outros=10,validos=100)
    b = Counter(lula=65,flavio=55,validos=120)
    r = compare(a,b)
    assert r['delta_lula'] == 25 and r['delta_flavio'] == 5
    assert r['delta_margem'] == 20 and r['virada_lula']
    assert abs(r['lula_pp'] - (100*65/120-40)) < 1e-10
    assert compare(Counter(),Counter())['lula_pp'] is None
    assert pct(1,0) is None
    try:
        number({'votos':'-1'},'votos')
    except ValueError:
        pass
    else:
        raise AssertionError('Ausência não pode ser contada como voto')
    with TemporaryDirectory() as folder:
        path = Path(folder)/'teste.csv'
        row = dict(ANO_ELEICAO='2026',CD_CARGO='1',CD_TIPO_ELEICAO='2',NR_TURNO='1',CD_MUNICIPIO='1007',NR_ZONA='09')
        with path.open('w',encoding='latin1',newline='') as f:
            w=csv.DictWriter(f,fieldnames=row,delimiter=';');w.writeheader();w.writerow(row)
        parsed = next(read(path))
        assert parsed['CD_MUNICIPIO']=='01007' and parsed['NR_ZONA']=='9'
    print('OK: diferenças, denominadores, ausência e códigos municipais.')


if __name__ == '__main__':
    test()
