# AdTrap

AdTrap ayuda a descubrir si el anuncio de un juego se parece al juego real.

Prototipo de una base de datos pública para comparar anuncios de juegos con la experiencia real.

## Datos

El catálogo está en [data/games.js](data/games.js). Cada registro contiene:

- Identidad: nombre, desarrollador, categoría e imagen local.
- Google Play: package ID, puntuación, número de reseñas, descargas, descripción, fecha de actualización y URL.
- App Store: URL, categoría, desarrollador y estado de los campos aún no verificados.
- Investigación: mecánica prometida, mecánica observada, veredicto, evidencia y reseña.

## Estructura del proyecto

- `index.html`: catálogo de juegos y buscador.
- `wall.html`: Muro de la Vergüenza.
- `videos.html`: comparación de anuncio y juego real.
- `comments.html`: comentarios de la comunidad.
- `help.html`: guía y formulario de aportaciones.
- `css/styles.css`: variables, componentes visuales y estilos responsive.
- `js/app.js`: búsqueda, filtros, fichas, comentarios, aportaciones y búsqueda por imagen.
- `data/games.js`: catálogo inicial de juegos.
- `assets/`: imágenes locales del catálogo.
- `backend/app.py`: API REST Flask y conexión SQLite.
- `backend/init_db.py`: inicialización manual de la base de datos.
- `backend/requirements.txt`: dependencias del backend.

Cada sección tiene su propia página HTML. El Muro usa tres tiers con scroll horizontal en
sus filas y cada mini tarjeta redirige directamente a Videos con el juego seleccionado.
Las transiciones, tarjetas y entrada de comentarios mantienen sus animaciones mediante
`css/styles.css` y `js/app.js`.

Los videos se cargan desde YouTube mediante identificadores guardados en `data/games.js`.
Cuando no existe una fuente identificable para un anuncio concreto, AdTrap muestra
“Video pendiente” en lugar de atribuir un video equivocado al juego.

También se admiten videos locales. Para usar una grabación propia, copia el archivo MP4
en `assets/videos/` y configura el campo correspondiente con su ruta, por ejemplo:
`videos: { ad: "assets/videos/idle-guy-ad.mp4", gameplay: "qjOdOnTuqbQ" }`.
El navegador mostrará controles nativos y el archivo no se enviará a YouTube.

El backend también puede guardar videos autorizados en su carpeta `backend/media/videos/`
y registrar sus metadatos en SQLite. Con Flask encendido, sube una grabación propia así:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:5000/api/videos `
  -Method Post `
  -Form @{ game_id = "idle-guy"; tipo = "ad"; video = Get-Item ".\assets\videos\idle-guy-ad.mp4" }
```

La aplicación consulta `GET /api/videos` y prioriza esos archivos sobre cualquier video
externo. La API acepta MP4, WebM y MOV de hasta 250 MB. Solo deben subirse grabaciones
propias o con permiso de distribución; no se descargan ni se copian videos de YouTube
automáticamente.

La auditoría actual encontró gameplay para los 12 juegos. Los anuncios verificados están
disponibles para todos excepto Plants vs. Zombies 2, Idle Guy y Brain Puzzle 2; estos tres
mantienen el anuncio pendiente hasta localizar una creatividad que corresponda claramente
al juego.

Las carátulas del catálogo se guardan localmente en `assets/`. Las nuevas carátulas de
Angry Birds 2, Plants vs. Zombies 2, Gossip Harbor, Idle Guy y Brain Puzzle 1, 2 y 3
se obtuvieron de sus fichas oficiales de App Store; no se usan imágenes de relleno.

## Backend local

El backend guarda comentarios y aportaciones en SQLite. Los comentarios nuevos quedan
pendientes (`aprobado = 0`) hasta que un proceso de moderación los apruebe directamente
en la base de datos.

Desde la raíz del proyecto:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
py backend\init_db.py
py backend\app.py
```

Si PowerShell muestra que `py` no existe, usa el intérprete detectado por VS Code:

```powershell
$python = "C:\Users\missa\AppData\Roaming\uv\python\cpython-3.15.1-windows-x86_64-none\python.exe"
& $python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
& .\.venv\Scripts\python.exe backend\init_db.py
& .\.venv\Scripts\python.exe backend\app.py
```

También puedes seleccionar ese intérprete desde `Python: Select Interpreter` en VS Code.
Para que los comandos `py` y `python` funcionen globalmente, instala Python desde
python.org y marca **Add Python to PATH** durante la instalación.

La API queda disponible en `http://127.0.0.1:5000`. Para servir el frontend en otra
terminal, usa un servidor estático:

```powershell
py -m http.server 5500
```

Después abre `http://127.0.0.1:5500`. El frontend usa esa API por defecto; puedes cambiarla
antes de cargar `js/app.js` con `window.ADTRAP_API_URL`.

Endpoints disponibles:

- `GET /api/comentarios/<game_id>`: comentarios aprobados de un juego.
- `POST /api/comentarios`: recibe `{ "game_id": "...", "contenido": "..." }`.
- `POST /api/aportaciones`: recibe los datos principales y conserva el resto del JSON
  completo para revisión.
- `GET /api/aportaciones?estado=pendiente`: lista aportaciones para moderar.
- `PATCH /api/aportaciones/<id>/aprobar`: marca una aportación como aprobada.
- `GET /api/health`: comprobación rápida del servidor.
- `GET /api/videos`: lista videos locales aprobados.
- `POST /api/videos`: guarda una grabación autorizada (`game_id`, `tipo` y archivo `video`).

### Agregar una aportación completa

Desde PowerShell, con Flask encendido, puedes enviar un juego así:

```powershell
$juego = @{
  nombre_juego = "Mi juego nuevo"
  desarrollador = "Estudio ejemplo"
  mecanica_real = "Combinar piezas y superar niveles"
  id = "mi-juego-nuevo"
  category = "puzzle"
  image = "assets/mi-juego-nuevo.jpg"
  promised = "Salvar al personaje con decisiones"
  real = "Resolver niveles match-3"
  status = "Por revisar"
  videos = @{ ad = $null; gameplay = $null }
  googlePlay = @{ url = "https://play.google.com/" }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Uri http://127.0.0.1:5000/api/aportaciones `
  -Method Post `
  -ContentType "application/json" `
  -Body $juego
```

Para revisar aportaciones pendientes:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/api/aportaciones?estado=pendiente
```

Para aprobar una aportación, usa su `id`:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:5000/api/aportaciones/1/aprobar `
  -Method Patch
```

La aprobación solo cambia el estado de la sugerencia; no la publica automáticamente en
el catálogo. Después de verificarla, copia sus datos a `data/games.js` o crea una migración
posterior del catálogo a SQLite. Estos endpoints de moderación no tienen autenticación y
deben protegerse antes de exponerlos fuera del entorno local.

Los datos de tiendas incluidos son una captura consultada el 13 de octubre de 2026. No se rellenan con estimaciones los campos que Apple no muestra en la ficha consultada.

## Juegos incluidos

Gardenscapes, Homescapes, Sled Surfers, Royal Match, Candy Crush Saga, Angry Birds 2,
Plants vs. Zombies 2, Gossip Harbor, Idle Guy y Brain Puzzle 1, 2 y 3.

Los cinco juegos añadidos recientemente están marcados como “Por revisar” y no incluyen
videos ni imágenes inventadas. Sus fichas pueden completarse después con una aportación
moderada desde el backend.

Los comentarios y aportaciones se envían al backend compartido y ya no se guardan en
`localStorage`. Las aportaciones se registran para revisión y todavía no modifican el
catálogo público automáticamente.

Los videos se muestran en la ficha de cada juego separados como “Anuncio” y “Juego real”.
Cuando no existe un anuncio verificado en el catálogo, la interfaz muestra “Video pendiente”
en vez de presentarlo como publicidad real. Los anuncios de Instagram y Facebook deben
incorporarse mediante una URL pública o una copia autorizada; esas plataformas no permiten
reproducir cualquier anuncio directamente desde una página estática.