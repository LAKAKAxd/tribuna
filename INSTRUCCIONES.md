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
| `ejecutar_actualizacion.bat` | Ejecuta el script y lo sube a Supabase, guardando un registro |
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

### Cuotas automáticas (The Odds API, gratis)
1. Crea una cuenta gratis en the-odds-api.com (plan Starter, 500 créditos al mes). La clave llega por correo.
2. Añade en `config.env` una línea `ODDS_API_KEY=tu_clave`. No la compartas ni la subas a GitHub.
3. En Supabase > SQL Editor ejecuta `supabase_cuotas.sql` (una sola vez).
4. Dos tareas de Windows: a las 18:00 `ejecutar_cuotas.bat` (ganador, hándicap y total, 3 créditos) y a las 21:00 `ejecutar_cuotas.bat --props` (lo mismo + props de jugadores).
El script reparte los créditos para que lleguen a fin de mes: primero puntos de todos los jugadores, y triples, rebotes y asistencias solo si sobra. Lo que pase queda en `cuotas.log`. En la pestaña Cuotas de la app ves los créditos que quedan. Las cuotas que pegues a mano tienen prioridad.
Para probar sin gastar nada: `py actualizar_cuotas.py --prueba`.
