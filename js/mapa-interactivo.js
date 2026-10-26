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
//     para elegir a qué lugar corresponde ese punto. Antes de
//     mostrar el formulario, se lee el color del ícono bajo el
//     clic (usando un <canvas> oculto) y se intenta adivinar el
//     lugar automáticamente: si ese color exacto ya se usó antes
//     en otro punto guardado, se preselecciona ese mismo lugar;
//     si no, se acorta la lista a la categoría cuyo color se
//     parece más. Siempre se puede corregir a mano antes de
//     guardar. Al terminar, se puede descargar el resultado y
//     reemplazar data/puntos-mapa.json.
//  3) Cada tarjeta del buscador (script.js) muestra un botón
//     "Ver en el mapa" si ese lugar ya tiene posición guardada;
//     al presionarlo, se abre su ficha directo sobre el mapa.
// ---------------------------------------------------------

const RUTA_LUGARES = 'data/Lugares.json';
const RUTA_PUNTOS = 'data/puntos-mapa.json';

// El SVG del mapa mide 785x614 según su viewBox original (antes de
// que index.html lo estire con CSS). Usamos esas medidas para dibujar
// el mapa en un canvas oculto y así "leer" de qué color es el pixel
// exacto donde alguien dio clic, sin importar el tamaño en pantalla.
const VIEWBOX_ANCHO = 785;
const VIEWBOX_ALTO = 614;
// Qué tan parecido debe ser un color al de una categoría para confiar
// en la sugerencia (0 = idéntico, más alto = más tolerante). Si el
// clic cayó sobre una calle o una manzana, no habrá ninguna categoría
// razonablemente cercana y no se sugiere nada.
const TOLERANCIA_COLOR = 90;

let lugaresPorId = {};
let categoriasPorId = {};
let gruposLugares = [];
let puntos = [];
let modoEdicion = false;
let clicPendiente = null;
let lienzoColorCtx = null;

const imagenMapa = document.getElementById('imagenMapa');
const capaMarcadores = document.getElementById('capaMarcadores');
const mapaWrap = document.getElementById('mapaWrap');
const popupLugar = document.getElementById('popupLugar');
const btnModoEdicion = document.getElementById('btnModoEdicion');
const avisoEdicion = document.getElementById('avisoEdicion');
const avisoVacio = document.getElementById('avisoVacio');
const formAsignar = document.getElementById('formAsignar');
const selectLugar = document.getElementById('selectLugar');
const colorDetectado = document.getElementById('colorDetectado');

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
  gruposLugares = grupos;
  grupos.forEach(grupo => {
    grupo.lugares.forEach(lugar => {
      lugaresPorId[lugar.id] = lugar;
      categoriasPorId[lugar.id] = grupo;
    });
  });
}

// ---------------------------------------------------------
// Detección automática por color del ícono.
//
// El SVG se carga como <img>, así que no podemos "ver" sus
// elementos internos desde JavaScript. Lo que sí podemos hacer
// es dibujar esa imagen una sola vez sobre un <canvas> oculto y
// leer ahí el color del pixel exacto donde el usuario dio clic.
//
// OJO: en el mapa impreso cada LUGAR tiene su propio color de
// ícono (no es "un color por categoría", son ~20 colores
// distintos, uno por ícono). Por eso la detección funciona en
// dos niveles:
//
//  1) Color exacto ya conocido: si ya ubicaste antes un lugar y
//     quedó guardado con su color en puntos-mapa.json, y ahora
//     das clic en un ícono del MISMO color exacto, el sistema
//     reconoce que es ese mismo lugar y lo preselecciona listo
//     para guardar. Esto se vuelve más certero entre más lugares
//     vayas marcando.
//  2) Si el color no coincide con ninguno ya conocido, se hace
//     una comparación más floja contra los 4 colores de
//     categoría de Lugares.json, solo para acortar la lista del
//     selector (no para adivinar el lugar exacto).
// ---------------------------------------------------------
const TOLERANCIA_COLOR_EXACTO = 18; // qué tan idéntico debe ser el color para reconocer el MISMO lugar

function prepararLienzoColor() {
  const canvas = document.createElement('canvas');
  canvas.width = VIEWBOX_ANCHO;
  canvas.height = VIEWBOX_ALTO;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  try {
    ctx.drawImage(imagenMapa, 0, 0, VIEWBOX_ANCHO, VIEWBOX_ALTO);
    lienzoColorCtx = ctx;
  } catch (error) {
    // Si el sitio se abrió con doble clic (protocolo file://) el
    // navegador puede bloquear la lectura de pixeles por seguridad.
    // No es grave: simplemente no habrá sugerencia automática y el
    // selector se comporta como antes, mostrando todos los lugares.
    console.warn('No se pudo leer el color del mapa (¿se abrió con doble clic en vez de con un servidor?):', error.message);
    lienzoColorCtx = null;
  }
}

function hexARgb(hex) {
  const limpio = hex.replace('#', '');
  const numero = parseInt(limpio, 16);
  return { r: (numero >> 16) & 255, g: (numero >> 8) & 255, b: numero & 255 };
}

function rgbAHex({ r, g, b }) {
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

function distanciaColor(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function colorEnPorcentaje(xPorc, yPorc) {
  if (!lienzoColorCtx) return null;
  const px = Math.min(Math.max(Math.round((xPorc / 100) * VIEWBOX_ANCHO), 0), VIEWBOX_ANCHO - 1);
  const py = Math.min(Math.max(Math.round((yPorc / 100) * VIEWBOX_ALTO), 0), VIEWBOX_ALTO - 1);
  try {
    const [r, g, b, alfa] = lienzoColorCtx.getImageData(px, py, 1, 1).data;
    if (alfa < 50) return null; // pixel transparente: no cayó sobre ningún ícono
    return { r, g, b };
  } catch (error) {
    return null;
  }
}

// Nivel 1: ¿este color ya lo vimos antes en otro punto guardado?
function lugarPorColorExacto(rgb) {
  let mejorPunto = null;
  let menorDistancia = Infinity;
  puntos.forEach(punto => {
    if (!punto.color) return;
    const distancia = distanciaColor(rgb, hexARgb(punto.color));
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      mejorPunto = punto;
    }
  });
  if (!mejorPunto || menorDistancia >= TOLERANCIA_COLOR_EXACTO) return null;
  return lugaresPorId[mejorPunto.id] || null;
}

// Nivel 2: respaldo más flojo contra los 4 colores de categoría.
function grupoMasParecidoPorColor(rgb) {
  let mejorGrupo = null;
  let menorDistancia = Infinity;
  gruposLugares.forEach(grupo => {
    const distancia = distanciaColor(rgb, hexARgb(grupo.color));
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      mejorGrupo = grupo;
    }
  });
  return menorDistancia < TOLERANCIA_COLOR ? mejorGrupo : null;
}

function llenarSelectorLugares(grupoFiltro) {
  selectLugar.innerHTML = '<option value="">— Elige un lugar —</option>';
  Object.values(lugaresPorId)
    .sort((a, b) => a.id - b.id)
    .filter(lugar => !grupoFiltro || categoriasPorId[lugar.id].id === grupoFiltro.id)
    .forEach(lugar => {
      const cat = categoriasPorId[lugar.id];
      const yaUbicado = puntos.some(p => p.id === lugar.id);
      const opcion = document.createElement('option');
      opcion.value = lugar.id;
      opcion.textContent = grupoFiltro
        ? `#${lugar.id} · ${lugar.nombre}${yaUbicado ? ' (ya ubicado, se moverá)' : ''}`
        : `#${lugar.id} · ${lugar.nombre}${yaUbicado ? ' (ya ubicado, se moverá)' : ''} — ${cat.categoria}`;
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
  const rgbClic = idExistente ? null : colorEnPorcentaje(xPorc, yPorc);
  clicPendiente = {
    x: xPorc,
    y: yPorc,
    idExistente: idExistente || null,
    color: rgbClic ? rgbAHex(rgbClic) : null
  };

  let lugarExacto = null;
  let grupoSugerido = null;
  if (rgbClic) {
    lugarExacto = lugarPorColorExacto(rgbClic);
    if (!lugarExacto) grupoSugerido = grupoMasParecidoPorColor(rgbClic);
  }

  llenarSelectorLugares(grupoSugerido);
  if (idExistente) {
    selectLugar.value = idExistente;
  } else if (lugarExacto) {
    selectLugar.value = lugarExacto.id;
  }

  if (lugarExacto) {
    colorDetectado.hidden = false;
    colorDetectado.innerHTML = `🎯 Este ícono es del mismo color que <strong>${lugarExacto.nombre}</strong>, ya lo dejé seleccionado — nada más confirma que sea correcto.`;
  } else if (grupoSugerido) {
    colorDetectado.hidden = false;
    colorDetectado.innerHTML = `🎨 Por el color, podría ser de <strong>${grupoSugerido.categoria}</strong> — te muestro solo esos lugares. <button type="button" id="btnVerTodosLugares">Ver todos</button>`;
    document.getElementById('btnVerTodosLugares').addEventListener('click', () => {
      llenarSelectorLugares(null);
      colorDetectado.hidden = true;
    });
  } else {
    colorDetectado.hidden = true;
  }

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
  colorDetectado.hidden = true;
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
    if (clicPendiente.color) existente.color = clicPendiente.color;
  } else {
    const nuevoPunto = { id: idElegido, x: clicPendiente.x, y: clicPendiente.y };
    if (clicPendiente.color) nuevoPunto.color = clicPendiente.color;
    puntos.push(nuevoPunto);
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

  prepararLienzoColor();
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
