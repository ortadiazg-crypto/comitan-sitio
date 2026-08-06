// ---------------------------------------------------------
// Mapa interactivo: marcadores clicables sobre img/mapa-comitan.svg
//
// El SVG del mapa no trae ninguna etiqueta que diga "este ícono
// es tal lugar", así que las posiciones se guardan aparte, en
// data/puntos-mapa.json, como porcentajes (x%, y%) del tamaño
// de la imagen. Eso permite que el marcador quede bien puesto
// aunque el mapa se vea más grande o más chico según la pantalla.
//
// Flujo:
//  1) Modo normal: se leen los puntos guardados y se pintan como
//     botones invisibles sobre el mapa; al dar clic muestran la
//     ficha del lugar (tomada de Lugares.json).
//  2) Modo edición: cada clic sobre el mapa abre un formulario
//     para elegir a qué lugar corresponde ese punto. Se puede
//     descargar el resultado y reemplazar data/puntos-mapa.json.
//  3) Cada tarjeta del buscador (script.js) muestra un botón
//     "Ver en el mapa" si ese lugar ya tiene posición guardada;
//     al presionarlo, se abre su ficha directo sobre el mapa.
// ---------------------------------------------------------

const RUTA_LUGARES = 'data/Lugares.json';
const RUTA_PUNTOS = 'data/puntos-mapa.json';

let lugaresPorId = {};
let categoriasPorId = {};
let puntos = [];
let modoEdicion = false;
let clicPendiente = null;

const imagenMapa = document.getElementById('imagenMapa');
const capaMarcadores = document.getElementById('capaMarcadores');
const mapaWrap = document.getElementById('mapaWrap');
const popupLugar = document.getElementById('popupLugar');
const btnModoEdicion = document.getElementById('btnModoEdicion');
const avisoEdicion = document.getElementById('avisoEdicion');
const avisoVacio = document.getElementById('avisoVacio');
const formAsignar = document.getElementById('formAsignar');
const selectLugar = document.getElementById('selectLugar');

async function cargarJSON(ruta, valorPorDefecto) {
  try {
    const respuesta = await fetch(ruta);
    if (!respuesta.ok) throw new Error('No se pudo leer ' + ruta);
    return await respuesta.json();
  } catch (error) {
    console.warn('Aviso al leer ' + ruta + ':', error.message);
    return valorPorDefecto;
  }
}

function indexarLugares(grupos) {
  grupos.forEach(grupo => {
    grupo.lugares.forEach(lugar => {
      lugaresPorId[lugar.id] = lugar;
      categoriasPorId[lugar.id] = grupo;
    });
  });
}

function llenarSelectorLugares() {
  selectLugar.innerHTML = '<option value="">— Elige un lugar —</option>';
  Object.values(lugaresPorId)
    .sort((a, b) => a.id - b.id)
    .forEach(lugar => {
      const cat = categoriasPorId[lugar.id];
      const yaUbicado = puntos.some(p => p.id === lugar.id);
      const opcion = document.createElement('option');
      opcion.value = lugar.id;
      opcion.textContent = `#${lugar.id} · ${lugar.nombre}${yaUbicado ? ' (ya ubicado, se moverá)' : ''} — ${cat.categoria}`;
      selectLugar.appendChild(opcion);
    });
}

function pintarMarcadores() {
  capaMarcadores.innerHTML = '';
  puntos.forEach(punto => {
    const lugar = lugaresPorId[punto.id];
    if (!lugar) return;
    const cat = categoriasPorId[punto.id];

    const marcador = document.createElement('button');
    marcador.type = 'button';
    marcador.className = 'marcador-mapa';
    marcador.style.left = punto.x + '%';
    marcador.style.top = punto.y + '%';
    marcador.style.setProperty('--color-marcador', cat.color);
    marcador.title = lugar.nombre;
    marcador.setAttribute('aria-label', lugar.nombre);
    marcador.dataset.id = punto.id;

    marcador.addEventListener('click', evento => {
      evento.stopPropagation();
      if (modoEdicion) {
        abrirFormAsignar(punto.x, punto.y, punto.id);
      } else {
        mostrarPopup(lugar, cat, marcador);
      }
    });

    capaMarcadores.appendChild(marcador);
  });

  // Actualiza el set global que usa script.js para saber a qué
  // tarjetas ponerles el botón "Ver en el mapa", y repinta.
  window.lugaresEnMapa = new Set(puntos.map(p => p.id));
  if (typeof window.repintarTarjetas === 'function') {
    window.repintarTarjetas();
  }
}

function mostrarPopup(lugar, cat, marcadorEl) {
  popupLugar.innerHTML = `
    <button class="popup-cerrar" type="button" aria-label="Cerrar">✕</button>
    <span class="popup-categoria" style="background:${cat.color}">${cat.categoria}</span>
    <h3>${lugar.nombre}</h3>
    <p>📍 ${lugar.direccion}</p>
    <span class="popup-id">#${lugar.id}</span>
  `;

  const rectMapa = mapaWrap.getBoundingClientRect();
  const rectMarcador = marcadorEl.getBoundingClientRect();
  popupLugar.hidden = false;

  const anchoPopup = popupLugar.offsetWidth;
  let left = rectMarcador.left - rectMapa.left + 18;
  if (rectMarcador.left - rectMapa.left + anchoPopup + 18 > rectMapa.width) {
    left = rectMarcador.left - rectMapa.left - anchoPopup - 18;
  }
  const top = Math.max(0, rectMarcador.top - rectMapa.top - 10);

  popupLugar.style.left = left + 'px';
  popupLugar.style.top = top + 'px';

  popupLugar.querySelector('.popup-cerrar').addEventListener('click', cerrarPopup);
}

function cerrarPopup() {
  popupLugar.hidden = true;
}

function abrirFormAsignar(xPorc, yPorc, idExistente) {
  clicPendiente = { x: xPorc, y: yPorc, idExistente: idExistente || null };
  llenarSelectorLugares();
  if (idExistente) selectLugar.value = idExistente;

  formAsignar.hidden = false;
  const rectMapa = mapaWrap.getBoundingClientRect();
  const left = Math.min(
    (xPorc / 100) * rectMapa.width + 16,
    rectMapa.width - formAsignar.offsetWidth - 8
  );
  const top = (yPorc / 100) * rectMapa.height;
  formAsignar.style.left = Math.max(8, left) + 'px';
  formAsignar.style.top = Math.max(8, top) + 'px';
  selectLugar.focus();
}

function cerrarFormAsignar() {
  formAsignar.hidden = true;
  clicPendiente = null;
}

function guardarAsignacion() {
  if (!clicPendiente) return;
  const idElegido = Number(selectLugar.value);
  if (!idElegido) {
    cerrarFormAsignar();
    return;
  }

  const existente = puntos.find(p => p.id === idElegido);
  if (existente) {
    existente.x = clicPendiente.x;
    existente.y = clicPendiente.y;
  } else {
    puntos.push({ id: idElegido, x: clicPendiente.x, y: clicPendiente.y });
  }

  cerrarFormAsignar();
  pintarMarcadores();
}

function alternarModoEdicion() {
  modoEdicion = !modoEdicion;
  btnModoEdicion.setAttribute('aria-pressed', String(modoEdicion));
  btnModoEdicion.textContent = modoEdicion ? '✅ Salir del modo edición' : '✏️ Ubicar lugares en el mapa';
  avisoEdicion.hidden = !modoEdicion;
  if (modoEdicion) avisoVacio.hidden = true;
  mapaWrap.classList.toggle('modo-edicion', modoEdicion);
  cerrarPopup();
  cerrarFormAsignar();
}

function descargarPuntos() {
  const contenido = JSON.stringify(puntos, null, 2);
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'puntos-mapa.json';
  enlace.click();
  URL.revokeObjectURL(url);
}

// Llamado desde el botón "📌 Ver en el mapa" de cada tarjeta (script.js)
window.mostrarLugarEnMapa = function (id) {
  const punto = puntos.find(p => p.id === id);
  const lugar = lugaresPorId[id];
  const cat = categoriasPorId[id];
  if (!punto || !lugar) return;

  document.getElementById('mapaWrap').scrollIntoView({ behavior: 'smooth', block: 'center' });

  const marcador = capaMarcadores.querySelector(`.marcador-mapa[data-id="${id}"]`);
  if (marcador) {
    setTimeout(() => {
      marcador.classList.add('marcador-resaltado');
      mostrarPopup(lugar, cat, marcador);
      setTimeout(() => marcador.classList.remove('marcador-resaltado'), 1800);
    }, 350);
  }
};

function iniciarInteractividad() {
  mapaWrap.addEventListener('click', evento => {
    if (!modoEdicion) return;
    if (evento.target.closest('.marcador-mapa')) return;
    const rect = imagenMapa.getBoundingClientRect();
    const x = ((evento.clientX - rect.left) / rect.width) * 100;
    const y = ((evento.clientY - rect.top) / rect.height) * 100;
    abrirFormAsignar(x, y, null);
  });

  btnModoEdicion.addEventListener('click', alternarModoEdicion);
  document.getElementById('btnDescargarPuntos').addEventListener('click', descargarPuntos);
  document.getElementById('btnConfirmarAsignar').addEventListener('click', guardarAsignacion);
  document.getElementById('btnCancelarAsignar').addEventListener('click', cerrarFormAsignar);

  document.addEventListener('click', evento => {
    if (!popupLugar.hidden && !popupLugar.contains(evento.target) && !evento.target.closest('.marcador-mapa')) {
      cerrarPopup();
    }
  });

  document.addEventListener('keydown', evento => {
    if (evento.key === 'Escape') {
      cerrarPopup();
      cerrarFormAsignar();
    }
  });
}

async function iniciarMapa() {
  // Si script.js ya cargó Lugares.json, lo reusamos en vez de pedirlo dos veces.
  const datosLugares = window.datosLugares || await cargarJSON(RUTA_LUGARES, []);
  const datosPuntos = await cargarJSON(RUTA_PUNTOS, []);

  indexarLugares(datosLugares);
  puntos = datosPuntos;

  pintarMarcadores();
  iniciarInteractividad();

  if (puntos.length === 0) {
    avisoVacio.hidden = false;
  }
}

if (imagenMapa.complete) {
  iniciarMapa();
} else {
  imagenMapa.addEventListener('load', iniciarMapa);
}
