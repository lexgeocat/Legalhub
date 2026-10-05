// Copia las fuentes (subconjunto latin, .woff) de node_modules/@fontsource a public/fuentes
// y genera fuentes.css, manifiesto.json y las licencias. Ejecutar con: pnpm fuentes
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalogo = JSON.parse(readFileSync(join(raiz, 'src/domain/fuentes.json'), 'utf8'));
const salida = join(raiz, 'public', 'fuentes');

rmSync(salida, { recursive: true, force: true });
mkdirSync(join(salida, 'licencias'), { recursive: true });

const PESOS = [400, 700];
const ESTILOS = ['normal', 'italic'];
const manifiesto = {};
const sinPaquete = [];
const faltan = [];
let css = '/* Generado por scripts/preparar-fuentes.mjs. No editar a mano. */\n';

for (const f of catalogo) {
    if (!f.paquete) continue;
    const base = join(raiz, 'node_modules', '@fontsource', f.paquete);
    if (!existsSync(join(base, 'files'))) {
        sinPaquete.push(f.paquete);
        continue;
    }
    for (const peso of PESOS) {
        for (const estilo of ESTILOS) {
            const origen = join(base, 'files', `${f.paquete}-latin-${peso}-${estilo}.woff`);
            if (!existsSync(origen)) {
                faltan.push(`${f.familia} ${peso} ${estilo}`);
                continue;
            }
            const nombre = `${f.paquete}-${peso}-${estilo}.woff`;
            copyFileSync(origen, join(salida, nombre));
            (manifiesto[f.familia] ??= {})[`${peso}-${estilo}`] = nombre;
            css += `@font-face{font-family:"${f.familia}";font-style:${estilo};font-weight:${peso};font-display:swap;src:url("/fuentes/${nombre}") format("woff");}\n`;
        }
    }
    const licencia = join(base, 'LICENSE');
    if (existsSync(licencia)) copyFileSync(licencia, join(salida, 'licencias', `${f.paquete}.txt`));
}

writeFileSync(join(salida, 'fuentes.css'), css);
writeFileSync(join(salida, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));

console.log(`Fuentes listas: ${Object.keys(manifiesto).length} familias en public/fuentes`);
if (faltan.length) console.warn(`Sin archivo (Word las sintetizará): ${faltan.join(', ')}`);
if (sinPaquete.length) {
    console.error(`Faltan paquetes. Instálalos: pnpm add -D ${sinPaquete.map((p) => `@fontsource/${p}`).join(' ')}`);
    process.exitCode = 1;
}