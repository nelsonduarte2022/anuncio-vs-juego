# Antes de descargar

Prototipo de una base de datos pública para comparar anuncios de juegos con la experiencia real.

## Datos

El catálogo está en [data/games.js](data/games.js). Cada registro contiene:

- Identidad: nombre, desarrollador, categoría e imagen local.
- Google Play: package ID, puntuación, número de reseñas, descargas, descripción, fecha de actualización y URL.
- App Store: URL, categoría, desarrollador y estado de los campos aún no verificados.
- Investigación: mecánica prometida, mecánica observada, veredicto, evidencia y reseña.

Los datos de tiendas incluidos son una captura consultada el 13 de octubre de 2026. No se rellenan con estimaciones los campos que Apple no muestra en la ficha consultada.

## Juegos incluidos

Gardenscapes, Homescapes, Sled Surfers, Royal Match, Candy Crush Saga, Angry Birds 2 y Plants vs. Zombies 2.

La página es estática por ahora. Los comentarios de la comunidad se guardan en el `localStorage` del navegador; para compartirlos entre personas haría falta un backend con moderación. Para actualizar el catálogo automáticamente haría falta un proceso backend que consulte APIs o fuentes autorizadas de cada tienda y guarde el historial de cambios.

La comunidad también puede agregar juegos desde la sección “Agregar juego”. Estas aportaciones se guardan en el `localStorage` del navegador y aparecen en el catálogo con la marca “Aportación comunitaria” hasta que se conecte un backend compartido y un flujo de revisión.