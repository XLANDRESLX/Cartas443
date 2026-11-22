# Cartas 4-4-3

Juego de cartas colombiano **4-4-3** multijugador en línea (P2P vía WebRTC con PeerJS). Proyecto de la Electiva de Profundización, Unicaribe, Ciénaga (Magdalena).

## ¿Cómo se juega?

- Cada jugador recibe **10 cartas**. El mazo tiene **104 cartas** (2 copias de cada una de las 52 cartas: 4 palos × 13 valores). El resto forma el mazo y se voltea una carta al descarte.
- El turno inicial se elige al azar. Se juega por turnos entre **2 y 4 jugadores**.
- En tu turno debes **robar 1 carta** (del mazo o del pozo de descarte), quedando con **11 cartas**.
- Con tus 11 cartas debes formar un **4-4-3**: tres grupos **de 4, 4 y 3 cartas del mismo número** (en cualquier orden: 4-4-3, 4-3-4 o 3-4-4). El **palo** (♠ ♥ ♦ ♣) **no importa**.
- Organiza tu mano a gusto: **arrastra las cartas** para reordenarlas (mouse y pantalla táctil con Pointer Events), haz **clic/toque** para seleccionar, o usa las herramientas **🔢 Valor**, **♠️ Palo**, **♠️🔢 Ambos** y **↩️ Deshacer**. Este orden es **privado** (solo tú lo ves) y se guarda en el dispositivo.
- Si logras armar las 3 combinaciones presiona **👑 Cantar 4-4-3** y ganas la partida.
- Si no puedes, **bota 1 carta** al descarte y cede el turno.
- Si el mazo y el descarte se agotan sin que nadie cante, la partida termina en **empate** y se reparte de nuevo.
- El anfitrión es **host-autoritativo**: solo el host valida el tablero; cada invitado envía sus acciones y recibe un estado personalizado (su mano, y solo los conteos de los demás).

## Interfaz

La aplicación es una **SPA por hash** (`#/inicio`, `#/salas`, `#/sala`, `#/partida`, …). Cambiar de apartado **no recarga la página**, de modo que la conexión WebRTC sigue viva. Si visitas Perfil, Reglas o Ajustes durante una partida, aparece un botón **← Volver a la sala** para regresar sin reconectar.

- **Inicio cinematográfico**: bosque de atardecer en SVG de elaboración propia, menú lateral dorado con pincelada en la opción activa, nombre y avatar en la cabecera.
- **Salas**: recientes de este dispositivo + 15 salas públicas con sondeo de ocupación.
- **Sala de espera**: panel verde oscuro con detalles dorados, cuatro espacios (avatar, nombre y estado), corona para el anfitrión, código copiable y botones de iniciar/abandonar.
- **Mesa**: tapete circular rojizo/verde con los cuatro asientos (local abajo, demás arriba/izquierda/derecha), mazo y descarte centrales, indicador de turno, cartas grandes con palo diferenciado y chat flotante.

El perfil (nombre y avatar) se guarda en `localStorage` bajo `nombre-jugador-443` y `avatar-jugador-443`, y se aplica al crear o unirse a una sala. Ajustes permite silenciar sonido y reducir animaciones; ambas preferencias se guardan localmente.

## Salas y lobby

- **Jugar** crea al instante una sala privada con código `443-XXXX` usando tu perfil guardado.
- **Crear partida** abre un formulario donde puedes darle un nombre a la sala (solo visible en este dispositivo) antes de crearla.
- **Unirse a partida** permite pegar el código que compartió el anfitrión.
- **Salas** muestra las **salas recientes de este dispositivo**, con opción de copiar código, entrar o eliminar.
- **Salas públicas**: hay **15 salas fijas** con códigos predefinidos `sala-publica-1` … `sala-publica-15`. Al abrir **Salas**, la app **sondea la ocupación** de cada una usando una conexión ligera de consulta; el anfitrión responde su estado sin consumir cupo. Con **↻ Ver ocupación** se actualiza el listado.
- Entrar a una sala pública te une si ya hay anfitrión; si está vacía, tú la abres con ese código. Los botones se deshabilitan si la sala está **llena** (4/4) o con **partida en curso**.
- El aforo es de **4 jugadores**; las conexiones extra se rechazan automáticamente.

## Conexión, reconexión y salir

- **Reanudar sesión**: si recargas la página, la partida se restaura automáticamente durante **5 minutos**. El anfitrión recupera su sala y los invitados se reconectan sin perder su mano.
- **Anfitrión que se cae**: los invitados reintentan reconectar; si no vuelve en **15 segundos**, el invitado de menor número **asume como nuevo anfitrión** y la partida continúa.
- **Jugador desconectado**: aparece el aviso «{nombre} se desconectó» con una espera de 15 s; si no vuelve, sale de la partida y los números restantes se reasignan.
- **Salir de la partida**: el botón **← Salir** de la mesa (o **Abandonar sala** en el lobby) pide confirmación, avisa a los demás y devuelve al inicio.

## Tecnologías

- Vanilla JavaScript (ES Modules), arquitectura MVC y router propio sin dependencias.
- CSS modular (`css/variables.css`, `base.css`, `components.css`, `home.css`, `lobby.css`, `game.css`, `responsive.css`) agregado en `css/styles.css`. Sin Tailwind.
- **PeerJS** para P2P WebRTC (nube pública `0.peerjs.com`).
- SweetAlert2 para modales y canvas-confetti para la victoria.
- Efectos de sonido generados con Web Audio API (sin archivos externos).
- PWA instalable: `manifest.json` + `sw.js` con caché del "shell" de la interfaz.
- Fondo y cartas dibujados con SVG/CSS (sin imágenes externas).

## Estructura

```
index.html                       Shell SPA: cabecera y todas las vistas
manifest.json / sw.js            PWA (instalación y caché de interfaz)
css/styles.css                   Agregador de los módulos CSS
css/variables.css                Paleta, tipografía y variables de seguridad
css/base.css                     Reset, cabecera, pantallas y componentes base
css/components.css               Botones, campos, tarjetas y chips
css/home.css                     Menú cinematográfico
css/lobby.css                    Salas, sala de espera, perfil y paneles
css/game.css                     Mesa, cartas, mano y chat
css/responsive.css               Vertical/horizontal, tablet, PC y movimiento reducido
js/main.js                       Arranque, router, hooks, menú y sesión
js/router.js                     Navegación hash con guardia de salida
js/controllers/GameController.js Mediador host-autoritativo (sin cambios de protocolo)
js/controllers/ChatController.js Chat P2P con validación y anti-spam
js/models/Card.js                Carta y baraja (104 cartas)
js/models/CardGameModel.js       Reglas, validación 4-4-3 y serialización
js/network/PeerNetwork.js        Capa P2P (PeerJS)
js/views/BoardView.js            Mesa, asientos, mano, arrastre con Pointer Events
js/views/UIControlsView.js       Sala de espera, modales y toasts
js/views/ChatView.js             Widget de chat flotante
js/views/LobbyView.js            Recientes y salas públicas
js/views/ProfileView.js          Nombre y avatar locales
js/views/PanelView.js            Ajustes y preferencias
js/views/AudioView.js            Efectos de sonido (Web Audio)
js/utils/storage.js / dom.js     Persistencia y utilidades ligeras
assets/backgrounds/              Bosque de atardecer (SVG)
assets/img/icono-443.svg         Icono PWA
```

## Cómo jugar en local

El juego usa módulos ES y PeerJS, por lo que no funciona con `file://`. Necesitas un servidor local:

```
python3 -m http.server 8000
```

Después abre `http://localhost:8000` en dos o más pestañas/navegadores distintos, crea una sala y únete con el código. Para probar con 3 o 4 jugadores, abre más pestañas y únete con el mismo código.

## Despliegue en GitHub Pages

1. Sube el proyecto a la rama `main`.
2. En GitHub ve a **Settings → Pages**.
3. En **Source** selecciona `Deploy from a branch`, rama `main`, carpeta `/ (root)`.
4. Guarda. El sitio quedará en `https://<usuario>.github.io/<nombre-repo>/`.

> Nota: para que el service worker funcione, el sitio debe servirse por HTTPS (GitHub Pages lo proporciona). El anfitrión siempre genera códigos `443-XXXX`.
