# Tribuna: puesta en marcha en Windows (0 € al mes)

Tiempo total: unos 30 minutos, una sola vez. Cuando vuelvas a casa, puedes hacerlo tú con estos pasos o dejarme conectarme a tu ordenador para hacerlo juntos.

## 1. Instalar Python (5 min)

1. Descarga Python desde [python.org/downloads](https://www.python.org/downloads/) e instálalo.
2. En la primera pantalla del instalador marca **"Add python.exe to PATH"**.
3. Abre **Símbolo del sistema** y escribe:
   ```
   py -m pip install nba_api requests
   ```

## 2. Probar la descarga (5 min)

1. Copia la carpeta `nba-props` a tu ordenador, por ejemplo en `C:\Tribuna`.
2. En Símbolo del sistema:
   ```
   cd C:\Tribuna
   py actualizar_nba.py
   ```
3. Debe terminar con algo como `Listo: 400 jugadores, 8 partidos hoy, 1500 KB → nba.json`. Si da error, mándame el texto.

## 3. Crear la base de datos en Supabase (10 min, gratis)

1. Crea una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo (región: Europa).
2. Ve a **SQL Editor → New query**, pega el contenido de `supabase.sql`, cambia `CAMBIA-ESTO@ejemplo.com` por tu correo y pulsa **Run**.
3. Ve a **Project Settings → API** y copia la **Project URL** y la **service_role key**.
4. En la carpeta, copia `config.env.ejemplo` como `config.env` y pega esos dos valores. La service_role key es secreta: no la compartas ni la subas a GitHub.
5. Prueba la subida:
   ```
   py actualizar_nba.py --subir
   ```
   Debe terminar con `Subido a Supabase.`

## 4. Programarlo cada mañana (2 min)

Haz doble clic en `programar_tarea_diaria.bat`. Crea la tarea "Tribuna NBA", que se ejecuta cada día a las 09:00 (o al encender el ordenador si estaba apagado). Lo que pasa queda en `actualizacion.log`.

## 5. GitHub (5 min, gratis)

Crea una cuenta en [github.com](https://github.com) y un repositorio vacío llamado `tribuna`. Después conéctalo a Claude con [Connect GitHub](https://claude.ai/connect-github) para que pueda subir la app y publicarla gratis.

## Qué hace cada archivo

| Archivo | Para qué |
| --- | --- |
| `actualizar_nba.py` | Descarga de NBA.com las estadísticas de esta temporada y la anterior, los partidos de hoy y las posiciones |
| `actualizar_futbol.py` | Fútbol de ESPN (gratis, sin clave): Serie A, LaLiga, Premier y Champions, con estadísticas de cada jugador. La primera vez tarda unos 15 minutos |
| `actualizar_nfl.py` | Lo mismo para la NFL, desde nflverse (GitHub, gratis, sin clave): estadísticas de QB, RB, WR y TE, resultados y partidos de la semana |
| `ejecutar_actualizacion.bat` | Ejecuta los dos scripts y los sube a Supabase, guardando un registro |
| `programar_tarea_diaria.bat` | Crea la tarea diaria de Windows |
| `supabase.sql` | Crea las tablas (estadísticas, cuotas, administradores) y los permisos: tus amigos leen, solo tú escribes cuotas |
| `config.env.ejemplo` | Plantilla para tus claves de Supabase |

Nota: NBA.com no es una API oficial y puede cambiar o bloquear conexiones sin avisar. Si un día falla, la app sigue mostrando los datos del día anterior.

## La app (carpeta `app/`)

1. Abre `app/config.js` y pega la **Project URL** y la **anon public key** de Supabase (Project Settings > API). Sin ellas la app funciona en modo demostración.
2. En Supabase > Authentication > Sign In / Providers, desactiva **Allow new users to sign up**. Invita a tus amigos desde Authentication > Users > Invite user.
3. Sube la carpeta `app/` a un repositorio de GitHub y activa GitHub Pages (Settings > Pages). Nunca subas `config.env`.

### Escudos y fondos animados
- Por defecto se ven escudos propios con los colores de cada equipo. Se pueden publicar sin problema.
- `logosOficiales: true` en `config.js` usa los logos de la NBA. Solo para uso privado: tienen derechos de marca.
- Fondo de la ficha de jugador: en la ficha, abre «Fondo animado» y pega un enlace https a un GIF o MP4 (solo el administrador). También se pueden poner en `config.js` > `fondos`. Si un jugador no tiene, se ve una animación propia según su especialidad (tirador, director, pintura, anotador).
- Los vídeos de jugadas de la NBA tienen derechos: úsalos solo en privado y quítalos antes de publicar.

### Mis apuestas y directo
- Cada usuario registra sus apuestas (simples o combinadas) desde el Boleto con importe y cuota. Se guardan en Supabase, tabla `apuestas` (incluida en `supabase.sql`): cada uno solo ve las suyas.
- El seguimiento en vivo lee el marcador gratuito de NBA.com cada 30 segundos mientras la app está abierta. Si el navegador no deja leerlo directamente, la app usa la función `supabase/functions/nba-live/index.ts`: en Supabase > Edge Functions > Deploy a new function, llámala `nba-live` y pega ese código (gratis hasta 500.000 llamadas al mes).
- Si nadie tiene la app abierta, las apuestas se cierran solas al día siguiente con los datos del script.

### Dar acceso a un amigo (sin correos)
El correo gratuito de Supabase solo envía unos 2 mensajes por hora, así que la app entra con correo + contraseña:
1. Supabase > Authentication > Users > **Add user > Create new user**.
2. Escribe su correo y una contraseña (mínimo 6 caracteres) y deja marcado **Auto Confirm User**.
3. Pásale el correo y la contraseña. Dentro de la app puede cambiarla abajo, en «Cambiar mi contraseña».
Para quitar a alguien: en esa misma lista, los tres puntos > Delete user.

### Que tus amigos creen su propia cuenta (código de grupo)
1. Supabase > SQL Editor > New query: pega `supabase_grupo.sql` entero y pulsa Run.
2. Authentication > Sign In / Providers: activa **Allow new users to sign up** y, dentro de Email, desactiva **Confirm email** (así no hace falta enviar correos).
3. En la app, pestaña Cuotas, verás el **Código del grupo**. Pásaselo a tus amigos con la dirección de la app: pulsan «Crear cuenta», ponen correo, contraseña y el código.
Sin el código, una cuenta nueva no puede ver nada. Puedes cambiar el código cuando quieras.

### Cuotas automáticas (tres APIs gratis)
Cada fuente tiene su papel:
- **PropLine** (1.000 consultas al día): la principal. Ganador, hándicap, total, puntos por equipo y todas las props de jugadores (puntos, rebotes, asistencias, triples, combinadas, robos, tapones, pérdidas, tiros, doble-doble, triple-doble).
- **The Odds API** (500 créditos al mes): solo rellena lo que PropLine no traiga. A las 21:00 también puede gastar créditos en props que falten, sin pasarse del reparto mensual.
- **SportsGameOdds** (2.500 eventos al mes): última red, solo si aún falta algo.
- **NBA.com**: estadísticas (09:00) y marcador en directo del boleto.
- **Tú, a mano**: lo que no traiga ninguna (cuartos, primer anotador, especiales) o corregir una línea. Lo tuyo siempre tiene prioridad.

1. Pon las tres claves en `config.env`: `PROPLINE_API_KEY=`, `ODDS_API_KEY=` y `SGO_API_KEY=`. No las compartas ni las subas a GitHub. Si falta una, el script se la salta.
2. En Supabase > SQL Editor ejecuta `supabase_cuotas.sql` (una sola vez).
3. Dos tareas de Windows: a las 18:00 `ejecutar_cuotas.bat` y a las 21:00 `ejecutar_cuotas.bat --props`.
Lo que pase queda en `cuotas.log`; en la pestaña Cuotas de la app ves lo que queda de cada plan.
Para probar sin subir nada: `py actualizar_cuotas.py --prueba` (o `--solo propline|oddsapi|sgo` para una sola fuente).

### NFL
- Arriba, junto a «Tribuna», el selector **NBA | NFL** cambia de liga (se recuerda en cada navegador).
- El **boleto y las apuestas son los mismos para todas las ligas**: puedes juntar en un ticket selecciones de NBA y de NFL. Cada selección lleva su etiqueta de liga; su directo se ve al elegir su liga arriba, y el ticket se cierra cuando todas sus selecciones tienen resultado.
- La jornada NFL es la semana entera (jueves a lunes): «Esta semana» enseña todos sus partidos con día y hora de Italia.
- Datos: `actualizar_nfl.py` a las 09:00 (dentro de `ejecutar_actualizacion.bat`). Cuotas y bajas: `py actualizar_cuotas.py --liga nfl`, que `ejecutar_cuotas.bat` lanza solo a las 18:00. Las cuotas NFL se guardan en la misma tabla con el prefijo `nfl:`.
- No hace falta ejecutar nada nuevo en Supabase.
- Cuotas a mano: igual que en la NBA, con estas estadísticas: `pyd` (yardas de pase), `ptd`, `cmp`, `att`, `int`, `pry` (pase + carrera), `ryd` (carrera), `car`, `rec`, `reyd` (recepción), `rry` (carrera + recepción), `tgt` y `td` (anota touchdown, línea 0,5). Ejemplo: `Mahomes pyd 265,5 1,87 1,93`.

### ¿Acierta el valor? y Grupo
1. En Supabase > SQL Editor ejecuta `supabase_valor_grupo.sql` (una sola vez).
2. **¿Acierta el valor?** (pestaña Cuotas o Configuración, solo el administrador): cada vez que abres la app después de que se carguen las cuotas y antes de los partidos, la app guarda lo que decía el modelo de cada apuesta. Con el tiempo ves si las apuestas «Con valor» ganan de verdad (apostando 1 unidad a cada una). Hacen falta unas semanas (~200 apuestas cerradas) para que el resultado no sea suerte.
3. **Grupo** (pestaña Apuestas > Grupo): cada uno, en Configuración, elige el nombre que verán los demás y si comparte sus apuestas. Quien comparte sale en el ranking (ordenado por rentabilidad) y sus tickets se ven en el muro. El correo nunca se enseña.

### Instalar Tribuna como app
- iPhone (Safari): botón Compartir > «Añadir a pantalla de inicio». Android (Chrome): menú ⋮ > «Instalar app» o «Añadir a pantalla de inicio».
- Se abre a pantalla completa con su icono. Hace falta para los avisos en iPhone.

### Avisos en el móvil (con la app cerrada)
1. Supabase > **Edge Functions** > «Deploy a new function» > «Via Editor». Nombre: `avisos`. Pega todo `supabase/functions/avisos/index.ts`. En los ajustes de la función, **desactiva «Verify JWT»** (la función usa su propia clave). Deploy.
2. Supabase > SQL Editor: pega `supabase_avisos.sql` entero y Run (una sola vez). Programa la función cada 2 minutos.
3. En la app (en iPhone, abierta desde el icono de la pantalla de inicio): Configuración > Avisos > «Activar avisos». En 2 minutos llega un aviso de prueba.
Avisa de: ticket ganado o perdido, selección cumplida en combinadas y «a X le faltan 2» (10 en yardas). Cada aviso llega una sola vez.

### Fútbol (FC)
- Arriba, **FC** en el selector. «Próximos partidos» enseña los de los próximos 7 días con filtro por competición.
- Datos: `actualizar_futbol.py` a las 09:00 (dentro de `ejecutar_actualizacion.bat`). Sin cuotas automáticas: se pueden pegar a mano en Cuotas (`INT ganador 1,80`, `NAP@INT empate 3,40`, `NAP@INT ambos 1,85 1,95`, `NAP@INT total 2,5 1,90 1,90`, `Lautaro gol 0,5 2,40`, `Lautaro tiros 2,5 1,85 1,95`).
- El modelo acierta el 1X2 mejor que el azar; en más/menos goles y ambos marcan apenas.
- En cada partido: **Estadísticas por partido** (córners, tarjetas, tiros, faltas cometidas y recibidas, fueras de juego, posesión, pases, entradas, paradas y goles en la 1.ª parte; últimos 5, 10 o temporada, en total, en casa o fuera), **Precedentes** (últimos 6 enfrentamientos) y mercados de **córners, tarjetas, tiros, tiros a puerta, faltas y fueras de juego** del partido o de cada equipo, con su historial y el modelo.
- Cuotas a mano de estos mercados: `NAP@INT corners 9,5 1,85 1,95` (total del partido) o `INT tarjetas 2,5 1,90 1,90` (de un equipo). También `tiros`, `puerta`, `faltas` y `fueras`.
- Saques de banda, saques de puerta y tiros libres no salen en los datos gratis de ESPN; las faltas recibidas son la mejor aproximación a los tiros libres.
- Tras actualizar la app hay que volver a pegar la función `avisos` en Supabase para que avise también de estos mercados.

### Site URL de Supabase
Supabase > Authentication > URL Configuration: **Site URL** = `https://lakakaxd.github.io/tribuna/app/` y añade la misma en **Redirect URLs**. Es la dirección a la que llevan los correos de Supabase (cambio de contraseña, invitaciones).
