# Shopier

Herramienta estática para convertir historial de compras domésticas en una lista predictiva.

## Uso

Abrí `index.html` en el navegador. No requiere instalación ni servidor.

## Qué incluye

- Entrada rápida en lenguaje natural.
- Modos de compra: auto, normal, parrilla, saludable y merienda.
- Lista organizada por sectores del supermercado.
- Predicción de agotamiento por frecuencia estimada.
- Ranking de productos más comprados.
- Productos ancla para sugerencias asociadas.
- Métricas simples de hábitos.

## Datos

Los productos, alias, sectores, frecuencias y compras históricas están en `app.js`.
Para adaptarlo a tu historial real, editá:

- `catalog`: productos, marcas, alias y cadencia de reposición.
- `modes`: listas base por modo de vida.
- `history`: compras pasadas usadas para ranking y predicción.
