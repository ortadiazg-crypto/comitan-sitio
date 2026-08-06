// ---------------------------------------------------------
// Carga de datos: pide el archivo por su ruta (data/Lugares.json).
// Esto funciona porque el sitio corre servido por GitHub Pages
// (o un servidor local tipo Live Server / XAMPP). Si algún día
// abres index.html con doble clic desde tu computadora, el
// navegador bloqueará esta petición por seguridad — muestra el
// aviso de más abajo en ese caso.
// ---------------------------------------------------------
const RUTA_DATOS = 'data/Lugares.json';

async function cargarDatos() {
  const respuesta = await fetch(RUTA_DATOS);
  if (!respuesta.ok) throw new Error('No se pudo leer ' + RUTA_DATOS);
  return await respuesta.json();
}

const ICONOS = {
  'Tienda y Módulo Turístico': '🛍️',
  'Arquitectura Religiosa': '⛪',
  'Centros Culturales y Museos': '🏛️',
  'Mercado y Artesanías': '🧺',
  'Transporte Público': '🚌'
};

// Se llena en mapa-interactivo.js con los ids que sí tienen
// posición marcada en el mapa, para saber a quién mostrarle
// el botón "Ver en el mapa". Ver window.lugaresEnMapa más abajo.
window.lugaresEnMapa = window.lugaresEnMapa || new Set();

function crearTarjeta(lugar, color) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-lugar';
  tarjeta.style.borderLeftColor = color;
  tarjeta.innerHTML = `
    <span class="tarjeta-id">#${lugar.id}</span>
    <h3>${lugar.nombre}</h3>
    <p>📍 ${lugar.direccion}</p>
  `;

  if (window.lugaresEnMapa.has(lugar.id)) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'boton-ver-mapa';
    boton.textContent = '📌 Ver en el mapa';
    boton.addEventListener('click', () => {
      if (typeof window.mostrarLugarEnMapa === 'function') {
        window.mostrarLugarEnMapa(lugar.id);
      }
    });
    tarjeta.appendChild(boton);
  }

  return tarjeta;
}

function crearSeccion(grupo) {
  const seccion = document.createElement('section');
  seccion.className = 'seccion-categoria';
  seccion.id = 'cat-' + grupo.id;
  seccion.dataset.categoria = grupo.categoria;

  const titulo = document.createElement('h2');
  titulo.className = 'titulo-categoria';
  titulo.style.backgroundColor = grupo.color;
  titulo.innerHTML = `
    <span class="titulo-icono">${ICONOS[grupo.categoria] || '📌'}</span>
    <span>${grupo.categoria}</span>
    <span class="titulo-contador">${grupo.lugares.length}</span>
  `;
  seccion.appendChild(titulo);

  const gridLugares = document.createElement('div');
  gridLugares.className = 'lista-lugares';
  grupo.lugares.forEach(lugar => gridLugares.appendChild(crearTarjeta(lugar, grupo.color)));
  seccion.appendChild(gridLugares);

  return seccion;
}

function crearFiltros(datos, onFiltrar) {
  const contenedor = document.getElementById('filtros');
  const total = datos.reduce((acc, g) => acc + g.lugares.length, 0);

  const botonTodos = document.createElement('button');
  botonTodos.className = 'chip activo';
  botonTodos.textContent = `Todos (${total})`;
  botonTodos.dataset.categoria = 'todos';
  contenedor.appendChild(botonTodos);

  datos.forEach(grupo => {
    const boton = document.createElement('button');
    boton.className = 'chip';
    boton.style.setProperty('--chip-color', grupo.color);
    boton.textContent = `${ICONOS[grupo.categoria] || ''} ${grupo.categoria} (${grupo.lugares.length})`;
    boton.dataset.categoria = grupo.categoria;
    contenedor.appendChild(boton);
  });

  contenedor.addEventListener('click', e => {
    const boton = e.target.closest('.chip');
    if (!boton) return;
    contenedor.querySelectorAll('.chip').forEach(b => b.classList.remove('activo'));
    boton.classList.add('activo');
    onFiltrar(boton.dataset.categoria);
  });
}

function mostrarErrorCarga() {
  const contenedor = document.getElementById('app');
  contenedor.innerHTML = `
    <div class="aviso-error">
      <p><strong>No se pudo cargar data/Lugares.json.</strong></p>
      <p>Esto pasa cuando abres <code>index.html</code> directo con doble clic:
      el navegador bloquea que un archivo local lea otro archivo local por seguridad.</p>
      <p>Si esto lo ves en GitHub Pages, revisa que la carpeta se llame exactamente
      <code>datos</code> (minúsculas) y el archivo <code>Lugares.json</code> con esa
      capitalización exacta — GitHub Pages distingue mayúsculas de minúsculas.</p>
    </div>
  `;
}

async function iniciar() {
  let datos;
  try {
    datos = await cargarDatos();
  } catch (error) {
    console.error(error);
    mostrarErrorCarga();
    return;
  }

  window.datosLugares = datos; // lo usa mapa-interactivo.js

  const contenedor = document.getElementById('app');
  const sinResultados = document.getElementById('sinResultados');
  const buscador = document.getElementById('buscador');

  function pintarTarjetas() {
    contenedor.innerHTML = '';
    datos.forEach(grupo => contenedor.appendChild(crearSeccion(grupo)));
  }

  pintarTarjetas();
  window.repintarTarjetas = pintarTarjetas; // para refrescar botones "Ver en el mapa"

  let categoriaActiva = 'todos';

  function aplicarFiltros() {
    const texto = buscador.value.trim().toLowerCase();
    let algunoVisible = false;

    datos.forEach(grupo => {
      const seccion = document.getElementById('cat-' + grupo.id);
      const coincideCategoria = categoriaActiva === 'todos' || categoriaActiva === grupo.categoria;

      let lugaresVisiblesEnGrupo = 0;
      seccion.querySelectorAll('.tarjeta-lugar').forEach((tarjeta, i) => {
        const lugar = grupo.lugares[i];
        const coincideTexto = !texto ||
          lugar.nombre.toLowerCase().includes(texto) ||
          lugar.direccion.toLowerCase().includes(texto);
        const visible = coincideCategoria && coincideTexto;
        tarjeta.hidden = !visible;
        if (visible) { lugaresVisiblesEnGrupo++; algunoVisible = true; }
      });

      seccion.hidden = lugaresVisiblesEnGrupo === 0;
    });

    sinResultados.hidden = algunoVisible;
  }

  crearFiltros(datos, categoria => {
    categoriaActiva = categoria;
    aplicarFiltros();
  });

  buscador.addEventListener('input', aplicarFiltros);
}

iniciar();
