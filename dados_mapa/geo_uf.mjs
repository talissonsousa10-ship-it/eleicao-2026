// Contornos detalhados por estado, na mesma projeção do mapa nacional (geo_paths.json)
import fs from 'fs';
import { geoMercator, geoPath, geoArea } from 'd3-geo';
function fix(f){ if(!f.geometry) return f; if(geoArea(f) > 2*Math.PI){ const g=f.geometry; const rev=p=>p.map(r=>r.slice().reverse()); if(g.type==='Polygon') g.coordinates=rev(g.coordinates); else g.coordinates=g.coordinates.map(rev);} return f; }
const uf = JSON.parse(fs.readFileSync('uf_s.json')); uf.features.forEach(fix);
const W = 900, H = 900;
const proj = geoMercator().fitExtent([[4, 4], [W - 4, H - 4]], uf);
const path = geoPath(proj).digits(2);
const mun = JSON.parse(fs.readFileSync('mun_d.json'));
const out = {};
for (const f of mun.features) {
  if (!f.geometry) continue; fix(f);
  const d = path(f); if (!d) continue;
  const k = f.properties.id.slice(0, 2);
  (out[k] ??= {})[f.properties.id] = d;
}
fs.mkdirSync('geo_uf', { recursive: true });
for (const [k, v] of Object.entries(out)) fs.writeFileSync(`geo_uf/${k}.json`, JSON.stringify(v));
console.log(Object.keys(out).length, 'estados', Object.values(out).reduce((a, v) => a + Object.keys(v).length, 0), 'municípios');
