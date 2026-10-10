# Cartas 4-4-3

Juego de cartas colombiano **4-4-3** multijugador en línea (P2P via WebRTC con PeerJS). Proyecto de la Electiva de Profundización, Unicaribe, Ciénaga (Magdalena).

## ¿Cómo se juega?

- Cada jugador recibe **10 cartas**. El mazo tiene **104 cartas** (2 copias de cada una de las 52 cartas: 4 palos × 13 valores). El resto forma el mazo y se voltea una carta al descarte.
- El turno inicial se elige al azar. Se juega por turnos entre **2 y 4 jugadores**.
- En tu turno debes **robar 1 carta** (del mazo o del pozo de descarte), quedando con **11 cartas**.
- Con tus 11 cartas debes **organizar 3 grupos**:
  - **Grupo C (3 cartas):** trío del mismo número o escalera de 3 del mismo palo.
  - **Grupo A (4 cartas):** trío o cuarteto del mismo número, o escalera de 4 del mismo palo (también se acepta un trío acompañado de una carta libre).
  - **Grupo B (4 cartas):** igual que el Grupo A.
- Organiza tu mano a gusto: **arrastra las cartas** para insertarlas donde quieras, haz **clic** para seleccionar, o usa las herramientas **🔢 Valor**, **♠️ Palo**, **♠️🔢 Ambos** y **↩️ Deshacer**. Este orden es **privado** (solo tú lo ves) y se guarda en tu dispositivo.
- Si logras armar las 3 combinaciones presiona **👑 Cantar 4-4-3** y ganas la partida.
- Si no puedes, **bota 1 carta** al descarte y cede el turno.
- Si el mazo y el descarte se agotan sin que nadie cante, la partida termina en **empate** y se reparte de nuevo.
- El anfitrión es **host-autoritativo**: solo el host valida el tablero; cada invitado envía sus acciones y recibe un estado personalizado (su mano, y solo los conteos de los demás).

## Salas y lobby

- **Jugar / Crear sala privada** genera un código con formato `443-XXXX`. Compártelo para que se unan.
- **Salas** abre un lobby local con las **salas recientes de este dispositivo** (guardadas en `localStorage`), donde puedes copiar el código o eliminarlas.
- **Salas públicas**: hay **15 salas fijas** con códigos predefinidos `sala-publica-1` … `sala-publica-15`. Al abrir **Salas**, la app **sondea la ocupación** de cada una (cuántos jugadores hay) usando una conexión ligera de "consulta"; el anfitrión de cada sala responde su estado sin consumir un cupo. Con **↻ Ver ocupación** se actualiza el listado.
- **Entrar** a una sala pública: si ya hay un anfitrión te unes como invitado; si está vacía, tú la abres con ese código. Los botones se deshabilitan si la sala está **llena** (4/4) o con **partida en curso**.
- Mientras se espera, la **sala de espera** muestra el código y la lista de jugadores; el host habilita **Iniciar partida** en cuanto hay al menos 2 conectados.
- El aforo es de **4 jugadores**; las conexiones extra se rechazan automáticamente.

## Tecnologías

- Vanilla JavaScript (ES Modules, arquitectura MVC).
- **PeerJS** para la conexión P2P WebRTC (host se conecta a la nube pública `0.peerjs.com`).
- Tailwind CSS (vía CDN) para el layout y SweetAlert2 para los modales.
- Efectos de sonido generados con Web Audio API (sin archivos externos).
- Las cartas se dibujan con CSS (sin imágenes).

## Estructura

```
index.html                 Punto de entrada: pantallas de inicio, lobby, mesa y sala de espera
css/styles.css             Estilos (cartas, mesa, asientos, zonas, overlay de espera)
js/main.js                 Arranque, navegación de pantallas y salas recientes (localStorage)
js/controllers/GameController.js  Mediador host-autoritativo (sala, turnos, reinicio)
js/models/Card.js          Definición de carta y baraja
js/models/CardGameModel.js Lógica del juego (2-4 jugadores) y validación 4-4-3
js/network/PeerNetwork.js  Capa P2P (PeerJS), salas de hasta 4 jugadores
js/views/BoardView.js      Render de mesa, asientos, mano y zonas; orden manual
js/views/UIControlsView.js Overlay de sala de espera, modales y toasts (SweetAlert2)
js/views/AudioView.js      Efectos de sonido (Web Audio)
assets/                    Carpetas de recursos (cards, sounds, img)
```

## Cómo jugar en local

El juego usa módulos ES y PeerJS, por lo que no funciona con `file://`. Necesitas un servidor local:

```
npx serve .
```

Después abre `http://localhost:3000` en dos o más pestañas/navegadores distintos (o en dispositivos de la misma red), crea una sala y únete con el código. Para probar 3 o 4 jugadores, abre más pestañas y únete con el mismo código.

## Despliegue en GitHub Pages

1. Crea un repositorio en GitHub y súbelo (rama `main`).
2. En GitHub ve a **Settings → Pages**.
3. En **Source** selecciona `Deploy from a branch` y la rama `main` con carpeta `/ (root)`.
4. Guarda. El sitio quedará disponible en `https://<usuario>.github.io/<nombre-repo>/`.

> Nota: el anfitrión siempre genera un código con formato `443-XXXX`. Comparte ese código con quien vaya a unirse.