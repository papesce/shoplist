import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const BASE = join(DIR, "..", "base");
const TXT = join(BASE, "base-datos.txt");
const OUT = join(BASE, "productos.json");

if (!existsSync(TXT)) {
  console.error("ERROR: no se encuentra", TXT);
  process.exit(1);
}

const SEPARATORS = /^[\s\-–—_—=*]{3,}$/;
const PRICE = /^\d{3,6}(\.\d{2})?$/;
const PHONE = /^\d{7,}$/;
const URL = /^https?:\/\//i;
const NOTES = /^(desde el|domingo|lengua|dolor|tos|certificado|recien|rueda reparar|llevar|gotas|certificado|cargar nafta|peluqueria|mama|carne|varduras|merienda|vino|panaderia|nafta|peaje|cena|viaje|hotel|campo|alta italia|agrimensor|imago|foco|santa narcisa|aluquiler|caramelos|bolsitas|vela|una pizza|4 carne|2 caprese|1 verdura|1 queso|pan rayado|don sarur|masitas|chocolatada|jugo|luz led|unodostres|entran|se retiran|duermen|hace|salen|no hay|no hace|campamento|bicicletas|baja\s|wagq|kuz7|desde el sabado|que comidas)/i;
const MIXED_NUM = /^\d{4,6}\s/;

const raw = readFileSync(TXT, "utf-8");
const lines = raw.split("\n");

const entries = [];

for (let i = 0; i < lines.length; i++) {
  const rawLine = lines[i];
  const line = rawLine.trim();

  if (!line) continue;
  if (SEPARATORS.test(line)) continue;
  if (PRICE.test(line)) continue;
  if (PHONE.test(line)) continue;
  if (URL.test(line)) continue;
  if (NOTES.test(line)) continue;
  if (line.length < 2) continue;

  entries.push({
    original: line,
    linea: i + 1,
  });
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(entries, null, 2), "utf-8");

console.log(`✅ ${entries.length} entradas extraídas → base/productos.json`);
