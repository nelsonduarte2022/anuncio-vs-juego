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

Gardenscapes, Homescapes, Sled Surfers, Royal Match y Candy Crush Saga.

La página es estática por ahora. Para actualizar el catálogo automáticamente haría falta un proceso backend que consulte APIs o fuentes autorizadas de cada tienda y guarde el historial de cambios.