const URL_PEDIDOS_WEB = "https://script.google.com/macros/s/AKfycbwZufXHX4nwp0y0T1yhGjL3NKoDZtfCCBZ2bU8vBz9I2DC84WPaUEWtTHjLo3nX_815/exec";

const carrito = [];
let productos = [];
let cupones = [];
let cuponAplicado = null;
let totalGlobal = 0;
let descuentoGlobal = 0;

// --- Persistencia de carrito en localStorage ---
function guardarCarritoEnLocalStorage() {
  try {
    localStorage.setItem('smilemarket_carrito_v1', JSON.stringify(carrito));
  } catch (e) { console.warn('No se pudo guardar carrito en localStorage', e); }
}

function cargarCarritoDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem('smilemarket_carrito_v1');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(item => carrito.push(item));
      }
    }
  } catch (e) { console.warn('No se pudo cargar carrito en localStorage', e); }
}

// --- Splash y progreso ---
let barraProgresoInterval = null;
function iniciarSplash() {
  const splash = document.getElementById('splash');
  const barra = document.getElementById('barra-progreso');
  if (!splash || !barra) return;
  splash.style.display = 'flex';
  let valor = 5;
  barra.style.width = valor + '%';
  barraProgresoInterval = setInterval(() => {
    if (valor < 92) {
      valor += Math.random() * 6;
      barra.style.width = Math.min(92, Math.round(valor)) + '%';
    }
  }, 300);
}
function finalizarSplash() {
  const splash = document.getElementById('splash');
  const barra = document.getElementById('barra-progreso');
  if (!splash || !barra) return;
  clearInterval(barraProgresoInterval);
  barra.style.width = '100%';
  setTimeout(() => { splash.style.display = 'none'; barra.style.width = '0%'; }, 350);
}

async function cargarProductosDesdeGoogleSheet() {
  const urlCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=1670706691&single=true&output=csv';
  const response = await fetch(urlCSV);
  const texto = await response.text();
  const lineas = texto.split('\n').filter(l => l.trim() !== '');
  const headers = lineas[0].split(',').map(h => h.trim());

  productos = lineas.slice(1).map(linea => {
    const columnas = linea.split(',').map(c => c.trim());
    const producto = Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), columnas[i] || '']));
    return {
      nombre: producto.nombre || 'Sin nombre',
      categoria: producto.categoria || 'Sin categoría',
      precio: parseFloat(producto.precio) || 0,
      descripcion: producto.descripcion || '',
      imagen: producto.imagen || '',
      stock: parseInt(producto.stock) || 0,
      nuevo: producto.nuevo === 'TRUE',
      masvendido: producto.masvendido === 'TRUE',
      recomendado: producto.recomendado === 'TRUE'
    };
  });
}

async function cargarCuponesDesdeGoogleSheet() {
  const urlCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=713979488&single=true&output=csv';
  const response = await fetch(urlCSV);
  const texto = await response.text();
  const lineas = texto.split('\n').filter(l => l.trim() !== '');
  const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());

  cupones = lineas.slice(1).map(linea => {
    const columnas = linea.split(',').map(c => c.trim());
    const fila = Object.fromEntries(headers.map((h, i) => [h, columnas[i] || '']));
    return {
      codigo: fila.codigo?.toUpperCase() || '',
      descuento: parseFloat(fila.descuento) || 0
    };
  });
}

// =====================================================
// FAVORITOS
// =====================================================

function obtenerFavoritos() {
  try {
    const raw = localStorage.getItem('smilemarket_favoritos');
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) { return []; }
}

function guardarFavoritos(lista) {
  try {
    localStorage.setItem('smilemarket_favoritos', JSON.stringify(lista));
  } catch (e) { console.warn('No se pudieron guardar los favoritos', e); }
}

function esFavorito(nombre) {
  return obtenerFavoritos().includes(nombre);
}

// Genera el botón de corazón para insertar dentro de la tarjeta de producto
function favoritoBtnHTML(nombre) {
  const activo = esFavorito(nombre);
  const nombreEscapado = (nombre || '').replace(/'/g, "\\'");
  return `<button type="button" class="favorito-btn${activo ? ' favorito-activo' : ''}" onclick="event.stopPropagation(); toggleFavorito(this, '${nombreEscapado}')" aria-label="Guardar en favoritos">${activo ? '♥' : '♡'}</button>`;
}

function toggleFavorito(boton, nombre) {
  let favoritos = obtenerFavoritos();
  const yaEsFavorito = favoritos.includes(nombre);

  favoritos = yaEsFavorito ? favoritos.filter(n => n !== nombre) : [...favoritos, nombre];
  guardarFavoritos(favoritos);

  if (boton) {
    boton.textContent = yaEsFavorito ? '♡' : '♥';
    boton.classList.toggle('favorito-activo', !yaEsFavorito);
  }

  // Si el modal de favoritos está abierto, lo refrescamos para que se note el cambio al toque
  const modal = document.getElementById('favoritos-modal');
  if (modal && modal.style.display === 'flex') {
    abrirFavoritosModal();
  }
}

// --- Arma una tarjeta de producto igual a la del catálogo, para usar dentro del modal de favoritos ---
function crearTarjetaFavorito(producto) {
  const div = document.createElement('div');
  div.className = 'producto';
  div.dataset.nombre = producto.nombre;
  div.dataset.precio = producto.precio;
  div.dataset.descripcion = producto.descripcion;
  div.dataset.categoria = producto.categoria;

  const imagenHTML = producto.imagen ? `
    <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`, \`${producto.imagen}\`)">
      <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:140px; object-fit:contain; background:white;" />
      ${favoritoBtnHTML(producto.nombre)}
      ${producto.stock <= 0 ? '<div class="sin-stock-overlay">SIN STOCK</div>' : ''}
    </div>` : '';

  div.innerHTML = `
    ${imagenHTML}
    <h3>${producto.nombre}</h3>
    <p class="categoria-texto">${producto.categoria}</p>
    <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
    <div class="control-cantidad">
      <button class="menos" onclick="cambiarCantidad(this, -1)" ${producto.stock <= 0 ? 'disabled' : ''}>−</button>
      <input class="cantidad-input" type="number" value="1" min="1" readonly />
      <button class="mas" onclick="cambiarCantidad(this, 1)" ${producto.stock <= 0 ? 'disabled' : ''}>+</button>
    </div>
    <button class="boton" onclick="agregarAlCarrito(this)" ${producto.stock <= 0 ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
      ${producto.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}
    </button>
  `;
  return div;
}

function abrirFavoritosModal() {
  const favoritos = obtenerFavoritos();
  const contenedor = document.getElementById('favoritos-modal-lista');
  const vacio = document.getElementById('favoritos-modal-vacio');
  if (!contenedor) return;

  contenedor.innerHTML = '';

  const productosFavoritos = favoritos
    .map(nombre => productos.find(p => p.nombre === nombre))
    .filter(Boolean); // saca los que ya no existen en la planilla

  if (productosFavoritos.length === 0) {
    vacio.style.display = 'block';
  } else {
    vacio.style.display = 'none';
    productosFavoritos.forEach(producto => {
      contenedor.appendChild(crearTarjetaFavorito(producto));
    });
  }

  document.getElementById('favoritos-modal').style.display = 'flex';
}

function cerrarFavoritosModal() {
  document.getElementById('favoritos-modal').style.display = 'none';
}

// =====================================================
// REPETIR ÚLTIMO PEDIDO
// =====================================================

function obtenerUltimoPedido() {
  try {
    const raw = localStorage.getItem('smilemarket_ultimo_pedido');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function guardarUltimoPedido() {
  try {
    const snapshot = carrito.map(i => ({ nombre: i.nombre, cantidad: i.cantidad }));
    localStorage.setItem('smilemarket_ultimo_pedido', JSON.stringify(snapshot));
  } catch (e) { console.warn('No se pudo guardar el último pedido', e); }
}

// --- Vacía el carrito después de confirmar un pedido ---
function vaciarCarrito() {
  carrito.length = 0;
  guardarCarritoEnLocalStorage();
  actualizarCarrito();

  // Cerramos el panel del carrito si quedó abierto, y mostramos el botón de "repetir pedido"
  document.getElementById('carrito')?.classList.remove('mostrar');

  const btnRepetirPedido = document.getElementById('btn-repetir-pedido');
  if (btnRepetirPedido) btnRepetirPedido.style.display = 'inline-block';
}

function repetirUltimoPedido() {
  const ultimoPedido = obtenerUltimoPedido();
  if (!ultimoPedido || ultimoPedido.length === 0) return;

  let agregados = 0;
  const noDisponibles = [];

  ultimoPedido.forEach(item => {
    const producto = productos.find(p => p.nombre === item.nombre);
    if (!producto || producto.stock <= 0) {
      noDisponibles.push(item.nombre);
      return;
    }

    const cantidadFinal = Math.min(item.cantidad, producto.stock);
    const existente = carrito.find(c => c.nombre === producto.nombre);
    if (existente) {
      // Fijamos la cantidad del último pedido (no sumamos), así tocar el botón
      // varias veces no va acumulando cantidades de más.
      existente.cantidad = cantidadFinal;
    } else {
      carrito.push({ nombre: producto.nombre, precio: producto.precio, cantidad: cantidadFinal });
    }
    agregados++;
  });

  guardarCarritoEnLocalStorage();
  actualizarCarrito();
  animarCarrito();

  // Abrimos el panel del carrito para que vea qué se cargó y pueda ajustarlo si quiere
  document.getElementById('carrito')?.classList.add('mostrar');

  if (agregados > 0 && noDisponibles.length === 0) {
    mostrarPopup('¡Agregamos tu último pedido al carrito! 🔁');
  } else if (agregados > 0 && noDisponibles.length > 0) {
    mostrarPopup('Agregamos casi todo tu último pedido (algo ya no está disponible) 🔁');
    console.warn('No disponibles al repetir el pedido:', noDisponibles.join(', '));
  } else {
    mostrarPopup('Los productos de tu último pedido ya no están disponibles 😕');
  }
}

// --- Sincroniza el carrito guardado contra los precios y el stock actuales de la planilla ---
// Se corre cada vez que se cargan los productos.
// - Si un precio cambió, lo actualiza.
// - Si un producto ya no existe en la planilla, lo saca del carrito.
// - Si un producto se quedó sin stock, lo saca del carrito.
// - Si pidieron más cantidad de la que hay disponible, la ajusta al máximo posible.
function sincronizarPreciosCarrito() {
  if (!carrito || carrito.length === 0) {
    return { huboCambios: false, eliminadosNoExiste: [], eliminadosSinStock: [], ajustados: [] };
  }

  let huboCambios = false;
  const eliminadosNoExiste = [];
  const eliminadosSinStock = [];
  const ajustados = [];

  for (let i = carrito.length - 1; i >= 0; i--) {
    const item = carrito[i];
    const productoActual = productos.find(p => p.nombre === item.nombre);

    if (!productoActual) {
      eliminadosNoExiste.push(item.nombre);
      carrito.splice(i, 1);
      huboCambios = true;
      continue;
    }

    if (productoActual.precio !== item.precio) {
      item.precio = productoActual.precio;
      huboCambios = true;
    }

    if (productoActual.stock <= 0) {
      eliminadosSinStock.push(item.nombre);
      carrito.splice(i, 1);
      huboCambios = true;
      continue;
    }

    if (item.cantidad > productoActual.stock) {
      ajustados.push({ nombre: item.nombre, de: item.cantidad, a: productoActual.stock });
      item.cantidad = productoActual.stock;
      huboCambios = true;
    }
  }

  if (huboCambios) guardarCarritoEnLocalStorage();

  return { huboCambios, eliminadosNoExiste, eliminadosSinStock, ajustados };
}

function agregarAlCarrito(boton) {
  const producto = boton.closest('.producto');
  const nombre = producto.dataset.nombre;
  const precio = parseFloat(producto.dataset.precio);
  const cantidad = parseInt(producto.querySelector('.cantidad-input').value);

  const existente = carrito.find(item => item.nombre === nombre);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({ nombre, precio, cantidad });
  }

  guardarCarritoEnLocalStorage();
  mostrarPopup();
  animarCarrito();
  actualizarCarrito();
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  guardarCarritoEnLocalStorage();
  actualizarCarrito();
}

function actualizarCarrito() {
  const carritoItems = document.getElementById('carrito-items');
  carritoItems.innerHTML = '';
  let total = 0;
  let cantidadTotal = 0;

  carrito.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'carrito-item';
    itemDiv.innerHTML = `
  <div style="flex:1; min-width:140px;">
    <div style="font-size:0.9rem;"><strong>${item.nombre}</strong></div>
    <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
      <button type="button" onclick="cambiarCantidadCarrito(${index}, -1)" style="width:32px; height:32px; border:none; background:#ddd; border-radius:6px; font-size:1.2rem; cursor:pointer;">−</button>
      <input type="number" value="${item.cantidad}" min="1" style="width:48px; height:32px; text-align:center; font-weight:bold; border:1px solid #ccc; border-radius:6px;" onchange="cambiarCantidadCarritoInput(${index}, this.value)" />
      <button type="button" onclick="cambiarCantidadCarrito(${index}, 1)" style="width:32px; height:32px; border:none; background:#ddd; border-radius:6px; font-size:1.2rem; cursor:pointer;">+</button>
    </div>
  </div>
  <div style="min-width:70px; text-align:right; font-size:0.9rem;">$${(item.precio * item.cantidad).toLocaleString()}</div>
  <button type="button" onclick="eliminarDelCarrito(${index})" style="margin-left:6px; background:none; border:none; color:#d9534f; font-size:1.4rem; cursor:pointer;">&times;</button>
`;
    carritoItems.appendChild(itemDiv);
    total += item.precio * item.cantidad;
    cantidadTotal += item.cantidad;
  });

  document.getElementById('total').textContent = 'Total: $' + total.toLocaleString();
  document.getElementById('contador-carrito').textContent = cantidadTotal;
  totalGlobal = total;
}

function mostrarPopup(mensaje) {
  const popup = document.getElementById('popup');
  if (popup) {
    if (mensaje) popup.textContent = mensaje;
    popup.style.display = 'block';
    setTimeout(() => {
      popup.style.display = 'none';
      popup.textContent = 'Producto agregado al carrito';
    }, 1800);
  }
}

function cambiarCantidadCarrito(index, delta) {
  if (!carrito[index]) return;
  carrito[index].cantidad += delta;
  if (carrito[index].cantidad < 1) carrito[index].cantidad = 1;
  guardarCarritoEnLocalStorage();
  actualizarCarrito();
}

function cambiarCantidadCarritoInput(index, value) {
  if (!carrito[index]) return;
  let cantidad = parseInt(value);
  if (isNaN(cantidad) || cantidad < 1) cantidad = 1;
  carrito[index].cantidad = cantidad;
  guardarCarritoEnLocalStorage();
  actualizarCarrito();
}

function mostrarModalInfo(nombre, descripcion, imagen) {
  document.getElementById('modal-titulo').textContent = nombre;
  document.getElementById('modal-descripcion').textContent = descripcion;

  const imgEl = document.getElementById('modal-imagen');
  if (imgEl) {
    if (imagen) {
      imgEl.src = imagen;
      imgEl.alt = nombre;
      imgEl.style.display = 'block';
    } else {
      imgEl.style.display = 'none';
      imgEl.src = '';
    }
  }

  document.getElementById('info-modal').style.display = 'flex';
}

function cerrarModalInfo() {
  document.getElementById('info-modal').style.display = 'none';
}

function animarCarrito() {
  const icono = document.getElementById('carrito-icono');
  if (icono) {
    icono.classList.remove('vibrar');
    void icono.offsetWidth;
    icono.classList.add('vibrar');
    setTimeout(() => icono.classList.remove('vibrar'), 500);
  }
}

// --- Personalización con nombre ---
function guardarNombreCliente(nombre) {
  try {
    localStorage.setItem('smilemarket_nombre', nombre);
  } catch (e) { console.warn('No se pudo guardar nombre en localStorage', e); }
}

function obtenerNombreCliente() {
  try {
    return localStorage.getItem('smilemarket_nombre') || '';
  } catch (e) { return ''; }
}

function mostrarSaludo() {
  const nombre = obtenerNombreCliente();
  const saludoDiv = document.getElementById('saludo-usuario');
  if (saludoDiv) {
    if (nombre) {
      saludoDiv.textContent = `Hola, ${nombre} 👋 ¿Listo para tu próxima compra?`;
    } else {
      saludoDiv.textContent = '¡Bienvenido a SmileMarket! 😃';
    }
  }
}

// Buscar sugerencias
function mostrarSugerencias(texto) {
  const cont = document.getElementById('sugerencias');
  cont.innerHTML = '';
  if (!texto || texto.trim() === '') { cont.style.display = 'none'; return; }
  const lower = texto.toLowerCase();
  const matches = productos.filter(p => (p.nombre||'').toLowerCase().includes(lower) || (p.descripcion||'').toLowerCase().includes(lower)).slice(0,8);
  if (matches.length === 0) { cont.style.display = 'none'; return; }
  matches.forEach(m => {
    const item = document.createElement('div');
    item.className = 'sugerencia-item';
    item.innerHTML = `
      <img loading="lazy" src="${m.imagen || 'https://via.placeholder.com/80?text=img'}" alt="${m.nombre}" />
      <div style="flex:1">
        <div class="sugerencia-text">${m.nombre}</div>
        <div class="sugerencia-precio">$ ${m.precio.toLocaleString()}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      document.getElementById('buscador').value = m.nombre;
      document.getElementById('sugerencias').style.display = 'none';
      filtrarPorTexto(m.nombre);
    });
    cont.appendChild(item);
  });
  cont.style.display = 'block';
}

function filtrarPorTexto(texto){
  const lower = (texto||'').toLowerCase();
  document.querySelectorAll('.grupo-categoria').forEach(grupo => {
    let coincidencias = 0;

    grupo.querySelectorAll('.producto').forEach(prod => {
      const nombre = prod.dataset.nombre?.toLowerCase() || '';
      const categoria = prod.dataset.categoria?.toLowerCase() || '';
      const descripcion = prod.dataset.descripcion?.toLowerCase() || '';

      if (nombre.includes(lower) || categoria.includes(lower) || descripcion.includes(lower)) {
        prod.style.display = 'flex'; 
        coincidencias++;
      } else {
        prod.style.display = 'none';
      }
    });

    grupo.style.display = coincidencias > 0 ? 'block' : 'none';
    const titulo = grupo.querySelector('.titulo-categoria');
    if (titulo) {
      titulo.style.display = texto ? 'none' : 'block';
    }
  });
}

// ✅ NUEVO: envía el pedido a la planilla "Pedidos Web" (no bloquea el flujo si falla)
function guardarPedidoEnPlanilla(datosPedido) {
  if (!URL_PEDIDOS_WEB || URL_PEDIDOS_WEB.indexOf('PEGAR_AQUI') !== -1) {
    console.warn('Falta configurar URL_PEDIDOS_WEB en main.js');
    return;
  }
  fetch(URL_PEDIDOS_WEB, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datosPedido)
  }).catch(err => {
    console.warn('No se pudo guardar el pedido en la planilla (el pedido igual se envía por WhatsApp):', err);
  });
}

// --- Utilidad: convertir nombre de categoría en un id válido para anclas ---
function slugify(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// --- Mide la altura real del header y la deja disponible como variable CSS ---
// (el header puede cambiar de tamaño según el saludo, el logo, etc.)
function actualizarAlturaHeader() {
  const header = document.getElementById('main-header');
  if (!header) return;
  document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
}

// --- TOP 10 MÁS VENDIDOS (ranking manual, curado por Maxi) ---
// El orden de esta lista define el ranking. Los datos (imagen, precio, stock)
// se toman en vivo de la planilla de Google Sheets, buscando por nombre.
const TOP_VENTAS = [
  'Kit de cirugía E',
  'Pinza Wynman',
  'Sin aletas',
  'B4 B',
  'Llave para Ajuste de Puntas',
  'Punta P1',
  'B4 A',
  'Punta SB1',
  'Kit espatulas + casette',
  'Con aletas'
];

function renderizarTopVentas() {
  const contenedor = document.getElementById('top-ventas-lista');
  const seccion = document.querySelector('.top-ventas-section');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  let encontrados = 0;

  TOP_VENTAS.forEach((nombreBuscado, index) => {
    const buscado = nombreBuscado.trim().toLowerCase();
    let producto = productos.find(p => (p.nombre || '').trim().toLowerCase() === buscado);
    if (!producto) {
      // Si no hay coincidencia exacta, probamos una coincidencia parcial
      producto = productos.find(p => (p.nombre || '').toLowerCase().includes(buscado));
    }

    if (!producto) {
      console.warn('Top ventas: no se encontró "' + nombreBuscado + '" en la planilla (revisá que el nombre coincida exactamente con la columna "nombre").');
      return;
    }

    encontrados++;

    const div = document.createElement('div');
    div.className = 'producto producto-top';
    div.dataset.nombre = producto.nombre;
    div.dataset.precio = producto.precio;
    div.dataset.descripcion = producto.descripcion;
    div.dataset.categoria = producto.categoria;

    const imagenHTML = producto.imagen ? `
      <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`, \`${producto.imagen}\`)">
        <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:130px; object-fit:contain; background:white;" />
        ${favoritoBtnHTML(producto.nombre)}
        ${producto.stock <= 0 ? '<div class="sin-stock-overlay">SIN STOCK</div>' : ''}
      </div>` : '';

    div.innerHTML = `
      <div class="ranking-badge">#${index + 1}</div>
      ${imagenHTML}
      <h3>${producto.nombre}</h3>
      <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
      <div class="control-cantidad">
        <button class="menos" onclick="cambiarCantidad(this, -1)" ${producto.stock <= 0 ? 'disabled' : ''}>−</button>
        <input class="cantidad-input" type="number" value="1" min="1" readonly />
        <button class="mas" onclick="cambiarCantidad(this, 1)" ${producto.stock <= 0 ? 'disabled' : ''}>+</button>
      </div>
      <button class="boton" onclick="agregarAlCarrito(this)" ${producto.stock <= 0 ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
        ${producto.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}
      </button>
    `;
    contenedor.appendChild(div);
  });

  // Si por algún motivo no se encontró ningún producto, ocultamos la sección
  // para no mostrar un espacio vacío.
  if (seccion) seccion.style.display = encontrados > 0 ? '' : 'none';
}

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  iniciarSplash();
  cargarCarritoDesdeLocalStorage();

  await cargarProductosDesdeGoogleSheet();
  await cargarCuponesDesdeGoogleSheet();

  const resultadoSyncCarrito = sincronizarPreciosCarrito();

  renderizarTopVentas();

  finalizarSplash();

  mostrarSaludo(); // ✅ saludo en header

  // Mostrar el botón de "repetir último pedido" solo si hay uno guardado
  const btnRepetirPedido = document.getElementById('btn-repetir-pedido');
  if (btnRepetirPedido) {
    const ultimoPedidoGuardado = obtenerUltimoPedido();
    btnRepetirPedido.style.display = (ultimoPedidoGuardado && ultimoPedidoGuardado.length > 0) ? 'inline-block' : 'none';
  }

  // Medir la altura real del header (cambia según el saludo, el logo, etc.)
  actualizarAlturaHeader();
  const headerEl = document.getElementById('main-header');
  if (headerEl && window.ResizeObserver) {
    new ResizeObserver(actualizarAlturaHeader).observe(headerEl);
  } else {
    window.addEventListener('resize', actualizarAlturaHeader);
  }

  // Autocompletar campo nombre en el modal
  const inputNombre = document.getElementById('nombre-cliente');
  if (inputNombre) {
    inputNombre.value = obtenerNombreCliente();
  }

  const contenedor = document.getElementById('productos');
  const productosPorCategoria = {};

  productos.forEach(producto => {
    const categoria = producto.categoria || 'Sin categoría';
    if (!productosPorCategoria[categoria]) {
      productosPorCategoria[categoria] = [];
    }
    productosPorCategoria[categoria].push(producto);
  });

  const categoriasOrdenadas = Object.keys(productosPorCategoria).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  categoriasOrdenadas.forEach(categoria => {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-categoria';
    grupo.id = 'cat-' + slugify(categoria);

    const titulo = document.createElement('h2');
    titulo.textContent = categoria;
    titulo.className = 'titulo-categoria';
    grupo.appendChild(titulo);

    const contenedorCategoria = document.createElement('div');
    contenedorCategoria.className = 'productos';

    productosPorCategoria[categoria].forEach(producto => {
      const div = document.createElement('div');
      div.className = 'producto';
      div.dataset.nombre = producto.nombre;
      div.dataset.precio = producto.precio;
      div.dataset.descripcion = producto.descripcion;
      div.dataset.categoria = producto.categoria;

      const etiquetas = [];
      if (producto.nuevo) etiquetas.push('nuevo');
      if (producto.masvendido) etiquetas.push('masvendido');
      if (producto.recomendado) etiquetas.push('recomendado');

      const etiquetasHTML = etiquetas.length > 0
        ? `<div class="etiquetas">${etiquetas.map(t => `<span class="etiqueta ${t}">${t==='nuevo'? '🆕 Nuevo' : t==='masvendido' ? '🔥 Muy vendido' : '⭐ Recomendado' }</span>`).join('')}</div>`
        : '';

      const imagenHTML = producto.imagen ? `
        <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`, \`${producto.imagen}\`)">
          <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:160px; object-fit:contain; background:white;" />
          ${favoritoBtnHTML(producto.nombre)}
          ${producto.stock <= 0
            ? '<div class="sin-stock-overlay">SIN STOCK</div>'
            : '<div class="info-overlay">+ info</div>'}
        </div>` : '';

      div.innerHTML = `
        ${imagenHTML}
        <h3>${producto.nombre}</h3>
        ${etiquetasHTML}
        <p class="categoria-texto">${producto.categoria}</p>
        <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
        <div class="control-cantidad">
          <button class="menos" onclick="cambiarCantidad(this, -1)" ${producto.stock <= 0 ? 'disabled' : ''}>−</button>
          <input class="cantidad-input" type="number" value="1" min="1" readonly />
          <button class="mas" onclick="cambiarCantidad(this, 1)" ${producto.stock <= 0 ? 'disabled' : ''}>+</button>
        </div>
        <button class="boton" onclick="agregarAlCarrito(this)" ${producto.stock <= 0 ? 'disabled style="background:#ccc;cursor:not-allowed;"' : ''}>
          ${producto.stock <= 0 ? 'Sin stock' : 'Agregar al carrito'}
        </button>
      `;
      contenedorCategoria.appendChild(div);
    });

    grupo.appendChild(contenedorCategoria);
    contenedor.appendChild(grupo);
  });

  // --- Menú de navegación por categorías (desktop + mobile) ---
  const navDesktop = document.getElementById('nav-categorias-desktop');
  const navMobile = document.getElementById('nav-categorias-mobile');

  if (navDesktop && navMobile) {
    categoriasOrdenadas.forEach(categoria => {
      const slug = 'cat-' + slugify(categoria);

      const linkDesktop = document.createElement('a');
      linkDesktop.href = '#' + slug;
      linkDesktop.textContent = categoria;
      linkDesktop.dataset.target = slug;
      navDesktop.appendChild(linkDesktop);

      const linkMobile = document.createElement('a');
      linkMobile.href = '#' + slug;
      linkMobile.textContent = categoria;
      linkMobile.dataset.target = slug;
      navMobile.appendChild(linkMobile);
    });

    // Resalta la categoría activa mientras se hace scroll
    const activarLinkCategoria = (id) => {
      document.querySelectorAll('.nav-categorias-desktop a, .nav-categorias-mobile a').forEach(a => {
        a.classList.toggle('activa', a.dataset.target === id);
      });
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) activarLinkCategoria(entry.target.id);
      });
    }, { root: null, rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    document.querySelectorAll('.grupo-categoria').forEach(g => observer.observe(g));
  }

  actualizarCarrito();

  if (resultadoSyncCarrito && resultadoSyncCarrito.huboCambios) {
    if (resultadoSyncCarrito.eliminadosNoExiste.length > 0) {
      console.warn('Se quitaron del carrito (ya no existen en la planilla):', resultadoSyncCarrito.eliminadosNoExiste.join(', '));
    }
    if (resultadoSyncCarrito.eliminadosSinStock.length > 0) {
      console.warn('Se quitaron del carrito (sin stock):', resultadoSyncCarrito.eliminadosSinStock.join(', '));
    }
    if (resultadoSyncCarrito.ajustados.length > 0) {
      resultadoSyncCarrito.ajustados.forEach(a => {
        console.warn(`Se ajustó la cantidad de "${a.nombre}": de ${a.de} a ${a.a} (stock disponible)`);
      });
    }

    const huboEliminados = resultadoSyncCarrito.eliminadosNoExiste.length > 0 || resultadoSyncCarrito.eliminadosSinStock.length > 0;
    const huboAjustes = resultadoSyncCarrito.ajustados.length > 0;

    let mensaje = 'Actualizamos tu carrito con los precios actuales 🔄';
    if (huboEliminados && huboAjustes) {
      mensaje = 'Actualizamos tu carrito: precios, stock y cantidades revisados 🔄';
    } else if (huboEliminados) {
      mensaje = 'Sacamos de tu carrito lo que ya no tiene stock 🔄';
    } else if (huboAjustes) {
      mensaje = 'Ajustamos algunas cantidades de tu carrito por stock disponible 🔄';
    }

    mostrarPopup(mensaje);
  }

  const carritoIcono = document.getElementById('carrito-icono');
  const carritoPanel = document.getElementById('carrito');

  if (carritoIcono && carritoPanel) {
    carritoIcono.addEventListener('click', (e) => {
      e.preventDefault();
      carritoPanel.classList.toggle('mostrar');
    });
  }

function calcularResumen() {
  const resumen = document.getElementById('resumen-contenido');
  resumen.innerHTML = '';
  totalGlobal = 0;
  let mensaje = '';

  carrito.forEach(item => {
    const linea = `${item.nombre} x ${item.cantidad} - $${(item.precio * item.cantidad).toLocaleString()}`;
    resumen.innerHTML += `<div style="margin-bottom: 0.4rem;">${linea}</div>`;
    mensaje += `• ${linea}\n`;
    totalGlobal += item.precio * item.cantidad;
  });

  resumen.innerHTML += `<div style="margin-top: 1rem;">Subtotal: $${totalGlobal.toLocaleString()}</div>`;

  if (descuentoGlobal > 0) {
    const montoDescuento = totalGlobal * (descuentoGlobal / 100);
    const totalConDescuento = totalGlobal - montoDescuento;

    resumen.innerHTML += `<div>Descuento (${descuentoGlobal}%): -$${montoDescuento.toLocaleString()}</div>`;
    resumen.innerHTML += `<div style="font-weight:bold;">Total: $${totalConDescuento.toLocaleString()}</div>`;
    totalGlobal = totalConDescuento;

  } else {
    resumen.innerHTML += `<div style="font-weight:bold;">Total: $${totalGlobal.toLocaleString()}</div>`;
  }

  // 👉 ESTA LÍNEA ES LA CLAVE (acá adentro)
  document.getElementById('checkout-total').textContent = '$' + totalGlobal.toLocaleString();

  document.getElementById('enviar-whatsapp').dataset.mensaje = mensaje;
}

  const numeroPedido = generarNumeroPedido();
// =====================================================
// FORMA DE PAGO (segundo paso del checkout)
// =====================================================

let formaPagoSeleccionada = null;

function mostrarPasoPago() {
  document.getElementById('paso-resumen').style.display = 'none';
  document.getElementById('paso-pago').style.display = 'block';
  document.getElementById('footer-paso-resumen').style.display = 'none';
  document.getElementById('footer-paso-pago').style.display = 'flex';
  document.getElementById('titulo-modal-resumen').textContent = 'Forma de pago';
}

function mostrarPasoResumen() {
  document.getElementById('paso-pago').style.display = 'none';
  document.getElementById('paso-resumen').style.display = 'block';
  document.getElementById('footer-paso-pago').style.display = 'none';
  document.getElementById('footer-paso-resumen').style.display = 'flex';
  document.getElementById('titulo-modal-resumen').textContent = 'Resumen de tu pedido';
}

function resetearPasoPago() {
  formaPagoSeleccionada = null;
  document.getElementById('btn-pago-transferencia')?.classList.remove('seleccionado');
  document.getElementById('btn-pago-efectivo')?.classList.remove('seleccionado');
  const detalleTransf = document.getElementById('detalle-transferencia');
  const detalleEfec = document.getElementById('detalle-efectivo');
  if (detalleTransf) detalleTransf.style.display = 'none';
  if (detalleEfec) detalleEfec.style.display = 'none';
  const btnEnviar = document.getElementById('enviar-whatsapp');
  if (btnEnviar) btnEnviar.disabled = true;
}

function seleccionarFormaPago(forma) {
  formaPagoSeleccionada = forma;

  document.getElementById('btn-pago-transferencia')?.classList.toggle('seleccionado', forma === 'transferencia');
  document.getElementById('btn-pago-efectivo')?.classList.toggle('seleccionado', forma === 'efectivo');

  const detalleTransf = document.getElementById('detalle-transferencia');
  const detalleEfec = document.getElementById('detalle-efectivo');
  if (detalleTransf) detalleTransf.style.display = forma === 'transferencia' ? 'block' : 'none';
  if (detalleEfec) detalleEfec.style.display = forma === 'efectivo' ? 'block' : 'none';

  const btnEnviar = document.getElementById('enviar-whatsapp');
  if (btnEnviar) btnEnviar.disabled = false;
}

function cerrarResumenModal() {
  document.getElementById('resumen-modal').style.display = 'none';
  mostrarPasoResumen();
  resetearPasoPago();
}



document.getElementById('confirmar')?.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  // 🔥 Generar número de pedido en el momento correcto
    window.numeroPedidoActual = numeroPedido;

  document.getElementById('numero-pedido').innerText = "Pedido #" + numeroPedido;

  descuentoGlobal = 0;
  document.getElementById('cupon-feedback').textContent = '';
  document.getElementById('resumen-modal').style.display = 'flex';

  mostrarPasoResumen();
  resetearPasoPago();

  calcularResumen();
  mostrarProductosRelacionados();
});


  document.getElementById('aplicar-cupon')?.addEventListener('click', () => {
    const inputCupon = document.getElementById('cupon');
    const feedback = document.getElementById('cupon-feedback');
    const codigoIngresado = inputCupon?.value.trim().toUpperCase();

    if (!codigoIngresado) {
      feedback.textContent = 'Ingresá un código';
      feedback.style.color = 'red';
      return;
    }

    const cuponValido = cupones.find(c => c.codigo === codigoIngresado);
    if (cuponValido) {
      descuentoGlobal = cuponValido.descuento;
      feedback.textContent = `Cupón aplicado: ${descuentoGlobal}% de descuento`;
      feedback.style.color = 'green';
    } else {
      descuentoGlobal = 0;
      feedback.textContent = 'Cupón no válido';
      feedback.style.color = 'red';
    }

    calcularResumen();
document.getElementById('checkout-total').textContent = '$' + totalGlobal.toLocaleString();
    mostrarProductosRelacionados();
  });

  document.getElementById('enviar-whatsapp')?.addEventListener('click', () => {
    const nombreCliente = document.getElementById('nombre-cliente')?.value.trim();
    if (!nombreCliente) {
      alert("Por favor, ingresá tu nombre antes de enviar el pedido.");
      return;
    }

    if (!formaPagoSeleccionada) {
      alert("Elegí una forma de pago (transferencia o efectivo) antes de enviar el pedido.");
      return;
    }

    guardarNombreCliente(nombreCliente); // ✅ guardamos el nombre

// ✅ Validación
if (!carrito || carrito.length === 0) {
  alert('El carrito está vacío');
  return;
}

// ✅ Mensaje base
let mensaje = `Pedido #${window.numeroPedidoActual}\n\n`;

mensaje += `Hola! mi nombre es ${nombreCliente}, quiero realizar una compra:\n\n`;

mensaje += document.getElementById('enviar-whatsapp').dataset.mensaje;

// ✅ Calcular total correctamente
let total = 0;

carrito.forEach(item => {
  total += Number(item.precio) * Number(item.cantidad);
});

// ✅ Agregar total
mensaje = mensaje.trim();
mensaje += `\nTotal: $${total.toLocaleString()}`;

// ✅ Agregar la forma de pago y su condición, bien visible al final del mensaje
const textoFormaPago = formaPagoSeleccionada === 'transferencia'
  ? 'Transferencia ⚠️ (envío el comprobante en este mismo chat)'
  : 'Efectivo (pedido válido por 5 días)';
mensaje += `\n\nForma de pago: ${textoFormaPago}`;

// ✅ NUEVO: guardar el pedido en la planilla "Pedidos Web" ANTES de abrir WhatsApp
// (así queda registrado aunque el cliente no llegue a enviar el mensaje)
guardarPedidoEnPlanilla({
  numeroPedido: window.numeroPedidoActual,
  cliente: nombreCliente,
  carrito: carrito,
  cupon: document.getElementById('cupon')?.value.trim().toUpperCase() || '',
  descuento: descuentoGlobal,
  total: total,
  formaPago: formaPagoSeleccionada
});

// ✅ Guardamos este pedido como "último pedido" para poder repetirlo con un click después
guardarUltimoPedido();

// ✅ Enviar a WhatsApp
const url = `https://wa.me/5491130335334?text=${encodeURIComponent(mensaje)}`;
window.open(url, '_blank');

// ✅ Vaciar el carrito: el pedido ya se confirmó y quedó guardado como "último pedido"
vaciarCarrito();

// ✅ Cerrar modal
cerrarResumenModal();
  });

  document.getElementById('seguir-comprando')?.addEventListener('click', () => {
    cerrarResumenModal();
  });

  document.getElementById('btn-continuar-pago')?.addEventListener('click', mostrarPasoPago);
  document.getElementById('btn-volver-resumen')?.addEventListener('click', mostrarPasoResumen);
  document.getElementById('btn-pago-transferencia')?.addEventListener('click', () => seleccionarFormaPago('transferencia'));
  document.getElementById('btn-pago-efectivo')?.addEventListener('click', () => seleccionarFormaPago('efectivo'));

  document.getElementById('btn-cargar-lista')?.addEventListener('click', abrirListaCatedra);
  document.getElementById('btn-buscar-lista')?.addEventListener('click', procesarListaCatedra);
  document.getElementById('btn-agregar-lista-carrito')?.addEventListener('click', agregarListaCatedraAlCarrito);
  document.getElementById('btn-editar-lista')?.addEventListener('click', volverAEditarListaCatedra);
  document.getElementById('btn-ver-favoritos')?.addEventListener('click', abrirFavoritosModal);
  document.getElementById('btn-repetir-pedido')?.addEventListener('click', repetirUltimoPedido);

  const buscador = document.getElementById('buscador');
  if (buscador) {
    buscador.addEventListener('input', (e) => {
      const texto = buscador.value;
      mostrarSugerencias(texto);
      filtrarPorTexto(texto);
    });

    document.addEventListener('click', (ev)=>{
      const s = document.getElementById('sugerencias');
      if (!document.getElementById('buscador').contains(ev.target) && !s.contains(ev.target)) s.style.display = 'none';
    });
  }
});

function cambiarCantidad(boton, delta) {
  const producto = boton.closest('.producto');
  if (!producto) return;

  const input = producto.querySelector('.cantidad-input');
  let valor = parseInt(input.value) || 1;
  valor += delta;
  if (valor < 1) valor = 1;
  input.value = valor;
}


window.agregarAlCarrito = agregarAlCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.cambiarCantidad = cambiarCantidad;
window.mostrarModalInfo = mostrarModalInfo;
window.cerrarModalInfo = cerrarModalInfo;
window.toggleFavorito = toggleFavorito;

setInterval(guardarCarritoEnLocalStorage, 3000);

// -------------------------------
// PRODUCTOS RELACIONADOS
// -------------------------------

function mostrarProductosRelacionados() {

  const contenedor = document.getElementById("productos-relacionados");
  if (!contenedor) return;

  contenedor.innerHTML = "";

  if (carrito.length === 0) return;

  const categoriasCarrito = carrito.map(item => {
    const prod = productos.find(p => p.nombre === item.nombre);
    return prod?.categoria;
  });

  const categoriasUnicas = [...new Set(categoriasCarrito)];

  const relacionados = productos
    .filter(p => categoriasUnicas.includes(p.categoria))
    .filter(p => !carrito.some(c => c.nombre === p.nombre))
    .slice(0,4);

  if (relacionados.length === 0) return;

  contenedor.innerHTML = `
    <div class="relacionados-container">
      <div class="relacionados-titulo">También te puede interesar</div>
      <div class="relacionados-grid">
      ${relacionados.map(p => `
        <div class="relacionado-item">
          <img src="${p.imagen || 'https://via.placeholder.com/80'}">
          <div style="font-size:0.75rem">${p.nombre}</div>
          <div style="font-weight:bold;font-size:0.8rem">$${p.precio.toLocaleString()}</div>
          <button onclick="agregarRelacionado('${p.nombre}', ${p.precio})">
            Agregar
          </button>
        </div>
      `).join("")}
      </div>
    </div>
  `;
}

function agregarRelacionado(nombre, precio){

  const existente = carrito.find(item => item.nombre === nombre);

  if (existente){
    existente.cantidad += 1;
  } else {
    carrito.push({nombre, precio, cantidad:1});
  }

  guardarCarritoEnLocalStorage();
  actualizarCarrito();
  mostrarProductosRelacionados();
}

// =====================================================
// CARGAR LISTA DE LA CÁTEDRA
// =====================================================

// --- Normaliza texto para poder compararlo sin importar tildes, mayúsculas o puntuación ---
function normalizarTexto(texto) {
  return (texto || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Similitud por palabras en común entre dos textos ya normalizados (0 a 1) ---
function similitudPalabras(a, b) {
  const palabrasA = new Set(a.split(' ').filter(Boolean));
  const palabrasB = new Set(b.split(' ').filter(Boolean));
  if (palabrasA.size === 0 || palabrasB.size === 0) return 0;
  let interseccion = 0;
  palabrasA.forEach(p => { if (palabrasB.has(p)) interseccion++; });
  const union = new Set([...palabrasA, ...palabrasB]).size;
  return interseccion / union;
}

// --- Busca el producto que mejor matchea una línea de texto de una lista de cátedra ---
// Devuelve { producto } si hay un match confiable, o { sugerencias: [...] } si no.
function buscarProductoParaLista(lineaTexto) {
  const norm = normalizarTexto(lineaTexto);
  if (!norm) return null;

  // 1) Match exacto
  const exacto = productos.find(p => normalizarTexto(p.nombre) === norm);
  if (exacto) return { producto: exacto };

  // 2) Contención: el nombre del producto está contenido en el texto, o viceversa
  //    (ej: "Clamp B4 A" contiene "B4 A"). Priorizamos el nombre más largo que matchee,
  //    para evitar que un nombre muy corto matchee de más.
  const candidatosContencion = productos
    .filter(p => {
      const nombreNorm = normalizarTexto(p.nombre);
      return nombreNorm.length >= 3 && (norm.includes(nombreNorm) || nombreNorm.includes(norm));
    })
    .sort((a, b) => normalizarTexto(b.nombre).length - normalizarTexto(a.nombre).length);

  if (candidatosContencion.length > 0) return { producto: candidatosContencion[0] };

  // 3) Similitud aproximada por palabras en común (respaldo para tipeos o diferencias menores)
  const puntuados = productos
    .map(p => ({ producto: p, score: similitudPalabras(norm, normalizarTexto(p.nombre)) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (puntuados.length > 0 && puntuados[0].score >= 0.6) {
    return { producto: puntuados[0].producto };
  }

  // No hay match confiable: devolvemos hasta 3 sugerencias para elegir a mano
  return { sugerencias: puntuados.slice(0, 3).map(x => x.producto) };
}

let listaCatedraItems = [];
let listaCatedraContadorId = 0;

function abrirListaCatedra() {
  document.getElementById('lista-catedra-texto').value = '';
  listaCatedraItems = [];
  document.getElementById('lista-catedra-paso1').style.display = 'block';
  document.getElementById('lista-catedra-resultado').style.display = 'none';
  document.getElementById('lista-catedra-modal').style.display = 'flex';
}

function cerrarListaCatedra() {
  document.getElementById('lista-catedra-modal').style.display = 'none';
}

function volverAEditarListaCatedra() {
  document.getElementById('lista-catedra-paso1').style.display = 'block';
  document.getElementById('lista-catedra-resultado').style.display = 'none';
}

function procesarListaCatedra() {
  const texto = document.getElementById('lista-catedra-texto').value;
  const lineas = texto.split('\n').map(l => l.trim()).filter(l => l !== '');

  if (lineas.length === 0) {
    alert('Pegá o escribí al menos un producto.');
    return;
  }

  listaCatedraItems = lineas.map(linea => {
    const resultado = buscarProductoParaLista(linea);
    listaCatedraContadorId++;
    if (resultado && resultado.producto) {
      return { id: listaCatedraContadorId, tipo: 'match', producto: resultado.producto, cantidad: 1, textoOriginal: linea };
    }
    return {
      id: listaCatedraContadorId,
      tipo: 'noencontrado',
      textoOriginal: linea,
      sugerencias: (resultado && resultado.sugerencias) || []
    };
  });

  document.getElementById('lista-catedra-paso1').style.display = 'none';
  document.getElementById('lista-catedra-resultado').style.display = 'block';
  renderizarListaCatedra();
}

function renderizarListaCatedra() {
  const contenedor = document.getElementById('lista-catedra-items');
  contenedor.innerHTML = '';
  let total = 0;

  listaCatedraItems.forEach(item => {
    const div = document.createElement('div');

    if (item.tipo === 'match') {
      total += item.producto.precio * item.cantidad;
      div.className = 'lista-item';
      div.innerHTML = `
        <div class="lista-item-nombre">${item.producto.nombre}</div>
        <div class="lista-item-controles">
          <button type="button" onclick="cambiarCantidadListaCatedra(${item.id}, -1)">−</button>
          <span class="lista-item-cantidad">${item.cantidad}</span>
          <button type="button" onclick="cambiarCantidadListaCatedra(${item.id}, 1)">+</button>
        </div>
        <div class="lista-item-precio">$${(item.producto.precio * item.cantidad).toLocaleString()}</div>
        <button type="button" class="lista-item-quitar" onclick="quitarDeListaCatedra(${item.id})" title="Quitar">&times;</button>
      `;
    } else {
      div.className = 'lista-item-noencontrado';
      const sugerenciasHTML = item.sugerencias.length > 0
        ? `<div class="lista-sugerencias">
            ${item.sugerencias.map(s => `<button type="button" class="lista-sugerencia-btn" onclick="elegirSugerenciaLista(${item.id}, '${s.nombre.replace(/'/g, "\\'")}')">${s.nombre}</button>`).join('')}
           </div>`
        : `<div style="font-size:0.8rem; color:var(--texto-secundario); margin-bottom:6px;">No encontramos sugerencias parecidas.</div>`;

      div.innerHTML = `
        <div class="lista-item-noencontrado-texto">
          ⚠️ No se encontró: "<strong>${item.textoOriginal}</strong>" — ¿quisiste decir?
        </div>
        ${sugerenciasHTML}
        <button type="button" class="lista-item-quitar-texto" onclick="quitarDeListaCatedra(${item.id})">Quitar de la lista</button>
      `;
    }

    contenedor.appendChild(div);
  });

  document.getElementById('lista-catedra-total-monto').textContent = '$' + total.toLocaleString();
}

function cambiarCantidadListaCatedra(id, delta) {
  const item = listaCatedraItems.find(i => i.id === id);
  if (!item) return;
  item.cantidad += delta;
  if (item.cantidad < 1) item.cantidad = 1;
  renderizarListaCatedra();
}

function quitarDeListaCatedra(id) {
  listaCatedraItems = listaCatedraItems.filter(i => i.id !== id);
  renderizarListaCatedra();
}

function elegirSugerenciaLista(id, nombreProducto) {
  const item = listaCatedraItems.find(i => i.id === id);
  if (!item) return;
  const producto = productos.find(p => p.nombre === nombreProducto);
  if (!producto) return;
  item.tipo = 'match';
  item.producto = producto;
  item.cantidad = 1;
  renderizarListaCatedra();
}

function agregarListaCatedraAlCarrito() {
  const itemsAAgregar = listaCatedraItems.filter(i => i.tipo === 'match');

  if (itemsAAgregar.length === 0) {
    alert('No hay productos para agregar. Revisá la lista.');
    return;
  }

  itemsAAgregar.forEach(item => {
    const existente = carrito.find(c => c.nombre === item.producto.nombre);
    if (existente) {
      existente.cantidad += item.cantidad;
    } else {
      carrito.push({ nombre: item.producto.nombre, precio: item.producto.precio, cantidad: item.cantidad });
    }
  });

  guardarCarritoEnLocalStorage();
  actualizarCarrito();
  animarCarrito();
  mostrarPopup();
  cerrarListaCatedra();
}

window.cambiarCantidadListaCatedra = cambiarCantidadListaCatedra;
window.quitarDeListaCatedra = quitarDeListaCatedra;
window.elegirSugerenciaLista = elegirSugerenciaLista;
function generarNumeroPedido() {
  const ahora = new Date();

  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  const hora = String(ahora.getHours()).padStart(2, '0');
  const minuto = String(ahora.getMinutes()).padStart(2, '0');
  const segundos = String(ahora.getSeconds()).padStart(2, '0');

  return `${mes}${dia}${hora}${minuto}${segundos}`;
}