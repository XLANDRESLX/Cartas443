# Cartas 4-4-3

Juego de cartas colombiano **4-4-3** multijugador en línea (P2P via WebRTC con PeerJS). Proyecto de la Electiva de Profundización, Unicaribe, Ciénaga (Magdalena).

## ¿Cómo se juega?

- Cada jugador recibe **10 cartas**. El resto forma el mazo y se voltea una carta al descarte.
- El turno inicial se elige al azar. Se juega por turnos.
- En tu turno debes **robar 1 carta** (del mazo o del pozo de descarte), quedando con **11 cartas**.
- Con tus 11 cartas debes **organizar 3 grupos**:
  - **Grupo A (4 cartas):** trío o cuarteto del mismo número, o escalera de 4 del mismo palo (también se acepta un trío acompañado de una carta libre).
  - **Grupo B (4 cartas):** igual que el Grupo A.
  - **Grupo C (3 cartas):** trío del mismo número o escalera de 3 del mismo palo.
- Si logras armar las 3 combinaciones presiona **👑 Cantar 4-4-3** y ganas la partida.
- Si no puedes, **bota 1 carta** al descarte y cede el turno.
- Si el mazo y el descarte se agotan sin que nadie cante, la partida termina en **empate** y se reparte de nuevo.
- La persona que organiza la victoria es **host-autoritativa**: solo el anfitrión valida el tablero; la invitada_envia sus acciones y recibe el estado.

## Tecnologías

- Vanilla JavaScript (ES Modules, arquitectura MVC).
- **PeerJS** para la conexión P2P WebRTC (host se conecta a la nube pública `0.peerjs.com`).
- Tailwind CSS (vía CDN) para el layout y SweetAlert2 para los modales.
- Efectos de sonido generados con Web Audio API (sin archivos externos).
- Las cartas se dibujan con CSS (sin imágenes).

## Estructura

```
index.html                 Punto de entrada y overlay de inicio
css/styles.css             Estilos (cartas, mesa, zonas, animaciones)
js/main.js                 Arranque y eventos del overlay
js/controllers/GameController.js  Mediador host-autoritativo
js/models/Card.js          Definición de carta y baraja
js/models/CardGameModel.js Lógica del juego y validación 4-4-3
js/network/PeerNetwork.js  Capa P2P (PeerJS)
js/views/BoardView.js      Render de mesa, mano y zonas
js/views/UIControlsView.js Modales y toasts (SweetAlert2)
js/views/AudioView.js      Efectos de sonido (Web Audio)
assets/                    Carpetas de recursos (cards, sounds, img)
```

## Cómo jugar en local

El juego usa módulos ES y PeerJS, por lo que no funciona con `file://`. Necesitas un servidor local:

```
npx serve .
```

Después abre `http://localhost:3000` en dos pestañas/navegadores distintos (o en dos dispositivos de la misma red) y crea/únete con el código de sala.

## Despliegue en GitHub Pages

1. Crea un repositorio en GitHub y súbelo (rama `main`).
2. En GitHub ve a **Settings → Pages**.
3. En **Source** selecciona `Deploy from a branch` y la rama `main` con carpeta `/ (root)`.
4. Guarda. El sitio quedará disponible en `https://<usuario>.github.io/<nombre-repo>/`.

> Nota: el anfitrión siempre genera un código con formato `443-XXXX`. Comparte ese código con quien vaya a unirse.