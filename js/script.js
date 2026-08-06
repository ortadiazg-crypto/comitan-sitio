// ---------------------------------------------------------
// Carga de datos: pide el archivo por su ruta (data/Lugares.json).
// Esto SOLO funciona si el sitio corre en un servidor
// (Live Server, GitHub Pages, Netlify, etc.).
// Si abres index.html con doble clic, el navegador bloquea
// esa petición por seguridad (protocolo file://) y no hay
// forma de evitarlo desde el código: es una restricción del
// propio navegador. Ver el aviso más abajo si eso pasa.
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

function crearTarjeta(lugar, color) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-lugar';
  tarjeta.style.borderLeftColor = color;
  tarjeta.innerHTML = `
    <span class="tarjeta-id">#${lugar.id}</span>
    <h3>${lugar.nombre}</h3>
    <p>📍 ${lugar.direccion}</p>
  `;
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
      <p>Para que funcione con las rutas reales, corre un servidor local en la carpeta del proyecto. Por ejemplo:</p>
      <pre>python -m http.server 8000</pre>
      <p>y abre <code>http://localhost:8000</code> en tu navegador. También funciona subiendo la carpeta
      a GitHub Pages, Netlify o Vercel.</p>
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

  const contenedor = document.getElementById('app');
  const sinResultados = document.getElementById('sinResultados');
  const buscador = document.getElementById('buscador');

  datos.forEach(grupo => contenedor.appendChild(crearSeccion(grupo)));

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
