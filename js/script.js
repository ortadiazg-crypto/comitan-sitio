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

// =========================================================
// MAPA INTERACTIVO POR ID
// =========================================================

async function iniciarMapaInteractivo() {
  const contenedorMapa = document.getElementById("mapaInteractivo");
  const ventana = document.getElementById("ventanaLugar");
  const botonCerrar = document.getElementById("cerrarVentana");

  let iconoSeleccionado = null;

  botonCerrar.addEventListener("click", () => {
    ventana.close();
  });

  // Cerrar al presionar fuera de la ventana.
  // Escape funciona automáticamente con <dialog>.
  ventana.addEventListener("click", (evento) => {
    const limites = ventana.getBoundingClientRect();

    const clicFuera =
      evento.clientX < limites.left ||
      evento.clientX > limites.right ||
      evento.clientY < limites.top ||
      evento.clientY > limites.bottom;

    if (evento.target === ventana && clicFuera) {
      ventana.close();
    }
  });

  try {
    // Cargar los datos y el dibujo del mapa.
    const [respuestaDatos, respuestaMapa] = await Promise.all([
      fetch("data/Lugares.json"),
      fetch("img/mapa-comitan.svg")
    ]);

    if (!respuestaDatos.ok || !respuestaMapa.ok) {
      throw new Error("No se pudieron cargar los datos o el mapa.");
    }

    const categorias = await respuestaDatos.json();
    const textoMapa = await respuestaMapa.text();

    // Guardar cada lugar usando su ID como clave.
    const lugaresPorId = new Map();

    categorias.forEach((categoria) => {
      categoria.lugares.forEach((lugar) => {
        lugaresPorId.set(String(lugar.id), {
          ...lugar,
          categoria: categoria.categoria
        });
      });
    });

    // Convertir el texto SVG en elementos de la página.
    const documentoSVG = new DOMParser().parseFromString(
      textoMapa,
      "image/svg+xml"
    );

    if (documentoSVG.querySelector("parsererror")) {
      throw new Error("El archivo SVG no es válido.");
    }

    const mapa = document.importNode(
      documentoSVG.documentElement,
      true
    );

    mapa.setAttribute("role", "group");
    mapa.setAttribute(
      "aria-label",
      "Mapa interactivo de Comitán de Domínguez"
    );

    contenedorMapa.replaceChildren(mapa);

    // Asociaciones iniciales entre los dibujos y los IDs del JSON.
    // "piezas" indica cuántos elementos forman el icono completo.
    //
    // IMPORTANTE:
    // El SVG original no identifica los lugares por nombre.
    // Confirma estas asociaciones con tu mapa de referencia.
    const asociaciones = [
      { selector: "path.cls-15", id: 203, piezas: 2 },
      { selector: "path.cls-17", id: 202, piezas: 2 },
      { selector: "path.cls-19", id: 205, piezas: 2 },
      { selector: "path.cls-21", id: 207, piezas: 2 },
      { selector: "path.cls-23", id: 201, piezas: 2 },
      { selector: "path.cls-25", id: 204, piezas: 2 },
      { selector: "path.cls-72", id: 206, piezas: 2 },

      {
        selector: "path.cls-49",
        indice: 0,
        id: 311,
        piezas: 4,
        provisional: true
      },
      {
        selector: "path.cls-49",
        indice: 1,
        id: 302,
        piezas: 4,
        provisional: true
      },

      { selector: "path.cls-52", id: 303, piezas: 2, provisional: true },
      { selector: "path.cls-53", id: 101, piezas: 2, provisional: true },
      { selector: "path.cls-55", id: 308, piezas: 2, provisional: true },
      { selector: "path.cls-57", id: 307, piezas: 2, provisional: true },
      { selector: "path.cls-59", id: 309, piezas: 2, provisional: true },
      { selector: "path.cls-60", id: 310, piezas: 2, provisional: true },

      {
        selector: 'path.cls-51[d^="M635.3,416.7"]',
        id: 305,
        piezas: 2,
        provisional: true
      },

      { selector: "path.cls-63", id: 304, piezas: 2, provisional: true },
      { selector: "path.cls-65", id: 306, piezas: 2, provisional: true },
      { selector: "path.cls-67", id: 102, piezas: 2, provisional: true },
      { selector: "path.cls-69", id: 301, piezas: 2, provisional: true },

      { selector: "path.cls-70", id: 401, piezas: 2 },
      { selector: "path.cls-71", id: 402, piezas: 2 }
    ];

    // Mostrar la ficha del lugar seleccionado.
    function mostrarDescripcion(id, icono, provisional = false) {
      const lugar = lugaresPorId.get(String(id));

      if (!lugar) {
        console.warn("No existe información para el ID:", id);
        return;
      }

      if (iconoSeleccionado) {
        iconoSeleccionado.classList.remove("seleccionado");
        iconoSeleccionado.setAttribute("aria-pressed", "false");
      }

      iconoSeleccionado = icono;

      icono.classList.add("seleccionado");
      icono.setAttribute("aria-pressed", "true");

      document.getElementById("idLugar").textContent =
      lugar.categoria;

      document.getElementById("nombreLugar").textContent =
        lugar.nombre;

      document.getElementById("descripcionLugar").textContent =
        lugar.descripcion || "Descripción pendiente de agregar.";

      document.getElementById("direccionLugar").textContent =
        `📍 ${lugar.direccion}`;

      document.getElementById("avisoLugar").hidden = true;

      if (!ventana.open) {
        ventana.showModal();
      }
    }

    // Agrupar las piezas para que todo el icono crezca junto.
    function prepararIcono(configuracion) {
      const elementos = mapa.querySelectorAll(
        configuracion.selector
      );

      const primeraPieza = elementos[
        configuracion.indice ?? 0
      ];

      const lugar = lugaresPorId.get(
        String(configuracion.id)
      );

      if (!primeraPieza || !lugar) {
        console.warn(
          "Revisa el icono o los datos del ID:",
          configuracion.id
        );
        return;
      }

      const grupo = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "g"
      );

      grupo.id = `lugar-${configuracion.id}`;
      grupo.dataset.lugarId = String(configuracion.id);

      grupo.classList.add("icono-lugar");

      grupo.setAttribute("role", "button");
      grupo.setAttribute("tabindex", "0");
      grupo.setAttribute("aria-label", lugar.nombre);
      grupo.setAttribute("aria-haspopup", "dialog");
      grupo.setAttribute("aria-pressed", "false");

      primeraPieza.parentNode.insertBefore(
        grupo,
        primeraPieza
      );

      let piezaActual = primeraPieza;

      for (let i = 0; i < configuracion.piezas; i++) {
        if (!piezaActual) break;

        const siguientePieza = piezaActual.nextElementSibling;

        grupo.appendChild(piezaActual);
        piezaActual = siguientePieza;
      }

      const titulo = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "title"
      );

      titulo.textContent = lugar.nombre;
      grupo.appendChild(titulo);

      grupo.addEventListener("click", () => {
        mostrarDescripcion(
          grupo.dataset.lugarId,
          grupo,
          configuracion.provisional
        );
      });

      grupo.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();

          mostrarDescripcion(
            grupo.dataset.lugarId,
            grupo,
            configuracion.provisional
          );
        }
      });
    }

    asociaciones.forEach(prepararIcono);

    // Los iconos de autobús no tienen datos en el JSON original.
    // Se identifican por separado sin inventar nombres de rutas.
    const simbolosTransporte = [
      ...mapa.querySelectorAll("path.cls-51")
    ].filter((elemento) => {
      return !elemento.closest(".icono-lugar");
    });

    simbolosTransporte.forEach((simbolo, indice) => {
      const id = 501 + indice;

      lugaresPorId.set(String(id), {
        id,
        nombre: `Punto de transporte ${indice + 1}`,
        categoria: "Transporte público",
        descripcion:
          "Símbolo de transporte público del plano. " +
          "La información de rutas y horarios está pendiente de agregar.",
        direccion: "Ubicación indicada en el mapa."
      });

      simbolo.dataset.transporteId = String(id);

      prepararIcono({
        selector: `[data-transporte-id="${id}"]`,
        id,
        piezas: 2
      });
    });

  } catch (error) {
    console.error(error);

    contenedorMapa.textContent =
      "No se pudo cargar el mapa. Revisa las rutas y abre " +
      "el proyecto mediante un servidor local.";
  }
}

iniciarMapaInteractivo();
