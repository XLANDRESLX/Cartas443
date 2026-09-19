const CLOUD_HOST = '0.peerjs.com';
const CLOUD_PORT = 443;
const CLOUD_PATH = '/';
const TIMEOUT_CONEXION = 25000;

export class PeerNetwork {
  constructor({ onMensaje, onConexion, onDesconexion, onError }) {
    this.peer = null;
    this.conexiones = new Map();
    this.esHost = false;
    this.salaId = null;
    this.onMensaje = onMensaje;
    this.onConexion = onConexion;
    this.onDesconexion = onDesconexion;
    this.onError = onError;
  }

  crearSala(codigo) {
    this.esHost = true;
    this.salaId = codigo;
    return new Promise((resolve, reject) => {
      let resuelto = false;
      const marcarResuelto = () => {
        resuelto = true;
      };
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
      const marcarResuelto = () => {
        resuelto = true;
      };
      this.peer = new Peer({
        host: CLOUD_HOST,
        port: CLOUD_PORT,
        path: CLOUD_PATH,
        secure: true,
        debug: 1,
      });

      this.peer.on('open', (miId) => {
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
          this.onError(err);
        });
      });

      this._vincularErrores(reject, () => resuelto);
    });
  }

  _registrarConexion(conn, yaAbierta) {
    const clave = conn.peer || `con-${Math.random().toString(36).slice(2, 8)}`;
    const vincular = () => {
      this.conexiones.set(clave, conn);
      conn.on('data', (datos) => {
        this.onMensaje(datos, clave);
      });
      conn.on('close', () => {
        this.conexiones.delete(clave);
        this.onDesconexion(clave);
      });
      conn.on('error', (err) => {
        this.conexiones.delete(clave);
        this.onError(err);
      });
      this.onConexion(conn);
    };

    if (yaAbierta || conn.open) {
      vincular();
    } else {
      conn.on('open', () => vincular());
    }
  }

  _claveConexion(conn) {
    return conn.peer || `con-${Math.random().toString(36).slice(2, 8)}`;
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
      else if (this.onError) this.onError(new Error(mensaje));
    });
  }

  enviar(datos) {
    for (const conn of this.conexiones.values()) {
      if (conn.open) conn.send(datos);
    }
  }

  enviarA(conn, datos) {
    if (conn && conn.open) conn.send(datos);
  }

  cerrar() {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) { /* ignorar */ }
    }
    this.peer = null;
    this.conexiones.clear();
  }
}