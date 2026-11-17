# Tribuna · guía para Claude

App web de estadísticas NBA para apuestas, para Fabio (vive en Italia) y sus amigos. **Responde siempre en español**, corto y claro. Fabio trabaja con capturas de referencia.

## Qué hace
- **Esta noche**: partidos del día con marcador en directo (EN VIVO, cuarto y reloj) y selector de 7 días (los próximos días sin cuotas).
- **Partido**: ganador, hándicap, totales y puntos por equipo con el modelo, historial y bajas; pestañas de jugadores por equipo con % L5/L10/L20/H2H.
- **Props**: lista ordenada por valor con mini barras verde/rojo; ficha de jugador con barras (verde = se cumplió, rojo = no, número encima, línea marcada).
- **Boleto** y **Apuestas**: registro con importe y cuota, calendario verde/rojo, gráfico de ganancias, y cada apuesta se despliega con marcador, cuartos, línea de evolución por jugador y box score.
- **Cuotas** (solo admin): pegar líneas a mano.

## Archivos
- `app/` web estática (sin build): `index.html`, `app.js` (casi todo), `styles.css`, `visual.js` (escudos y fondos), `espn.js` (directo y calendario), `demo.js` (datos simulados), `config.js`.
- `actualizar_nba.py` estadísticas de NBA.com (nba_api) → `nba.json` → Supabase (`snapshots` id `nba`).
- `actualizar_cuotas.py` cuotas → tabla `odds`; llama a `bajas.py` (parte de lesiones de ESPN → `snapshots` id `bajas`).
- `*.bat` ejecutar y programar tareas de Windows. `herramientas/probar_directo.js` prueba el directo de ESPN con `nba.json`.
- `supabase.sql`, `supabase_cuotas.sql`, `supabase_grupo.sql` esquema; `supabase/functions/nba-live` proxy de NBA.com (**no desplegado**, no hace falta).

## Publicar
- GitHub Pages desde `main` de github.com/LAKAKAxd/tribuna → https://lakakaxd.github.io/tribuna/app/ (demo: `?demo`).
- **Siempre** que cambies algo de `app/`, sube el número `?v=` de todos los scripts y estilos en `app/index.html` (último: 1794895000). Si no, los navegadores siguen con la versión vieja.
- Comprueba la sintaxis: `node -e "new Function(require('fs').readFileSync('app/app.js','utf8'))"`. Para ver la app sin Supabase, abre `app/index.html?demo` con un servidor local.

## Datos y horarios (PC de Fabio, Windows, carpeta C:\Users\fabio\Tribuna)
- 09:00 tarea «Tribuna NBA»: estadísticas de NBA.com (solo funciona desde su PC; desde la nube da 403).
- 18:00 «Tribuna Cuotas 18» y 21:00 «Tribuna Cuotas 21» (`--props`): PropLine principal (1.000 consultas/día gratis), The Odds API y SportsGameOdds de respaldo. Cuotas = media del mercado, **sin nombres de casas**.
- Directo, calendario de la semana y bajas: **ESPN** (`site.api.espn.com`, CORS abierto). cdn.nba.com bloquea al navegador.
- `config.env` (solo en su PC, nunca en el repo ni en el chat): SUPABASE_URL, SUPABASE_SERVICE_KEY, PROPLINE_API_KEY, SGO_API_KEY, ODDS_API_KEY. La anon key pública está en `app/config.js`.

## Supabase
- https://ulfxhbkoabqfyljteyab.supabase.co · tablas `snapshots`, `odds`, `admins`, `apuestas` (+ grupo). Registro cerrado: Fabio invita usuarios a mano (Auto Confirm).
- Pendiente de confirmar que Fabio ejecutó `supabase_cuotas.sql` y `supabase_grupo.sql`, y la Site URL.

## Interruptores en `app/config.js`
- `logosOficiales: true` y `fotosOficiales: true` (logos y fotos de NBA.com). **Solo uso privado: ponerlos en `false` antes de publicar la app.**

## Modelo
- Partido: ridge ataque/defensa + ventaja de campo (~1,8), temporada anterior peso 0,3; historial corregido por titulares ausentes. SD: ganador 12, hándicap 13, total 18, puntos de equipo 12. Los totales apenas superan al azar.
- Props: últimos 40 partidos, vida media 10, kernel suavizado (bien calibrado). Bajas: compañeros +10 % de lo que falta.
- Valor = mezcla 50/50 modelo y cuota (`MKT_W`), sin validar: haría falta guardar el histórico de cuotas.

## Reglas
- Coste 0 €. Nada de nombres de casas, marcas, enlaces ni afiliados. Descartado el factor «vida privada» (RGPD). Consultar a un abogado antes de publicar (Italia: Decreto Dignità y AGCOM).
- Estilo «Noche»: oscuro con acento ámbar y modo claro; tokens en `:root` de `styles.css`. Verde `--hit` / rojo `--miss` para lo que se cumple o no.
- Inspirarse en otras apps sin copiar su marca ni su diseño.

## Pendientes
- En su PC quedó un commit local de prueba en `main` (f03f000) sin publicar; si `git pull` da conflicto: `git reset --hard origin/main` (no toca config.env). Solo con permiso de Fabio.
- ScoreboardV2 de nba_api está obsoleto: pasar a V3.
