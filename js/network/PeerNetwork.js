const CLOUD_HOST = '0.peerjs.com';
const CLOUD_PORT = 443;
const CLOUD_PATH = '/';
const TIMEOUT_CONEXION = 25000;

export class PeerNetwork {
  constructor({ onMensaje, onConexion, onDesconexion, onError, onRechazo } = {}) {
    this.peer = null;
    this.conexiones = new Map();
    this.esHost = false;
    this.salaId = null;
    this.maxConexiones = 3; // invitados máximos (host + 3 = 4 jugadores)
    this.onMensaje = onMensaje || (() => {});
    this.onConexion = onConexion || (() => {});
    this.onDesconexion = onDesconexion || (() => {});
    this.onError = onError || (() => {});
    this.onRechazo = onRechazo || (() => {});
    // El host puede definir esto para responder consultas de estado (salas públicas).
    this.resolverEstadoSala = null;
  }

  crearSala(codigo, opciones = {}) {
    this.esHost = true;
    this.salaId = codigo;
    if (typeof opciones.maxConexiones === 'number') {
      this.maxConexiones = opciones.maxConexiones;
    }
    return new Promise((resolve, reject) => {
      let resuelto = false;
      const marcarResuelto = () => { resuelto = true; };

      this.peer = new Peer(codigo, {
        host: CLOUD_HOST,
        port: CLOUD_PORT,
        path: CLOUD_PATH,
        secure: true,
        debug: 1,
      });

      this.peer.on('open', (id) => {
        this.salaId = id;
        marcarResuelto();
        resolve(id);
      });

      this.peer.on('connection', (conn) => {
        this._registrarConexion(conn, false);
      });

      this._vincularErrores(reject, () => resuelto);
    });
  }

  unirse(codigo) {
    this.esHost = false;
    this.salaId = codigo;
    return new Promise((resolve, reject) => {
      let resuelto = false;
      const marcarResuelto = () => { resuelto = true; };

      this.peer = new Peer({
        host: CLOUD_HOST,
        port: CLOUD_PORT,
        path: CLOUD_PATH,
        secure: true,
        debug: 1,
      });

      this.peer.on('open', () => {
        const conn = this.peer.connect(codigo, {
          reliable: true,
          metadata: { rol: 'invitado' },
        });

        const temporizador = setTimeout(() => {
          reject(new Error('Tiempo de espera agotado al conectar con la sala.'));
        }, TIMEOUT_CONEXION);

        conn.on('open', () => {
          clearTimeout(temporizador);
          marcarResuelto();
          this._registrarConexion(conn, true);
          resolve();
        });

        conn.on('error', (err) => {
          clearTimeout(temporizador);
          if (!resuelto) {
            marcarResuelto();
            reject(err);
          } else {
            this.onError(err);
          }
        });
      });

      this._vincularErrores(reject, () => resuelto);
    });
  }

  get numeroConexiones() {
    return this.conexiones.size;
  }

  _registrarConexion(conn, yaAbierta) {
    const clave = conn.peer || `con-${Math.random().toString(36).slice(2, 8)}`;
    const meta = conn.metadata || {};

    // Conexión de CONSULTA (salas públicas): responder estado y cerrar sin ocupar cupo.
    if (meta.tipo === 'consulta') {
      const responder = () => {
        conn.on('data', (datos) => {
          if (!datos || datos.tipo !== 'consulta') return;
          const info = typeof this.resolverEstadoSala === 'function'
            ? this.resolverEstadoSala()
            : { cantidad: this.conexiones.size + 1, maxJugadores: this.maxConexiones + 1, enPartida: false };
          try {
            conn.send({
              tipo: 'status',
              cantidad: info.cantidad,
              maxJugadores: info.maxJugadores,
              enPartida: !!info.enPartida,
            });
          } catch (e) { /* ignorar */ }
          setTimeout(() => { try { conn.close(); } catch (e) { /* ignorar */ } }, 150);
        });
      };
      if (yaAbierta || conn.open) responder();
      else conn.on('open', responder);
      return;
    }

    // Control de capacidad en el host: rechazar si ya está lleno.
    if (this.esHost && this.conexiones.size >= this.maxConexiones) {
      const rechazar = () => {
        try {
          conn.send({ tipo: 'rechazado', razon: 'llena' });
        } catch (e) { /* ignorar */ }
        setTimeout(() => {
          try { conn.close(); } catch (e) { /* ignorar */ }
        }, 250);
      };
      if (yaAbierta || conn.open) rechazar();
      else conn.on('open', rechazar);
      this.onRechazo(conn, clave);
      return;
    }

    const vincular = () => {
      this.conexiones.set(clave, conn);
      conn.on('data', (datos) => this.onMensaje(datos, clave));
      conn.on('close', () => {
        this.conexiones.delete(clave);
        this.onDesconexion(clave);
      });
      conn.on('error', (err) => {
        this.conexiones.delete(clave);
        this.onError(err);
      });
      this.onConexion(conn, clave);
    };

    if (yaAbierta || conn.open) vincular();
    else conn.on('open', () => vincular());
  }

  _vincularErrores(rechazar, yaResuelto) {
    this.peer.on('error', (err) => {
      let mensaje = 'Error de red.';
      switch (err.type) {
        case 'unavailable-id':
          mensaje = 'El código de sala ya está en uso. Vuelve a intentarlo.';
          break;
        case 'peer-unavailable':
          mensaje = 'No se encontró ninguna sala con ese código.';
          break;
        case 'network':
        case 'socket-error':
        case 'server-error':
          mensaje = 'No se pudo conectar al servidor de señalización. Revisa tu conexión a internet.';
          break;
        case 'browser-incompatible':
          mensaje = 'Tu navegador no es compatible con WebRTC.';
          break;
        default:
          mensaje = err.message || mensaje;
      }
      if (rechazar && yaResuelto && !yaResuelto()) rechazar(new Error(mensaje));
      else this.onError(new Error(mensaje));
    });
  }

  enviar(datos) {
    for (const conn of this.conexiones.values()) {
      if (conn.open) conn.send(datos);
    }
  }

  enviarA(clave, datos) {
    const conn = this.conexiones.get(clave);
    if (conn && conn.open) conn.send(datos);
  }

  cerrarConexion(clave) {
    const conn = this.conexiones.get(clave);
    if (conn) {
      try { conn.close(); } catch (e) { /* ignorar */ }
    }
  }

  // Sondeo de ocupación de varias salas usando un único peer temporal.
  // Devuelve { [codigo]: { existe, cantidad, maxJugadores, enPartida } }.
  prospectarSalas(codigos, timeoutMs = 8000) {
    const lista = Array.isArray(codigos) ? codigos : [];
    return new Promise((resolve) => {
      const resultados = {};
      for (const c of lista) resultados[c] = { existe: false, cantidad: 0, maxJugadores: 0, enPartida: false, _listo: false };

      let pendientes = lista.length;
      let terminado = false;
      let peer = null;
      const conexiones = [];

      const finalizar = () => {
        if (terminado) return;
        terminado = true;
        clearTimeout(temporizador);
        for (const c of conexiones) { try { c.close(); } catch (e) { /* ignorar */ } }
        try { if (peer) peer.destroy(); } catch (e) { /* ignorar */ }
        const limpio = {};
        for (const c of lista) limpio[c] = { existe: resultados[c].existe, cantidad: resultados[c].cantidad, maxJugadores: resultados[c].maxJugadores, enPartida: resultados[c].enPartida };
        resolve(limpio);
      };

      const resolver = (codigo, valor) => {
        const actual = resultados[codigo];
        if (!actual || actual._listo) return;
        resultados[codigo] = { ...valor, _listo: true };
        pendientes -= 1;
        if (pendientes <= 0) finalizar();
      };

      const vacio = { existe: false, cantidad: 0, maxJugadores: 0, enPartida: false };
      const temporizador = setTimeout(finalizar, timeoutMs);

      if (lista.length === 0) { finalizar(); return; }

      try {
        peer = new Peer({ host: CLOUD_HOST, port: CLOUD_PORT, path: CLOUD_PATH, secure: true, debug: 0 });
      } catch (e) {
        finalizar();
        return;
      }

      peer.on('error', (err) => {
        const mensaje = (err && err.message) || '';
        const tokens = mensaje.split(/[\s,;.:]+/);
        for (const c of lista) {
          if (tokens.includes(c)) resolver(c, vacio);
        }
      });

      peer.on('open', () => {
        for (const codigo of lista) {
          let conn;
          try {
            conn = peer.connect(codigo, { reliable: true, metadata: { tipo: 'consulta' } });
          } catch (e) {
            resolver(codigo, vacio);
            continue;
          }
          conexiones.push(conn);
          conn.on('open', () => { try { conn.send({ tipo: 'consulta' }); } catch (e) { /* ignorar */ } });
          conn.on('data', (datos) => {
            if (datos && datos.tipo === 'status') {
              resolver(codigo, {
                existe: true,
                cantidad: datos.cantidad || 1,
                maxJugadores: datos.maxJugadores || 4,
                enPartida: !!datos.enPartida,
              });
            }
          });
          conn.on('error', () => resolver(codigo, vacio));
        }
      });
    });
  }

  cerrar() {
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) { /* ignorar */ }
    }
    this.peer = null;
    this.conexiones.clear();
  }
}
