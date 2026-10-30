# Black Stone · The Maze (web)

Ayudante gratuito para el Amo del Laberinto de *The Maze*. Funciona en el navegador del celular y de la PC, y se puede instalar como app («Agregar a pantalla de inicio»). Una vez abierta, sirve sin conexión.

**Tú tiras los dados; la app lee las tablas.** Ninguna pantalla tira dados: todo se teclea.

## Qué hace

- **Cámara:** las Siete Tiradas (Cámara, Condición, Entradas, Temporizador, Botín, Habitantes y la de Mímicos, opcional y secreta), con las reglas de cada una de las 100 cámaras: tiradas que se saltan, condiciones excluidas, entradas fijas, Temporizador ×10 con una sola entrada, etc. Las tiradas derivadas (cuántos hay, cuántas veces se tira una tabla, armas, menas, cadáveres) se piden una a una. Dentro de la cámara: contador de rondas con la entrada abierta o cerrada, magia salvaje y demás sucesos.
- **Registro:** las cámaras cerradas, con cómo terminaron y las muertes. Se guarda en el propio navegador.
- **Referencia:** las tablas del libro (A–D, 3.1–3.10, 4.1–4.9), criaturas, ítems y materiales, cada dato con su página.

Fuera por ahora: las reglas extendidas (Vida en la Hoguera, Guerra y Comercio, Tablero de Ajedrez, Críticos y Desmembramiento). La Tabla 3.10 de Trampas sí está.

## Datos

Los datos son de *The Maze*, de M. A. Bastarrachea Magnani (Axo stories). La app muestra nombres, cifras y efectos de juego abreviados con su página; las descripciones completas están en el libro.

`tools/build_reference.py` genera `data/bestiary.json`, `data/materials.json` y `data/magic.json` a partir de una transcripción local del libro, que no se publica.

## Desarrollo

Es HTML, CSS y JavaScript sin compilar. Para probar en local:

```bash
python -m http.server 8770
```

Abre `http://localhost:8770`. Las pruebas del motor están en `http://localhost:8770/tests.html`.
