# Tribuna · guía para Claude

App web de estadísticas NBA y NFL para apuestas, para Fabio (vive en Italia) y sus amigos. **Responde siempre en español**, corto y claro. Fabio trabaja con capturas de referencia.

## Qué hace
- Selector **NBA | NFL** arriba (se guarda en `localStorage` `tribuna:liga` y la página se recarga). Líneas y cuotas propias van por liga.
- **Un solo boleto y una sola lista de apuestas para todas las ligas** (petición de Fabio: los tickets mezclan deportes). Cada selección guarda `liga` (sin campo = NBA), su texto y lo necesario para apostarla desde otra liga. Las de otra liga se muestran con lo guardado; cada liga guarda en la selección su resultado (`res`, `final`) al verla, y el ticket se cierra cuando todas tienen resultado. Un deporte nuevo debe seguir este sistema.
- **Esta noche** (NBA): partidos del día con marcador en directo (EN VIVO, cuarto y reloj) y selector de 7 días (los próximos días sin cuotas). **Esta semana** (NFL): todos los partidos de la semana con día y hora.
- **Partido**: ganador, hándicap, totales y puntos por equipo con el modelo, historial y bajas; pestañas de jugadores por equipo con % L5/L10/L20/H2H.
- **Props**: lista ordenada por valor con mini barras verde/rojo; ficha de jugador con barras (verde = se cumplió, rojo = no, número encima, línea marcada).
- **Boleto** y **Apuestas**: registro con importe y cuota, calendario verde/rojo, gráfico de ganancias, y cada apuesta se despliega con marcador, cuartos, línea de evolución por jugador y box score.
- **Cuotas** (solo admin): pegar líneas a mano.
- **Compartir ticket**: botón en cada apuesta. Pinta la tarjeta desplegada fuera de la pantalla con el logo de Tribuna y la captura con html-to-image (jsdelivr, se carga solo al compartir); escudos y fotos de NBA.com se cambian por los de ESPN porque NBA.com no deja exportarlos (la foto usa el `eid` de ESPN del directo). Vista previa con Compartir (menú del móvil) y Descargar.
- **Configuración** (foto de perfil arriba a la derecha): correo con foto predeterminada, idioma (español, italiano, inglés), moneda (solo cambia el símbolo y el formato, no convierte), cambiar contraseña y cerrar sesión. Se guarda en `localStorage` (`tribuna:lang`, `tribuna:cur`).
- **Idiomas**: la app se escribe en español y `app/i18n.js` traduce lo que se pinta (filas `[es, it, en]` en `T`; textos con números o nombres en `R`). **Cada texto nuevo de la app necesita su fila en `i18n.js`.** Fechas y números salen en el idioma elegido (`LOC` en `app.js`).

## Archivos
- `app/` web estática (sin build): `index.html` (lee la liga antes de cargar nada), `app.js` (casi todo; lo que cambia por liga está en `LG`, `STATS_NBA`/`STATS_NFL`, `RIDGE`, `SD`, `IMPACT`), `styles.css`, `visual.js` (escudos y fondos), `i18n.js` (idiomas), `espn.js` (directo y calendario), `demo.js` (datos simulados NBA y NFL), `config.js`.
- `actualizar_nba.py` estadísticas de NBA.com (nba_api) → `nba.json` → Supabase (`snapshots` id `nba`).
- `actualizar_nfl.py` estadísticas de nflverse (GitHub, sin clave) → `nfl.json` → `snapshots` id `nfl`. En NFL la columna `min` son oportunidades (pases + carreras + targets).
- `actualizar_cuotas.py [--liga nfl]` cuotas → tabla `odds` (las NFL con prefijo `nfl:` en `player_id`); llama a `bajas.py` (parte de lesiones de ESPN → `snapshots` id `bajas` / `bajas_nfl`).
- `*.bat` ejecutar y programar tareas de Windows. `herramientas/probar_directo.js` prueba el directo de ESPN con `nba.json`.
- `supabase.sql`, `supabase_cuotas.sql`, `supabase_grupo.sql` esquema; `supabase/functions/nba-live` proxy de NBA.com (**no desplegado**, no hace falta).

## Publicar
- GitHub Pages desde `main` de github.com/LAKAKAxd/tribuna → https://lakakaxd.github.io/tribuna/app/ (demo: `?demo`; demo NFL: elegir NFL arriba).
- **Siempre** que cambies algo de `app/`, sube el número `?v=` de todos los scripts y estilos en `app/index.html` (último: 1794902800). Si no, los navegadores siguen con la versión vieja.
- Comprueba la sintaxis: `node -e "new Function(require('fs').readFileSync('app/app.js','utf8'))"`. Para ver la app sin Supabase, abre `app/index.html?demo` con un servidor local.

## Datos y horarios (PC de Fabio, Windows, carpeta C:\Users\fabio\Tribuna)
- 09:00 tarea «Tribuna NBA» (`ejecutar_actualizacion.bat`): estadísticas NFL (nflverse) y NBA (NBA.com, solo funciona desde su PC; desde la nube da 403).
- 18:00 «Tribuna Cuotas 18» (NBA y NFL) y 21:00 «Tribuna Cuotas 21» (`--props`, solo NBA): PropLine principal (1.000 consultas/día gratis), The Odds API y SportsGameOdds de respaldo. Cuotas = media del mercado, **sin nombres de casas**. La NFL comparte los 500 créditos/mes de The Odds API.
- Directo, calendario de la semana y bajas: **ESPN** (`site.api.espn.com`, CORS abierto). cdn.nba.com bloquea al navegador. NFL: siglas de nflverse (Rams `LA`, Washington `WAS`; ESPN usa `LAR`/`WSH`).
- `config.env` (solo en su PC, nunca en el repo ni en el chat): SUPABASE_URL, SUPABASE_SERVICE_KEY, PROPLINE_API_KEY, SGO_API_KEY, ODDS_API_KEY. La anon key pública está en `app/config.js`.

## Supabase
- https://ulfxhbkoabqfyljteyab.supabase.co · tablas `snapshots`, `odds`, `admins`, `apuestas` (+ grupo). Registro cerrado: Fabio invita usuarios a mano (Auto Confirm).
- `supabase_cuotas.sql` y `supabase_grupo.sql` ya ejecutados (confirmado 17/11/2026). Pendiente: revisar la Site URL.

## Interruptores en `app/config.js`
- `logosOficiales: true` y `fotosOficiales: true` (logos y fotos de NBA.com, ESPN y NFL.com). **Solo uso privado: ponerlos en `false` antes de publicar la app.**

## Modelo
- NBA partido: ridge ataque/defensa + ventaja de campo (~1,8), temporada anterior peso 0,3; historial corregido por titulares ausentes. SD: ganador 12, hándicap 13, total 18, puntos de equipo 12. Los totales apenas superan al azar.
- NFL partido (calibrado 17/11/2026 con 1.100 partidos 2022-2025): misma ridge, temporada anterior 0,2; solo cuenta la baja del QB titular (−3,5 puntos). SD: ganador 14, hándicap 13, total 13,5, puntos de equipo 9,5. Los totales NO superan a la línea del mercado.
- Props: últimos 40 partidos, vida media 10 (NBA) / 8 (NFL), kernel suavizado (bien calibrado). Bajas NBA: compañeros +10 % de lo que falta (en NFL no, sin calibrar).
- Valor = mezcla 50/50 modelo y cuota (`MKT_W`), sin validar: haría falta guardar el histórico de cuotas.

## Reglas
- Coste 0 €. Nada de nombres de casas, marcas, enlaces ni afiliados. Descartado el factor «vida privada» (RGPD). Consultar a un abogado antes de publicar (Italia: Decreto Dignità y AGCOM).
- Estilo «Noche»: oscuro con acento ámbar y modo claro; tokens en `:root` de `styles.css`. Verde `--hit` / rojo `--miss` para lo que se cumple o no.
- Inspirarse en otras apps sin copiar su marca ni su diseño.

## Pendientes
- ScoreboardV2 de nba_api está obsoleto: pasar a V3.
- NFL: probar las cuotas reales (`py actualizar_cuotas.py --liga nfl --prueba`); los nombres de mercado de PropLine/SportsGameOdds para NFL no se han comprobado con una respuesta real.
