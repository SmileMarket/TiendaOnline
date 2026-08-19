const URL_PEDIDOS_WEB = "https://script.google.com/macros/s/AKfycbwZufXHX4nwp0y0T1yhGjL3NKoDZtfCCBZ2bU8vBz9I2DC84WPaUEWtTHjLo3nX_815/exec";

// ✅ NUEVO: monto mínimo de compra (en pesos, sobre el total con descuento ya
// aplicado) a partir del cual se le ofrece un regalo gratis al cliente.
// Cambiá este número cuando quieras ajustar el umbral.
const UMBRAL_REGALO = 100000;

const carrito = [];
let productos = [];
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
// ✅ NUEVO: frases tiernas/graciosas con temática dental para la pantalla de
// carga inicial, elegidas al azar cada vez que se entra a la página (así no
// se siente repetitivo para quien vuelve seguido). Todas neutras en género.
const MENSAJES_SPLASH = [
  'Cepillando los últimos detalles... 🪥',
  'Puliendo tu experiencia ✨',
  'La muelita se está peinando 💫',
  'Cargando con mucho cariño 💕',
  'Preparando sonrisas 😊',
  'Un segundito, ya casi está el brillo ✨',
  'Endulzando la espera (sin caries) 🍬🦷',
  'Ajustando hasta el último tornillito 🔧🦷',
  'La muelita está calentando para bailar 🕺🦷',
];

function iniciarSplash() {
  const splash = document.getElementById('splash');
  const barra = document.getElementById('barra-progreso');
  const mensajeEl = document.getElementById('splash-mensaje');
  if (!splash || !barra) return;
  splash.style.display = 'flex';
  if (mensajeEl) {
    mensajeEl.textContent = MENSAJES_SPLASH[Math.floor(Math.random() * MENSAJES_SPLASH.length)];
  }
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

// ✅ NUEVO: overlay reusable de "espere por favor" para cualquier acción que
// tarde un ratito (confirmar pedido, buscar por celular, etc.). A diferencia
// del splash (que es solo para la carga inicial de la página), este se puede
// mostrar y ocultar las veces que haga falta durante el uso normal del sitio.
function mostrarCargando(mensaje) {
  const overlay = document.getElementById('overlay-cargando');
  const texto = document.getElementById('overlay-cargando-texto');
  if (!overlay) return;
  if (texto) texto.textContent = mensaje || 'Espere por favor...';
  overlay.style.display = 'flex';
}

function ocultarCargando() {
  const overlay = document.getElementById('overlay-cargando');
  if (overlay) overlay.style.display = 'none';
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
      imagenesExtra: producto.imagenesextra
        ? producto.imagenesextra.split('|').map(s => s.trim()).filter(Boolean)
        : [],
      stock: parseInt(producto.stock) || 0,
      nuevo: producto.nuevo === 'TRUE',
      masvendido: producto.masvendido === 'TRUE',
      recomendado: producto.recomendado === 'TRUE',
      // ✅ NUEVO: marcá "TRUE" en la columna "esregalo" de la planilla para que
      // ese producto aparezca como opción de regalo en compras que superen el
      // monto mínimo (ver UMBRAL_REGALO más abajo). Lo ideal es tener 2-3
      // marcados a la vez, para no saturar la pantalla de elección.
      // ✅ NUEVO: sistema de ofertas por tiempo limitado. En la planilla de
      // productos agregá 2 columnas nuevas:
      //   - "precioOferta": el precio con descuento (dejar vacío o en 0 si
      //     el producto no está en oferta).
      //   - "ofertaHasta": fecha (y opcionalmente hora) hasta la que vale la
      //     oferta, formato "dd/mm/aaaa" o "dd/mm/aaaa hh:mm" (ej: "20/08/2026"
      //     o "20/08/2026 23:59"). Si la dejás vacía, la oferta NO vence sola
      //     — queda activa hasta que vos borres el precioOferta a mano.
      precioOferta: parseFloat(producto.preciooferta) || 0,
      ofertaHasta: producto.ofertahasta || ''
    };
  });
}

// ✅ NUEVO: convierte el texto de la columna "ofertaHasta" (dd/mm/aaaa o
// dd/mm/aaaa hh:mm) en una fecha real de JS. Devuelve null si el texto está
// vacío o mal escrito (en ese caso, la oferta se trata como "sin vencimiento").
function parsearFechaOferta(texto) {
  if (!texto || !texto.trim()) return null;
  const partes = texto.trim().split(' ');
  const [d, m, y] = (partes[0] || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  let hh = 23, mm = 59;
  if (partes[1]) {
    const [h2, m2] = partes[1].split(':').map(Number);
    if (!isNaN(h2)) hh = h2;
    if (!isNaN(m2)) mm = m2;
  }
  const fecha = new Date(y, m - 1, d, hh, mm, 0);
  return isNaN(fecha.getTime()) ? null : fecha;
}

// ✅ NUEVO: dice si un producto está EN OFERTA en este momento — precio de
// oferta cargado, menor al precio normal, y (si tiene fecha límite) que esa
// fecha todavía no pasó.
function productoEnOferta(producto) {
  if (!producto || !producto.precioOferta || producto.precioOferta <= 0) return false;
  if (producto.precioOferta >= producto.precio) return false;
  if (producto.ofertaHasta) {
    const fechaLimite = parsearFechaOferta(producto.ofertaHasta);
    if (fechaLimite && new Date() > fechaLimite) return false;
  }
  return true;
}

// ✅ NUEVO: precio que realmente se cobra — el de oferta si está vigente,
// si no el de siempre. Usar SIEMPRE esta función (no producto.precio a
// secas) en cualquier lugar donde se agregue algo al carrito o se calculen
// totales, para que la oferta se aplique de verdad y no solo se vea linda.
function precioFinal(producto) {
  return productoEnOferta(producto) ? producto.precioOferta : producto.precio;
}

// ✅ NUEVO: porcentaje de descuento redondeado, para la cinta roja ("-25%").
function porcentajeOferta(producto) {
  return Math.round((1 - producto.precioOferta / producto.precio) * 100);
}

// ✅ NUEVO: arma el bloque de precio para una tarjeta de producto — si está
// en oferta, muestra el precio original tachado + el nuevo resaltado; si
// no, el precio normal de siempre. Se usa en las 3 grillas (catálogo, Top
// 10, favoritos) para no repetir la lógica en cada una por separado.
function precioHTML(producto) {
  if (productoEnOferta(producto)) {
    return `<p class="precio precio-oferta-wrap">
      <span class="precio-tachado">$ ${producto.precio.toLocaleString("es-AR")},00</span>
      <span class="precio-nuevo">$ ${producto.precioOferta.toLocaleString("es-AR")},00</span>
    </p>`;
  }
  return `<p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>`;
}

// ✅ NUEVO: la cinta diagonal roja con el % de descuento, para poner dentro
// del contenedor de la imagen del producto (igual que el aviso de "SIN
// STOCK"). Devuelve string vacío si el producto no está en oferta.
function cintaOfertaHTML(producto) {
  if (!productoEnOferta(producto)) return '';
  if (producto.stock <= 0) return ''; // no tiene sentido mostrar oferta de algo sin stock
  return `<div class="cinta-oferta"><span>-${porcentajeOferta(producto)}%</span></div>`;
}

// ❌ SACADO: cargarCuponesDesdeGoogleSheet() — se eliminó el sistema de
// cupones normales (códigos genéricos tipo "VERANO10"). Ahora el único
// mecanismo de descuento es el programa de referidos por celular, que ya
// se revalida del lado del servidor, así queda todo concentrado en un
// solo camino, más fácil de blindar contra abusos.

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
  const nombreAtributo = (nombre || '').replace(/"/g, '&quot;');
  return `<button type="button" class="favorito-btn${activo ? ' favorito-activo' : ''}" data-nombre="${nombreAtributo}" onclick="event.stopPropagation(); toggleFavorito(this, '${nombreEscapado}')" aria-label="Guardar en favoritos">${activo ? '♥' : '♡'}</button>`;
}

// Genera el botón de "compartir por WhatsApp" para insertar dentro de la tarjeta de producto
function compartirBtnHTML(nombre, precio) {
  const nombreEscapado = (nombre || '').replace(/'/g, "\\'");
  return `<button type="button" class="compartir-btn" onclick="event.stopPropagation(); compartirProducto('${nombreEscapado}', ${precio})" aria-label="Compartir por WhatsApp">↗</button>`;
}

function compartirProducto(nombre, precio) {
  const precioTexto = Number(precio).toLocaleString('es-AR');
  const mensaje = `¡Mirá esto que encontré en SmileMarket! 🦷\n\n${nombre} - $${precioTexto}\n\nhttps://smilemarket.github.io/TiendaOnline/`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

function toggleFavorito(boton, nombre) {
  let favoritos = obtenerFavoritos();
  const yaEsFavorito = favoritos.includes(nombre);

  favoritos = yaEsFavorito ? favoritos.filter(n => n !== nombre) : [...favoritos, nombre];
  guardarFavoritos(favoritos);

  // ✅ CORREGIDO: el mismo producto puede tener un botón de corazón en varios
  // lugares a la vez (grilla principal, carrusel de Top 10, modal de favoritos).
  // Antes solo actualizábamos el botón que se clickeó puntualmente, así que si
  // desmarcabas un favorito DESDE el modal, el corazón de la grilla principal
  // quedaba "colgado" marcado. Ahora actualizamos TODAS las instancias de ese
  // mismo producto en la página, usando el atributo data-nombre para encontrarlas.
  try {
    document.querySelectorAll(`.favorito-btn[data-nombre="${CSS.escape(nombre)}"]`).forEach(btn => {
      btn.textContent = yaEsFavorito ? '♡' : '♥';
      btn.classList.toggle('favorito-activo', !yaEsFavorito);
    });
  } catch (e) {
    // Fallback por si CSS.escape no está disponible: al menos actualizamos el botón clickeado
    if (boton) {
      boton.textContent = yaEsFavorito ? '♡' : '♥';
      boton.classList.toggle('favorito-activo', !yaEsFavorito);
    }
  }

  // Si el modal de favoritos está abierto, lo refrescamos para que se note el cambio al toque
  const modal = document.getElementById('favoritos-modal');
  if (modal && modal.style.display === 'flex') {
    abrirFavoritosModal();
  }
}

// --- Arma una tarjeta de producto igual a la del catálogo (imagen, precio,
// controles de cantidad y botón "Agregar al carrito" funcionando exactamente
// igual que en la grilla principal). Reusada por Favoritos y por el popup
// de Ofertas, para no duplicar esta lógica en cada lugar. ---
function crearTarjetaProducto(producto) {
  const div = document.createElement('div');
  div.className = 'producto';
  div.dataset.nombre = producto.nombre;
  div.dataset.precio = precioFinal(producto);
  div.dataset.descripcion = producto.descripcion;
  div.dataset.categoria = producto.categoria;

  const galeria = [producto.imagen, ...(producto.imagenesExtra || [])].filter(Boolean);

  const imagenHTML = producto.imagen ? `
    <div class="producto-imagen-container" data-nombre="${producto.nombre}" data-descripcion="${producto.descripcion || 'Sin descripción disponible'}" data-galeria='${JSON.stringify(galeria)}' onclick="abrirGaleria(this)">
      <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:140px; object-fit:contain; background:white;" />
      ${cintaOfertaHTML(producto)}
      ${favoritoBtnHTML(producto.nombre)}
      ${compartirBtnHTML(producto.nombre, producto.precio)}
      ${producto.stock <= 0 ? '<div class="sin-stock-overlay">SIN STOCK</div>' : ''}
    </div>` : '';

  div.innerHTML = `
    ${imagenHTML}
    <h3>${producto.nombre}</h3>
    <p class="categoria-texto">${producto.categoria}</p>
    ${precioHTML(producto)}
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
      contenedor.appendChild(crearTarjetaProducto(producto));
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

// --- Historial de pedidos (para que el cliente pueda revisar N° de pedido, fecha y total) ---
function guardarEnHistorialPedidos(numeroPedido, total, formaPago) {
  try {
    const items = carrito.map(i => ({ nombre: i.nombre, cantidad: i.cantidad }));
    const nuevoPedido = {
      numeroPedido,
      fecha: new Date().toLocaleString('es-AR'),
      total,
      formaPago,
      items
    };

    const historial = obtenerHistorialPedidos();
    historial.unshift(nuevoPedido); // el más nuevo primero
    const historialRecortado = historial.slice(0, 20); // guardamos como máximo los últimos 20

    localStorage.setItem('smilemarket_historial_pedidos', JSON.stringify(historialRecortado));
  } catch (e) { console.warn('No se pudo guardar el historial de pedidos', e); }
}

function obtenerHistorialPedidos() {
  try {
    const raw = localStorage.getItem('smilemarket_historial_pedidos');
    const lista = raw ? JSON.parse(raw) : [];
    return Array.isArray(lista) ? lista : [];
  } catch (e) { return []; }
}

// ✅ ACTUALIZADO: "Mis pedidos" ahora busca por celular (funciona desde
// cualquier dispositivo), en vez de depender únicamente de la lista de
// números de pedido guardada en el localStorage de este navegador.
async function abrirHistorialPedidos() {
  const modal = document.getElementById('historial-pedidos-modal');
  const inputCelular = document.getElementById('historial-celular-input');
  if (!modal || !inputCelular) return;

  modal.style.display = 'flex';

  // Autocompletar: si ya sabemos el celular de una compra anterior en este
  // dispositivo, lo precargamos y buscamos directo, sin pedirle nada al cliente.
  const celularGuardado = obtenerCelularCliente();
  if (celularGuardado && celularGuardado !== '+549') {
    inputCelular.value = celularGuardado;
    bloquearPrefijoCelular('historial-celular-input');
    await buscarMisPedidosPorCelular();
  } else {
    inputCelular.value = '+549';
    bloquearPrefijoCelular('historial-celular-input');
    document.getElementById('historial-pedidos-lista').innerHTML = '';
    document.getElementById('historial-pedidos-vacio').style.display = 'block';
    document.getElementById('historial-pedidos-vacio').innerHTML =
      'Ingresá tu celular arriba y tocá "Buscar" para ver tus pedidos.';
  }
}

// ✅ NUEVO: dispara la búsqueda por celular (botón "Buscar" del modal, o
// automático al abrir el modal si ya teníamos el celular guardado).
async function buscarMisPedidosPorCelular() {
  const inputCelular = document.getElementById('historial-celular-input');
  const contenedor = document.getElementById('historial-pedidos-lista');
  const vacio = document.getElementById('historial-pedidos-vacio');
  if (!inputCelular || !contenedor || !vacio) return;

  const celular = inputCelular.value.trim();
  if (!celular || celular === '+549') {
    alert('Ingresá tu celular para poder buscar tus pedidos.');
    return;
  }

  // Guardamos el celular en este dispositivo para la próxima vez (mismo
  // mecanismo que ya usa el checkout, así queda todo consistente).
  guardarCelularCliente(celular);

  vacio.style.display = 'none';
  contenedor.innerHTML = '<div style="text-align:center; color:var(--texto-secundario); font-size:0.85rem; padding:14px 0;">Buscando tus pedidos...</div>';
  mostrarCargando('Buscando tus pedidos...');

  let respuesta;
  try {
    respuesta = await consultarPedidosPorCelular(celular);
  } finally {
    ocultarCargando();
  }

  if (!respuesta) {
    // Sin conexión o falló la consulta: no decimos "no tenés pedidos", avisamos
    // el problema real para no generar alarma con un dato que no pudimos verificar.
    contenedor.innerHTML = '';
    vacio.style.display = 'block';
    vacio.innerHTML = 'No pudimos consultar tus pedidos ahora (revisá tu conexión) y volvé a tocar "Buscar".';
    return;
  }

  const pedidos = respuesta.pedidos || [];

  if (pedidos.length === 0) {
    contenedor.innerHTML = '';
    vacio.style.display = 'block';
    vacio.innerHTML = 'No encontramos pedidos para ese celular.';
    return;
  }

  vacio.style.display = 'none';
  contenedor.innerHTML = '';

  pedidos.forEach(pedido => {
    contenedor.appendChild(renderTarjetaPedidoServidor(pedido));
  });
}

// Arma la tarjeta de un pedido a partir de lo que devuelve el backend
// (pedidosPorCelular): { pedido, cliente, fecha, formaPago, estado, items, total }
function renderTarjetaPedidoServidor(pedido) {
  const div = document.createElement('div');
  div.className = 'historial-pedido-item';

  const fechaFormateada = pedido.fecha
    ? new Date(pedido.fecha).toLocaleDateString('es-AR')
    : '';

  const itemsHTML = pedido.items
    .map(i => `<div>${i.producto} <strong>x${i.cantidad}</strong></div>`)
    .join('');

  let badgeHTML = '';
  let botonAccionHTML = '';

  if (pedido.estado === 'entregado') {
    badgeHTML = ' · <span class="historial-pedido-badge historial-pedido-badge-entregado">✅ Entregado</span>';
    botonAccionHTML = `<button type="button" class="historial-pedido-repetir" onclick='repetirPedidoDesdeHistorial(${JSON.stringify(pedido.items)})'>🔁 Repetir este pedido</button>`;
  } else if (pedido.estado === 'anulado') {
    badgeHTML = ' · <span class="historial-pedido-badge historial-pedido-badge-anulado">❌ Anulado</span>';
    const mensajeConsulta = `Hola! Quiero consultar por mi pedido #${pedido.pedido}, no lo encuentro activo en el sistema. ¿Podemos revisarlo?`;
    botonAccionHTML = `<button type="button" class="historial-pedido-consultar" onclick="window.open('https://wa.me/5491130335334?text=${encodeURIComponent(mensajeConsulta)}', '_blank')">💬 Consultar sobre este pedido</button>`;
  } else {
    badgeHTML = ' · <span class="historial-pedido-badge historial-pedido-badge-proceso">🔄 En proceso</span>';
    const mensajeModificar = `Hola! Quiero agregar o modificar algo de mi pedido #${pedido.pedido}`;
    botonAccionHTML = `<button type="button" class="historial-pedido-modificar" onclick="window.open('https://wa.me/5491130335334?text=${encodeURIComponent(mensajeModificar)}', '_blank')">✏️ Modificar o agregar algo a este pedido</button>`;
  }

  div.innerHTML = `
    <div class="historial-pedido-header">
      <strong>Pedido #${pedido.pedido}</strong>
      <span>$${Number(pedido.total).toLocaleString('es-AR')}</span>
    </div>
    <div class="historial-pedido-fecha">${fechaFormateada} · ${pedido.formaPago || ''}${badgeHTML}</div>
    <div class="historial-pedido-items">${itemsHTML}</div>
    ${botonAccionHTML}
  `;
  return div;
}

function cerrarHistorialPedidos() {
  document.getElementById('historial-pedidos-modal').style.display = 'none';
}

// --- Vuelve a agregar al carrito los productos de un pedido puntual del historial ---
// Acepta items con la forma { producto, cantidad } (como devuelve el backend nuevo)
// o { nombre, cantidad } (formato viejo del historial local), por las dudas.
// --- Vuelve a agregar al carrito los productos de un pedido puntual del historial ---
// Reutiliza aplicarRepeticionDePedido (misma lógica que "Repetir mi último pedido"),
// solo que acá además cerramos el modal de "Mis pedidos" al terminar.
function repetirPedidoDesdeHistorial(items) {
  aplicarRepeticionDePedido(items);
  cerrarHistorialPedidos();
}

// --- Vacía el carrito después de confirmar un pedido ---
function vaciarCarrito() {
  carrito.length = 0;
  guardarCarritoEnLocalStorage();
  actualizarCarrito();

  // Cerramos el panel del carrito si quedó abierto
  document.getElementById('carrito')?.classList.remove('mostrar');
}

// ✅ ACTUALIZADO: ahora sigue el mismo patrón que "Mis pedidos" — se abre un
// modal chico pidiendo el celular (autocompletado si ya lo tenés guardado en
// este dispositivo, o vacío para que lo cargues si es la primera vez o
// cambiaste de dispositivo), y recién con eso se busca el pedido más
// reciente real en el backend. Así el cliente siempre sabe con qué celular
// está consultando, en vez de que quede "adivinado" en segundo plano.
function abrirRepetirPedidoModal() {
  const modal = document.getElementById('repetir-pedido-modal');
  const inputCelular = document.getElementById('repetir-celular-input');
  const vacio = document.getElementById('repetir-pedido-vacio');
  if (!modal || !inputCelular) return;

  vacio.style.display = 'none';
  vacio.textContent = '';
  modal.style.display = 'flex';

  const celularGuardado = obtenerCelularCliente();
  if (celularGuardado && celularGuardado !== '+549') {
    inputCelular.value = celularGuardado;
    bloquearPrefijoCelular('repetir-celular-input');
    // Ya lo conocemos en este dispositivo: buscamos y repetimos directo, sin pedirle nada más.
    buscarYRepetirUltimoPedido();
  } else {
    inputCelular.value = '+549';
    bloquearPrefijoCelular('repetir-celular-input');
  }
}

function cerrarRepetirPedidoModal() {
  document.getElementById('repetir-pedido-modal').style.display = 'none';
}

async function buscarYRepetirUltimoPedido() {
  const inputCelular = document.getElementById('repetir-celular-input');
  const vacio = document.getElementById('repetir-pedido-vacio');
  if (!inputCelular || !vacio) return;

  const celular = inputCelular.value.trim();
  if (!celular || celular === '+549') {
    alert('Ingresá tu celular para poder buscar tu último pedido.');
    return;
  }

  // Lo guardamos en este dispositivo para la próxima vez (mismo mecanismo
  // que ya usa el checkout y "Mis pedidos", todo consistente).
  guardarCelularCliente(celular);

  vacio.style.display = 'block';
  vacio.textContent = 'Buscando tu último pedido...';
  mostrarCargando('Buscando tu último pedido...');

  let respuesta;
  try {
    respuesta = await consultarPedidosPorCelular(celular);
  } finally {
    ocultarCargando();
  }

  if (!respuesta) {
    vacio.textContent = 'No pudimos consultar tus pedidos ahora (revisá tu conexión) y volvé a tocar "Repetir".';
    return;
  }

  const pedidos = respuesta.pedidos || [];
  if (pedidos.length === 0) {
    vacio.textContent = 'No encontramos pedidos anteriores para ese celular.';
    return;
  }

  // Ya viene ordenado por fecha (el más reciente primero)
  aplicarRepeticionDePedido(pedidos[0].items);
  cerrarRepetirPedidoModal();
}

// Toma un array de items ({producto, cantidad} o {nombre, cantidad}) y los
// carga al carrito, respetando stock disponible. Compartida por "Repetir
// último pedido" y "Repetir este pedido" (desde Mis pedidos).
function aplicarRepeticionDePedido(items) {
  if (!items || items.length === 0) return;

  // ✅ NUEVO: los ítems marcados "gratis" (el regalo de una compra anterior
  // que superó el monto mínimo) NO se repiten — fueron un incentivo puntual
  // de esa compra, no algo para volver a sumar cada vez que se repite el pedido.
  const itemsComprables = items.filter(item => !item.gratis);
  const huboRegaloExcluido = itemsComprables.length < items.length;

  if (itemsComprables.length === 0) {
    mostrarPopup('Ese pedido era solo el regalo, no hay nada más para repetir 🎁');
    return;
  }

  let agregados = 0;
  const noDisponibles = [];

  itemsComprables.forEach(item => {
    const nombreItem = item.producto || item.nombre;
    const producto = productos.find(p => p.nombre === nombreItem);
    if (!producto || producto.stock <= 0) {
      noDisponibles.push(nombreItem);
      return;
    }

    const cantidadFinal = Math.min(item.cantidad, producto.stock);
    const existente = carrito.find(c => c.nombre === producto.nombre);
    if (existente) {
      // Fijamos la cantidad del pedido repetido (no sumamos), así tocar el botón
      // varias veces no va acumulando cantidades de más.
      existente.cantidad = cantidadFinal;
    } else {
      carrito.push({ nombre: producto.nombre, precio: precioFinal(producto), cantidad: cantidadFinal });
    }
    agregados++;
  });

  guardarCarritoEnLocalStorage();
  actualizarCarrito();
  animarCarrito();

  // Abrimos el panel del carrito para que vea qué se cargó y pueda ajustarlo si quiere
  document.getElementById('carrito')?.classList.add('mostrar');

  if (agregados > 0 && noDisponibles.length === 0) {
    mostrarPopup(huboRegaloExcluido
      ? '¡Agregamos tu último pedido al carrito (menos el regalo)! 🔁'
      : '¡Agregamos tu último pedido al carrito! 🔁');
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

    // ✅ CORREGIDO (bug preexistente, no relacionado a las ofertas): los
    // ítems de regalo tienen un nombre con emoji ("🎁 ... (regalo)") que
    // nunca matchea con productos.find() de abajo, así que sin este chequeo
    // se borraban solos del carrito la próxima vez que se sincronizaba.
    if (item.esRegalo) continue;

    const productoActual = productos.find(p => p.nombre === item.nombre);

    if (!productoActual) {
      eliminadosNoExiste.push(item.nombre);
      carrito.splice(i, 1);
      huboCambios = true;
      continue;
    }

    // ✅ NUEVO: si el producto está en oferta, el carrito tiene que reflejar
    // el precio de oferta (no el de siempre) — y al revés, si la oferta ya
    // venció desde que se agregó al carrito, vuelve sola al precio normal.
    const precioVigente = precioFinal(productoActual);
    if (precioVigente !== item.precio) {
      item.precio = precioVigente;
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

// --- Envía un evento a Google Analytics, sin romper nada si Analytics no cargó (ej. adblockers) ---
function trackEvento(nombre, params) {
  try {
    if (typeof gtag === 'function') {
      gtag('event', nombre, params || {});
    }
  } catch (e) { /* nunca dejamos que un error de analytics rompa la compra */ }
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
  // ✅ NUEVO: animación de "vuelo" de la imagen del producto hasta el carrito.
  // Ella misma dispara el rebote del ícono (animarCarrito) al llegar.
  const imgProducto = producto.querySelector('.producto-imagen-container img');
  animarVueloAlCarrito(imgProducto);
  actualizarCarrito();
  trackEvento('add_to_cart', { currency: 'ARS', value: precio * cantidad, items: [{ item_name: nombre, quantity: cantidad, price: precio }] });
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  guardarCarritoEnLocalStorage();
  actualizarCarrito();
}

function actualizarCarrito() {
  // ✅ NUEVO: si hay un regalo elegido pero el resto del carrito (sin contar
  // el regalo, que siempre vale $0) ya no llega al monto mínimo, se lo
  // sacamos automáticamente y avisamos con un popup. Esto corre acá porque
  // actualizarCarrito() se llama SIEMPRE que el carrito cambia (agregar,
  // sacar, cambiar cantidad), así que es un único lugar centralizado.
  const totalSinRegalo = carrito
    .filter(item => !item.esRegalo)
    .reduce((acc, item) => acc + (Number(item.precio) * Number(item.cantidad)), 0);

  const teniaRegalo = carrito.some(item => item.esRegalo);
  if (teniaRegalo && totalSinRegalo < UMBRAL_REGALO) {
    for (let i = carrito.length - 1; i >= 0; i--) {
      if (carrito[i].esRegalo) carrito.splice(i, 1);
    }
    guardarCarritoEnLocalStorage();
    mostrarPopup('Se quitó tu regalo 🎁 porque el pedido bajó del monto mínimo');
  }

  const carritoItems = document.getElementById('carrito-items');
  carritoItems.innerHTML = '';
  let total = 0;
  let cantidadTotal = 0;

  carrito.forEach((item, index) => {
    const itemDiv = document.createElement('div');
    itemDiv.className = 'carrito-item';

    const controlesCantidad = item.esRegalo
      ? `<span style="font-size:0.8rem; color:var(--menta-oscuro); font-weight:600;">🎁 Regalo</span>`
      : `<div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
      <button type="button" onclick="cambiarCantidadCarrito(${index}, -1)" style="width:32px; height:32px; border:none; background:#ddd; border-radius:6px; font-size:1.2rem; cursor:pointer;">−</button>
      <input type="number" value="${item.cantidad}" min="1" style="width:48px; height:32px; text-align:center; font-weight:bold; border:1px solid #ccc; border-radius:6px;" onchange="cambiarCantidadCarritoInput(${index}, this.value)" />
      <button type="button" onclick="cambiarCantidadCarrito(${index}, 1)" style="width:32px; height:32px; border:none; background:#ddd; border-radius:6px; font-size:1.2rem; cursor:pointer;">+</button>
    </div>`;

    itemDiv.innerHTML = `
  <div style="flex:1; min-width:140px;">
    <div style="font-size:0.9rem;"><strong>${item.nombre}</strong></div>
    ${controlesCantidad}
  </div>
  <div style="min-width:70px; text-align:right; font-size:0.9rem;">${item.esRegalo ? 'Gratis' : '$' + (item.precio * item.cantidad).toLocaleString()}</div>
  <button type="button" onclick="eliminarDelCarrito(${index})" style="margin-left:6px; background:none; border:none; color:#d9534f; font-size:1.4rem; cursor:pointer;">&times;</button>
`;
    carritoItems.appendChild(itemDiv);
    total += item.precio * item.cantidad;
    cantidadTotal += item.cantidad;
  });

  document.getElementById('total').textContent = 'Total: $' + total.toLocaleString();
  document.getElementById('contador-carrito').textContent = cantidadTotal;
  actualizarProgresoRegalo(carrito, totalSinRegalo);
  totalGlobal = total;
}

// ✅ NUEVO: actualiza el cartel + barra de "te faltan $X para tu regalo"
// dentro del panel del carrito. Se llama desde actualizarCarrito() cada vez
// que el carrito cambia, así siempre queda al día.
function actualizarProgresoRegalo(carritoActual, totalSinRegalo) {
  const bloque = document.getElementById('regalo-progreso-bloque');
  const texto = document.getElementById('regalo-progreso-texto');
  const barra = document.getElementById('regalo-progreso-barra');
  if (!bloque || !texto || !barra) return;

  const carritoVacio = carritoActual.length === 0;
  const yaTieneRegalo = carritoActual.some(item => item.esRegalo);

  if (carritoVacio || yaTieneRegalo) {
    bloque.style.display = 'none';
    return;
  }

  if (totalSinRegalo >= UMBRAL_REGALO) {
    bloque.style.display = 'block';
    texto.textContent = '🎁 ¡Ya podés elegir tu regalo gratis! Lo vas a poder elegir al confirmar tu compra.';
    barra.style.width = '100%';
  } else {
    const faltante = UMBRAL_REGALO - totalSinRegalo;
    const porcentaje = Math.max(4, Math.min(100, (totalSinRegalo / UMBRAL_REGALO) * 100)); // mínimo 4% para que la barra siempre se note un poco
    bloque.style.display = 'block';
    texto.textContent = `Te faltan $${faltante.toLocaleString()} para tu regalo gratis 🎁`;
    barra.style.width = porcentaje + '%';
  }
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

let galeriaActual = [];
let galeriaIndiceActual = 0;

// Punto de entrada desde las tarjetas de producto: lee los datos desde el propio elemento
function abrirGaleria(contenedor) {
  const nombre = contenedor.dataset.nombre || '';
  const descripcion = contenedor.dataset.descripcion || '';
  let galeria = [];
  try {
    galeria = JSON.parse(contenedor.dataset.galeria || '[]');
  } catch (e) { galeria = []; }

  mostrarModalInfo(nombre, descripcion, galeria);
}

function mostrarModalInfo(nombre, descripcion, galeria) {
  document.getElementById('modal-titulo').textContent = nombre;
  document.getElementById('modal-descripcion').textContent = descripcion;

  // Compatibilidad: si alguien todavía llama a esto pasando una sola URL (string), la envolvemos en array
  if (typeof galeria === 'string') {
    galeria = galeria ? [galeria] : [];
  }
  galeriaActual = Array.isArray(galeria) ? galeria.filter(Boolean) : [];
  galeriaIndiceActual = 0;

  renderizarGaleria();

  document.getElementById('info-modal').style.display = 'flex';
}

function renderizarGaleria() {
  const imgEl = document.getElementById('modal-imagen');
  const puntos = document.getElementById('modal-galeria-puntos');
  const flechaIzq = document.getElementById('modal-galeria-izq');
  const flechaDer = document.getElementById('modal-galeria-der');
  if (!imgEl) return;

  if (galeriaActual.length === 0) {
    imgEl.style.display = 'none';
    imgEl.src = '';
    if (puntos) puntos.style.display = 'none';
    if (flechaIzq) flechaIzq.style.display = 'none';
    if (flechaDer) flechaDer.style.display = 'none';
    return;
  }

  imgEl.src = galeriaActual[galeriaIndiceActual];
  imgEl.style.display = 'block';

  const hayVarias = galeriaActual.length > 1;
  if (flechaIzq) flechaIzq.style.display = hayVarias ? 'flex' : 'none';
  if (flechaDer) flechaDer.style.display = hayVarias ? 'flex' : 'none';

  if (puntos) {
    puntos.style.display = hayVarias ? 'flex' : 'none';
    puntos.innerHTML = galeriaActual.map((_, i) =>
      `<span class="galeria-punto${i === galeriaIndiceActual ? ' activo' : ''}" onclick="irAFotoGaleria(${i})"></span>`
    ).join('');
  }
}

function cambiarFotoGaleria(delta) {
  if (galeriaActual.length === 0) return;
  galeriaIndiceActual = (galeriaIndiceActual + delta + galeriaActual.length) % galeriaActual.length;
  renderizarGaleria();
}

function irAFotoGaleria(indice) {
  galeriaIndiceActual = indice;
  renderizarGaleria();
}

// --- Swipe táctil para pasar de foto en mobile ---
function inicializarSwipeGaleria() {
  const contenedor = document.getElementById('modal-galeria-container');
  if (!contenedor) return;
  let touchStartX = 0;

  contenedor.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  contenedor.addEventListener('touchend', (e) => {
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(deltaX) > 40) {
      cambiarFotoGaleria(deltaX > 0 ? -1 : 1);
    }
  }, { passive: true });
}

function cerrarModalInfo() {
  document.getElementById('info-modal').style.display = 'none';
}

// ✅ NUEVO: clona la imagen del producto y la anima "volando" hasta el
// ícono del carrito, para dar feedback visual satisfactorio al agregar.
// Al llegar, dispara el "vibrar" del ícono (animarCarrito) para que la
// llegada se sienta sincronizada con el rebote del carrito.
function animarVueloAlCarrito(imgEl) {
  const destino = document.getElementById('carrito-icono');
  if (!imgEl || !destino) {
    animarCarrito();
    return;
  }

  const origenRect = imgEl.getBoundingClientRect();
  const destinoRect = destino.getBoundingClientRect();

  const clon = imgEl.cloneNode(true);
  clon.style.position = 'fixed';
  clon.style.left = origenRect.left + 'px';
  clon.style.top = origenRect.top + 'px';
  clon.style.width = origenRect.width + 'px';
  clon.style.height = origenRect.height + 'px';
  clon.style.borderRadius = '10px';
  clon.style.zIndex = '99998';
  clon.style.pointerEvents = 'none';
  clon.style.boxShadow = '0 6px 16px rgba(0,0,0,0.18)';
  clon.style.transition = 'transform 0.55s cubic-bezier(0.55,0,1,0.45), opacity 0.55s ease';
  clon.style.willChange = 'transform, opacity';
  document.body.appendChild(clon);

  // Traslación calculada como diferencia de centros, para poder animar con
  // transform (más fluido que animar left/top directamente).
  const dx = (destinoRect.left + destinoRect.width / 2) - (origenRect.left + origenRect.width / 2);
  const dy = (destinoRect.top + destinoRect.height / 2) - (origenRect.top + origenRect.height / 2);

  requestAnimationFrame(() => {
    clon.style.transform = `translate(${dx}px, ${dy}px) scale(0.15)`;
    clon.style.opacity = '0.35';
  });

  clon.addEventListener('transitionend', () => {
    clon.remove();
    animarCarrito();
  }, { once: true });
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

// --- Personalización con celular ---
function guardarCelularCliente(celular) {
  try {
    localStorage.setItem('smilemarket_celular', celular);
  } catch (e) { console.warn('No se pudo guardar el celular en localStorage', e); }
}

function obtenerCelularCliente() {
  try {
    return localStorage.getItem('smilemarket_celular') || '+549';
  } catch (e) { return '+549'; }
}

// --- Evita que el prefijo +549 se pueda borrar del campo celular ---
function bloquearPrefijoCelular(inputId) {
  const prefijo = '+549';
  const input = document.getElementById(inputId || 'celular-cliente');
  if (!input) return;

  const normalizar = () => {
    let soloDigitos = input.value.replace(/[^\d]/g, ''); // saca todo lo que no sea número (espacios, guiones, el +, etc.)
    if (soloDigitos.startsWith('549')) soloDigitos = soloDigitos.slice(3);
    else if (soloDigitos.startsWith('54')) soloDigitos = soloDigitos.slice(2);
    input.value = prefijo + soloDigitos;
  };

  input.addEventListener('input', normalizar);

  // Si el cursor queda dentro del prefijo (por click o flechas), lo mandamos justo después
  input.addEventListener('click', () => {
    if (input.selectionStart < prefijo.length) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
  input.addEventListener('keyup', () => {
    if (input.selectionStart < prefijo.length) {
      input.setSelectionRange(prefijo.length, prefijo.length);
    }
  });
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
// Guarda el pedido en la planilla y devuelve { ok: true/false } según si realmente se confirmó.
// Antes esto era "dispara y olvidate" (fetch sin esperar respuesta) — ahora se espera
// la confirmación real del servidor antes de dar el pedido por registrado.
// --- Consulta (solo lectura) si los pedidos ya están entregados/pagados/preparados ---
// Devuelve un objeto { numeroPedido: {encontrado, entregado, pagado, preparado} } o null si falla.
function consultarEstadoPedidos(numerosPedido) {
  if (!URL_PEDIDOS_WEB || URL_PEDIDOS_WEB.indexOf('PEGAR_AQUI') !== -1 || !numerosPedido || numerosPedido.length === 0) {
    return Promise.resolve(null);
  }
  const url = `${URL_PEDIDOS_WEB}?accion=estadoPedidos&pedidos=${encodeURIComponent(numerosPedido.join(','))}`;
  return fetch(url)
    .then(res => res.json())
    .then(data => (data && data.resultado === 'ok') ? data.estados : null)
    .catch(err => {
      console.warn('No se pudo consultar el estado de los pedidos', err);
      return null;
    });
}

// ✅ NUEVO: "Mis pedidos" unificado por celular — funciona desde cualquier
// dispositivo, ya no depende de que el pedido haya quedado guardado en el
// localStorage de ESTE navegador en particular.
// Devuelve { ok, pedidos: [...] } o null si falló la consulta (sin conexión, etc.)
function consultarPedidosPorCelular(celular) {
  if (!URL_PEDIDOS_WEB || URL_PEDIDOS_WEB.indexOf('PEGAR_AQUI') !== -1 || !celular) {
    return Promise.resolve(null);
  }
  const url = `${URL_PEDIDOS_WEB}?accion=pedidosPorCelular&celular=${encodeURIComponent(celular)}`;
  return fetch(url)
    .then(res => res.json())
    .then(data => (data && data.ok) ? data : null)
    .catch(err => {
      console.warn('No se pudo consultar pedidosPorCelular', err);
      return null;
    });
}

function guardarPedidoEnPlanilla(datosPedido) {
  if (!URL_PEDIDOS_WEB || URL_PEDIDOS_WEB.indexOf('PEGAR_AQUI') !== -1) {
    console.warn('Falta configurar URL_PEDIDOS_WEB en main.js');
    return Promise.resolve({ ok: false, motivo: 'sin-configurar' });
  }

  // Chequeo rápido: si el dispositivo ya sabe que no tiene conexión (modo avión, etc.),
  // avisamos de una sin ni siquiera intentar la petición.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.resolve({ ok: false, motivo: 'sin-conexion' });
  }

  // Le ponemos un límite de tiempo: si la conexión está "colgada" (ni falla ni responde),
  // no dejamos al cliente esperando para siempre. Ojo: esto NO demora los pedidos
  // normales — en cuanto llega la respuesta (típicamente en menos de 1 segundo con
  // buena conexión), seguimos al toque sin esperar el límite.
  // ✅ AUMENTADO: antes eran 10s, pero Apps Script a veces tarda más de eso en
  // responder (redirecciones internas, el proyecto ocupado con otras
  // ejecuciones, etc.) aunque el pedido se termine guardando bien igual — eso
  // generaba avisos de "sin conexión" que en realidad eran falsos positivos.
  // Con la traba de idempotencia que agregamos en doPost.gs, además, ya no
  // hay riesgo de duplicar el pedido aunque el navegador tarde en confirmar.
  const controlador = new AbortController();
  const timeoutId = setTimeout(() => controlador.abort('timeout'), 25000);

  return fetch(URL_PEDIDOS_WEB, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(datosPedido),
    signal: controlador.signal
  })
    .then(res => res.json())
    .then(data => ({ ok: !!(data && data.resultado === 'ok'), respuesta: data }))
    .catch(err => {
      const fueTimeout = err && err.name === 'AbortError';
      console.warn('No se pudo guardar el pedido en la planilla:', err);
      return { ok: false, motivo: fueTimeout ? 'timeout' : 'error-red', error: err };
    })
    .finally(() => clearTimeout(timeoutId));
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
    div.dataset.precio = precioFinal(producto);
    div.dataset.descripcion = producto.descripcion;
    div.dataset.categoria = producto.categoria;

    const galeria = [producto.imagen, ...(producto.imagenesExtra || [])].filter(Boolean);

    const imagenHTML = producto.imagen ? `
      <div class="producto-imagen-container" data-nombre="${producto.nombre}" data-descripcion="${producto.descripcion || 'Sin descripción disponible'}" data-galeria='${JSON.stringify(galeria)}' onclick="abrirGaleria(this)">
        <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:130px; object-fit:contain; background:white;" />
        ${cintaOfertaHTML(producto)}
        ${favoritoBtnHTML(producto.nombre)}
        ${compartirBtnHTML(producto.nombre, producto.precio)}
        ${producto.stock <= 0 ? '<div class="sin-stock-overlay">SIN STOCK</div>' : ''}
      </div>` : '';

    div.innerHTML = `
      <div class="ranking-badge">#${index + 1}</div>
      ${imagenHTML}
      <h3>${producto.nombre}</h3>
      ${precioHTML(producto)}
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

// =====================================================
// FORMA DE PAGO (segundo paso del checkout)
// =====================================================

let formaPagoSeleccionada = null;

// ✅ NUEVO: al cambiar de paso dentro del checkout, si el cuerpo del modal
// había quedado scrolleado hacia abajo, lo llevamos arriba de todo. Sin esto,
// pasar de "Elegí tu regalo" a "Forma de pago" podía verse cortado/raro si
// el usuario estaba con el scroll bajado, dando la sensación de que no pasó nada.
function resetScrollModal() {
  const body = document.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
}

function mostrarPasoPago() {
  document.getElementById('paso-resumen').style.display = 'none';
  document.getElementById('paso-regalo').style.display = 'none';
  document.getElementById('paso-pago').style.display = 'block';
  document.getElementById('footer-paso-resumen').style.display = 'none';
  document.getElementById('footer-paso-regalo').style.display = 'none';
  document.getElementById('footer-paso-pago').style.display = 'flex';
  document.getElementById('titulo-modal-resumen').textContent = 'Forma de pago';
  resetScrollModal();
}

function mostrarPasoResumen() {
  document.getElementById('paso-pago').style.display = 'none';
  document.getElementById('paso-regalo').style.display = 'none';
  document.getElementById('paso-confirmacion').style.display = 'none';
  document.getElementById('paso-resumen').style.display = 'block';
  document.getElementById('footer-paso-pago').style.display = 'none';
  document.getElementById('footer-paso-regalo').style.display = 'none';
  document.getElementById('footer-paso-confirmacion').style.display = 'none';
  document.getElementById('footer-paso-resumen').style.display = 'flex';
  document.getElementById('titulo-modal-resumen').textContent = 'Resumen de tu pedido';
  const totalWrapper = document.querySelector('.checkout-total');
  if (totalWrapper) totalWrapper.style.display = 'flex';
  resetScrollModal();
}

// ✅ NUEVO: pantalla intermedia "Elegí tu regalo", solo se muestra cuando el
// total del carrito supera UMBRAL_REGALO y todavía no eligió ninguno.
function mostrarPasoRegalo() {
  document.getElementById('paso-resumen').style.display = 'none';
  document.getElementById('paso-pago').style.display = 'none';
  document.getElementById('paso-confirmacion').style.display = 'none';
  document.getElementById('paso-regalo').style.display = 'block';

  document.getElementById('footer-paso-resumen').style.display = 'none';
  document.getElementById('footer-paso-pago').style.display = 'none';
  document.getElementById('footer-paso-confirmacion').style.display = 'none';
  document.getElementById('footer-paso-regalo').style.display = 'flex';

  document.getElementById('titulo-modal-resumen').textContent = '🎁 Elegí tu regalo';

  const totalWrapper = document.querySelector('.checkout-total');
  if (totalWrapper) totalWrapper.style.display = 'none';

  renderOpcionesRegalo();
  resetScrollModal();
}

function renderOpcionesRegalo() {
  const contenedor = document.getElementById('regalo-opciones');
  if (!contenedor) return;
  contenedor.innerHTML = '';

  const opciones = productos.filter(p => p.esRegalo && p.stock > 0);

  if (opciones.length === 0) {
    contenedor.innerHTML = '<p style="text-align:center; color:var(--texto-secundario); font-size:0.9rem;">No hay regalos disponibles en este momento, pero tu pedido sigue siendo válido igual.</p>';
    return;
  }

  opciones.forEach(producto => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; align-items:center; gap:12px; border:1px solid var(--borde); border-radius:12px; padding:10px 12px;';
    div.innerHTML = `
      <img src="${producto.imagen}" alt="${producto.nombre}" style="width:56px; height:56px; object-fit:cover; border-radius:8px;">
      <div style="flex:1;">
        <div style="font-size:0.9rem; font-weight:600;">${producto.nombre}</div>
        <div style="font-size:0.78rem; color:var(--texto-secundario);">Valor: $${producto.precio.toLocaleString()}</div>
      </div>
      <button type="button" class="boton boton-secundario" style="width:auto; padding:8px 16px;" onclick="elegirRegalo('${producto.nombre.replace(/'/g, "\\'")}')">Elegir</button>
    `;
    contenedor.appendChild(div);
  });
}

function elegirRegalo(nombreProducto) {
  const producto = productos.find(p => p.nombre === nombreProducto);
  if (!producto) {
    console.error('elegirRegalo: no se encontró el producto', nombreProducto);
    return;
  }

  // ✅ BLINDADO: pase lo que pase adentro (guardar, actualizar, calcular
  // resumen), SIEMPRE terminamos yendo a "Forma de pago". Si algo tira un
  // error, queda logueado en la consola para poder diagnosticarlo, pero
  // ya no se queda "trabado" en la pantalla de elegir regalo.
  try {
    // Sacamos cualquier regalo elegido antes (por si vuelve a cambiar de opción)
    for (let i = carrito.length - 1; i >= 0; i--) {
      if (carrito[i].esRegalo) carrito.splice(i, 1);
    }

    carrito.push({
      nombre: '🎁 ' + producto.nombre + ' (regalo)',
      nombreOriginal: producto.nombre, // ✅ para mandar a la planilla sin el emoji ni "(regalo)"
      precio: 0,
      cantidad: 1,
      esRegalo: true
    });

    guardarCarritoEnLocalStorage();
    actualizarCarrito();
    calcularResumen();
    mostrarPopup('🎁 ¡Agregamos tu regalo!');
  } catch (err) {
    console.error('elegirRegalo: se produjo un error, pero igual avanzamos a Forma de pago', err);
  } finally {
    mostrarPasoPago();
  }
}

function volverAResumenDesdeRegalo() {
  mostrarPasoResumen();
}

function mostrarPasoConfirmacion(numeroPedido, formaPago) {
  resetScrollModal();
  document.getElementById('paso-resumen').style.display = 'none';
  document.getElementById('paso-pago').style.display = 'none';
  document.getElementById('paso-regalo').style.display = 'none';
  document.getElementById('paso-confirmacion').style.display = 'block';
  document.getElementById('confirmacion-exito').style.display = 'block';
  document.getElementById('confirmacion-error').style.display = 'none';

  document.getElementById('footer-paso-resumen').style.display = 'none';
  document.getElementById('footer-paso-pago').style.display = 'none';
  document.getElementById('footer-paso-regalo').style.display = 'none';
  document.getElementById('footer-paso-confirmacion').style.display = 'flex';

  document.getElementById('titulo-modal-resumen').textContent = '¡Pedido confirmado!';
  document.getElementById('confirmacion-numero-pedido').textContent = '#' + numeroPedido;

  const totalWrapper = document.querySelector('.checkout-total');
  if (totalWrapper) totalWrapper.style.display = 'none';

  const recordatorio = document.getElementById('confirmacion-transferencia-recordatorio');
  const esTransferencia = formaPago === 'transferencia';
  if (recordatorio) recordatorio.style.display = esTransferencia ? 'block' : 'none';

  if (esTransferencia) {
    const btnComprobante = document.getElementById('btn-enviar-comprobante');
    if (btnComprobante) {
      btnComprobante.onclick = () => {
        const mensaje = `Hola! Te mando el comprobante de la transferencia de mi pedido #${numeroPedido} 📎`;
        window.open(`https://wa.me/5491130335334?text=${encodeURIComponent(mensaje)}`, '_blank');
      };
    }
  }
}

// Pantalla que se muestra si el pedido NO se pudo registrar automáticamente en la planilla.
// Ofrece un botón de respaldo para mandarlo igual por WhatsApp, así nunca se pierde.
function mostrarPasoConfirmacionError(mensajeCompleto, motivo) {
  resetScrollModal();
  document.getElementById('paso-resumen').style.display = 'none';
  document.getElementById('paso-pago').style.display = 'none';
  document.getElementById('paso-regalo').style.display = 'none';
  document.getElementById('paso-confirmacion').style.display = 'block';
  document.getElementById('confirmacion-exito').style.display = 'none';
  document.getElementById('confirmacion-error').style.display = 'block';

  document.getElementById('footer-paso-resumen').style.display = 'none';
  document.getElementById('footer-paso-pago').style.display = 'none';
  document.getElementById('footer-paso-regalo').style.display = 'none';
  document.getElementById('footer-paso-confirmacion').style.display = 'flex';

  const esTimeout = motivo === 'timeout';
  const esSinConexion = motivo === 'sin-conexion' || esTimeout;

  document.getElementById('titulo-modal-resumen').textContent = esSinConexion ? 'Sin conexión a internet' : 'Hubo un problema';

  const tituloError = document.getElementById('confirmacion-error-titulo');
  const textoError = document.getElementById('confirmacion-error-texto');
  if (tituloError) {
    tituloError.textContent = esSinConexion ? '📶 Parece que no tenés conexión' : 'Tuvimos un problema para registrar tu pedido';
  }
  if (textoError) {
    // ✅ NUEVO: el caso "timeout" es ambiguo — el pedido puede haberse guardado
    // igual del lado del servidor aunque el navegador se haya cansado de
    // esperar. Por eso, antes de mandar por WhatsApp (que podría duplicar el
    // pedido si en realidad sí se guardó), lo mandamos primero a revisar
    // "Mis pedidos" con su celular para confirmar si ya está o no.
    if (esTimeout) {
      textoError.textContent = 'Tu carrito sigue guardado, no se perdió nada. Esto puede pasar por una conexión lenta, y a veces el pedido igual se guarda del lado nuestro. Antes de reenviarlo, revisá "Mis pedidos" con tu celular — si no aparece, mandanoslo por WhatsApp:';
    } else if (esSinConexion) {
      textoError.textContent = 'Tu carrito sigue guardado, no se perdió nada. Probá confirmar de nuevo cuando tengas señal, o mandanos el pedido por WhatsApp:';
    } else {
      textoError.textContent = 'No te preocupes, tu carrito sigue guardado. Para asegurarnos de recibirlo igual, mandanoslo por WhatsApp:';
    }
  }

  const totalWrapper = document.querySelector('.checkout-total');
  if (totalWrapper) totalWrapper.style.display = 'none';

  const btnRespaldo = document.getElementById('btn-enviar-whatsapp-respaldo');
  if (btnRespaldo) {
    btnRespaldo.onclick = () => {
      window.open(`https://wa.me/5491130335334?text=${encodeURIComponent(mensajeCompleto)}`, '_blank');
    };
  }
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

  trackEvento('seleccionar_forma_pago', { forma_pago: forma });
}

function cerrarResumenModal() {
  document.getElementById('resumen-modal').style.display = 'none';
  mostrarPasoResumen();
  resetearPasoPago();
}

window.mostrarPasoPago = mostrarPasoPago;
window.mostrarPasoConfirmacion = mostrarPasoConfirmacion;
window.mostrarPasoResumen = mostrarPasoResumen;
window.resetearPasoPago = resetearPasoPago;
window.seleccionarFormaPago = seleccionarFormaPago;
window.cerrarResumenModal = cerrarResumenModal;

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  iniciarSplash();
  cargarCarritoDesdeLocalStorage();

  await cargarProductosDesdeGoogleSheet();

  const resultadoSyncCarrito = sincronizarPreciosCarrito();

  renderizarTopVentas();

  finalizarSplash();

  // ✅ CORREGIDO: antes esto se disparaba con un timer fijo de 900ms desde
  // un lugar separado (el bloque del tour), sin esperar a que los
  // productos terminaran de cargar — si la planilla tardaba más que eso en
  // responder, el popup corría antes de tener datos y nunca encontraba
  // ninguna oferta. Ahora se dispara ACÁ, justo después de que "productos"
  // ya está lleno de verdad, así siempre tiene la info disponible.
  //
  // ✅ ACTUALIZADO: ahora se muestra SIEMPRE que haya ofertas activas, en
  // cada entrada a la página (no una vez por día). Si en algún momento
  // querés volver a limitarlo (por ejemplo, una vez por día para que no
  // resulte pesado), es un cambio chico y avisame.
  if (yaVioElTourGlobal()) {
    // Ya conoce el sitio: no hay tour de bienvenida de por medio, así que
    // el popup de ofertas se muestra directo.
    setTimeout(abrirPopupOfertasSiHay, 700);
  }
  // Si todavía no vio el tour, no hacemos nada acá — el propio tour, al
  // cerrarse, se encarga de mostrar el popup de ofertas justo después
  // (ver más abajo, dentro del bloque del tour).

  mostrarSaludo(); // ✅ saludo en header

  inicializarSwipeGaleria();

  // ✅ "Repetir mi último pedido" ahora queda siempre visible (igual que
  // "Mis pedidos"): el modal que abre es el que resuelve, con el celular,
  // si hay o no un pedido para repetir.

  // Medir la altura real del header (cambia según el saludo, el logo, etc.)
  actualizarAlturaHeader();
  const headerEl = document.getElementById('main-header');
  if (headerEl && window.ResizeObserver) {
    new ResizeObserver(actualizarAlturaHeader).observe(headerEl);
  } else {
    window.addEventListener('resize', actualizarAlturaHeader);
  }

  // Autocompletar campo nombre y celular en el modal
  const inputNombre = document.getElementById('nombre-cliente');
  if (inputNombre) {
    inputNombre.value = obtenerNombreCliente();
  }

  const inputCelular = document.getElementById('celular-cliente');
  if (inputCelular) {
    inputCelular.value = obtenerCelularCliente();
    bloquearPrefijoCelular('celular-cliente');
  }

  const inputCelularConfirmar = document.getElementById('celular-cliente-confirmar');
  if (inputCelularConfirmar) {
    // Si ya tenemos un celular guardado de una compra anterior, lo precargamos en los dos campos
    const celularGuardado = obtenerCelularCliente();
    if (celularGuardado && celularGuardado !== '+549') {
      inputCelularConfirmar.value = celularGuardado;
    }
    bloquearPrefijoCelular('celular-cliente-confirmar');
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
      div.dataset.precio = precioFinal(producto);
      div.dataset.descripcion = producto.descripcion;
      div.dataset.categoria = producto.categoria;

      const etiquetas = [];
      if (producto.nuevo) etiquetas.push('nuevo');
      if (producto.masvendido) etiquetas.push('masvendido');
      if (producto.recomendado) etiquetas.push('recomendado');

      const etiquetasHTML = etiquetas.length > 0
        ? `<div class="etiquetas">${etiquetas.map(t => `<span class="etiqueta ${t}">${t==='nuevo'? '🆕 Nuevo' : t==='masvendido' ? '🔥 Muy vendido' : '⭐ Recomendado' }</span>`).join('')}</div>`
        : '';

      const galeria = [producto.imagen, ...(producto.imagenesExtra || [])].filter(Boolean);

      const imagenHTML = producto.imagen ? `
        <div class="producto-imagen-container" data-nombre="${producto.nombre}" data-descripcion="${producto.descripcion || 'Sin descripción disponible'}" data-galeria='${JSON.stringify(galeria)}' onclick="abrirGaleria(this)">
          <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:160px; object-fit:contain; background:white;" />
          ${cintaOfertaHTML(producto)}
          ${favoritoBtnHTML(producto.nombre)}
          ${compartirBtnHTML(producto.nombre, producto.precio)}
          ${producto.stock <= 0
            ? '<div class="sin-stock-overlay">SIN STOCK</div>'
            : '<div class="info-overlay">+ info</div>'}
        </div>` : '';

      div.innerHTML = `
        ${imagenHTML}
        <h3>${producto.nombre}</h3>
        ${etiquetasHTML}
        <p class="categoria-texto">${producto.categoria}</p>
        ${precioHTML(producto)}
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

  // ✅ NUEVO: ícono por rubro, para que el menú lateral se escanee más rápido
  // de un vistazo en el celular. Si el nombre de la categoría no matchea
  // ninguna palabra clave, usa 🦷 como ícono genérico por defecto.
  // ✅ ACTUALIZADO: para los rubros donde no existe ningún emoji que
  // realmente represente el instrumental (no hay "clamp dental" ni
  // "explorador dental" en el set de emojis — 🗜️ y 🔧 son herramientas de
  // taller, no de consultorio), usamos un ícono SVG propio dibujado a mano
  // en vez de forzar un emoji que confunda. Para el resto, un emoji
  // razonablemente relacionado sigue siendo suficiente.
  const ICONO_SVG_CLAMP = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><path d="M7 4C5 4 4.5 6 5 8c0.5 2 2 3.3 3.5 3.8"/><path d="M17 4c2 0 2.5 2 2 4c-0.5 2-2 3.3-3.5 3.8"/><path d="M7 4h10"/><path d="M8.5 11.8L7 19c-0.2 1 0.3 1.5 1.2 1.5h1c0.8 0 1.2-0.6 1.1-1.3l-0.3-4.7"/><path d="M15.5 11.8L17 19c0.2 1-0.3 1.5-1.2 1.5h-1c-0.8 0-1.2-0.6-1.1-1.3l0.3-4.7"/><circle cx="8.6" cy="17.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="15.4" cy="17.5" r="0.6" fill="currentColor" stroke="none"/></svg>`;
  const ICONO_SVG_EXPLORADOR = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;"><line x1="5" y1="19" x2="14" y2="10"/><path d="M14 10c1.5-1.5 2-3 1-4c-1-1-2.5-0.5-4 1"/><circle cx="5" cy="19" r="1.3" fill="currentColor" stroke="none"/></svg>`;

  function iconoParaCategoria(categoria) {
    const c = (categoria || '').toLowerCase();
    const reglas = [
      [/clamp/, ICONO_SVG_CLAMP],       // ✅ ícono propio: antes 🗜️ (morza de carpintero, no tenía nada que ver)
      [/instrumental/, ICONO_SVG_EXPLORADOR], // ✅ ícono propio: antes 🔧 (llave inglesa)
      [/color/, '🎨'],
      [/descartable/, '🧤'],
      [/endodoncia/, '🪡'],
      [/equipamiento/, '⚙️'],
      [/operatoria/, '🪥'],
      [/periodoncia/, '🩹'],
      [/protecci/, '🥽'],
      [/punta/, '💧'],
      [/varios/, '📦'],
    ];
    const match = reglas.find(([regex]) => regex.test(c));
    return match ? match[1] : '🦷';
  }

  // Chiquito helper para no insertar el nombre de categoría crudo dentro de innerHTML
  function escaparHTML(texto) {
    return (texto || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // --- Menú de navegación por categorías (desktop + mobile) ---
  const navDesktop = document.getElementById('nav-categorias-desktop');
  const navMobile = document.getElementById('nav-categorias-mobile');

  if (navDesktop && navMobile) {
    categoriasOrdenadas.forEach(categoria => {
      const slug = 'cat-' + slugify(categoria);
      const icono = iconoParaCategoria(categoria);
      const etiquetaHTML = icono + ' ' + escaparHTML(categoria);

      const linkDesktop = document.createElement('a');
      linkDesktop.href = '#' + slug;
      linkDesktop.innerHTML = etiquetaHTML;
      linkDesktop.dataset.target = slug;
      navDesktop.appendChild(linkDesktop);

      const linkMobile = document.createElement('a');
      linkMobile.href = '#' + slug;
      linkMobile.innerHTML = etiquetaHTML;
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
    if (item.esRegalo) {
      resumen.innerHTML += `<div style="margin-bottom: 0.4rem; color:var(--menta-oscuro);">${item.nombre} - <strong>Gratis</strong> <a href="#" onclick="event.preventDefault(); mostrarPasoRegalo();" style="font-size:0.78rem; color:var(--rosa-acento);">(cambiar)</a></div>`;
      mensaje += `• ${item.nombre} - Gratis (regalo)\n`;
      return; // no suma nada a totalGlobal porque precio es 0
    }
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

document.getElementById('confirmar')?.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  // ✅ CORREGIDO: antes esto reutilizaba un número generado una sola vez
  // cuando cargó la página (quedaba "pegado" a esa fecha/hora, sin importar
  // cuándo se abría realmente el checkout). Ahora se genera de nuevo cada
  // vez que se abre el checkout, así ya arranca con un número fresco.
  window.numeroPedidoActual = generarNumeroPedido();
  window.yaIntentadoEnvioPedido = false; // ✅ nuevo checkout = nuevo intento, permite generar número fresco

  descuentoGlobal = 0;
  window.celularReferidorValido = null;
  document.getElementById('cupon-feedback').textContent = '';
  document.getElementById('resumen-modal').style.display = 'flex';

  mostrarPasoResumen();
  resetearPasoPago();

  calcularResumen();
  mostrarProductosRelacionados();

  const totalCarrito = carrito.reduce((acc, item) => acc + item.precio * item.cantidad, 0);
  trackEvento('begin_checkout', { currency: 'ARS', value: totalCarrito, items: carrito.map(i => ({ item_name: i.nombre, quantity: i.cantidad, price: i.precio })) });
});


  document.getElementById('aplicar-cupon')?.addEventListener('click', async () => {
    const inputCupon = document.getElementById('cupon');
    const feedback = document.getElementById('cupon-feedback');
    const codigoIngresado = inputCupon?.value.trim();

    if (!codigoIngresado) {
      feedback.textContent = 'Ingresá el celular de quien te recomendó SmileMarket';
      feedback.style.color = 'red';
      return;
    }

    // ❌ SACADO: el sistema de cupones normales (códigos genéricos tipo
    // "VERANO10") se eliminó. El único descuento disponible ahora es el de
    // referidos: el celular de alguien que ya compró antes en SmileMarket.
    const soloDigitos = codigoIngresado.replace(/\D/g, '');
    if (soloDigitos.length >= 10) {
      await intentarAplicarReferido(soloDigitos, feedback);
      return;
    }

    descuentoGlobal = 0;
    window.celularReferidorValido = null;
    feedback.textContent = 'Ingresá un número de celular válido (el de quien te recomendó)';
    feedback.style.color = 'red';
    calcularResumen();
    mostrarProductosRelacionados();
  });

  // ✅ NUEVO: programa de referidos. Reglas para que sea válido:
  //  1) el celular ingresado tiene que pertenecer a alguien que YA compró antes
  //  2) no puede ser el mismo celular de quien está comprando ahora
  //  3) quien compra tiene que ser realmente nueva/o (0 pedidos previos)
  async function intentarAplicarReferido(celularReferidorIngresado, feedback) {
    const celularCompradorInput = document.getElementById('celular-cliente');
    const celularComprador = (celularCompradorInput?.value || '').replace(/\D/g, '');

    if (!celularComprador || celularComprador.length < 10) {
      feedback.textContent = 'Completá tu celular arriba antes de usar un código de referido';
      feedback.style.color = 'red';
      return;
    }

    if (celularComprador.slice(-10) === celularReferidorIngresado.slice(-10)) {
      feedback.textContent = 'No podés usar tu propio celular como código de referido';
      feedback.style.color = 'red';
      descuentoGlobal = 0;
      window.celularReferidorValido = null;
      calcularResumen();
      mostrarProductosRelacionados();
      return;
    }

    feedback.textContent = 'Verificando código...';
    feedback.style.color = 'inherit';

    const [respuestaReferidor, respuestaComprador] = await Promise.all([
      consultarPedidosPorCelular(celularReferidorIngresado),
      consultarPedidosPorCelular(celularComprador),
    ]);

    if (respuestaReferidor === null || respuestaComprador === null) {
      feedback.textContent = 'No pudimos verificar el código ahora (revisá tu conexión)';
      feedback.style.color = 'red';
      descuentoGlobal = 0;
      window.celularReferidorValido = null;
      calcularResumen();
      mostrarProductosRelacionados();
      return;
    }

    // ✅ NUEVO: un pedido ANULADO no cuenta como "ya compró" para poder ser
    // referidor — evita que alguien cargue un pedido, lo cancele, y aun así
    // quede habilitado para referir a otras personas sin haber comprado
    // realmente nunca. (Para "compradorEsNuevo" SÍ dejamos que un pedido
    // anulado cuente como historial — si no, alguien podría cancelar su
    // pedido a propósito para "volver a ser nueva/o" y reusar el descuento
    // las veces que quiera. Esto además queda blindado del lado del
    // servidor en doPost.gs, así que aunque alguien intente esquivar este
    // chequeo del frontend, no consigue nada igual.)
    const referidorTieneHistorial = (respuestaReferidor.pedidos || []).some(p => p.estado !== 'anulado');
    const compradorEsNuevo = (respuestaComprador.pedidos || []).length === 0;

    if (referidorTieneHistorial && compradorEsNuevo) {
      descuentoGlobal = 5; // acordado: 5% para el referido en su primera compra
      window.celularReferidorValido = celularReferidorIngresado.slice(-10);
      feedback.textContent = '¡Código de referido válido! 5% de descuento en tu primera compra 🎉';
      feedback.style.color = 'green';
    } else if (!referidorTieneHistorial) {
      feedback.textContent = 'Ese celular no corresponde a ninguna clienta con compras anteriores';
      feedback.style.color = 'red';
      descuentoGlobal = 0;
      window.celularReferidorValido = null;
    } else {
      feedback.textContent = 'Este descuento es solo para tu primera compra';
      feedback.style.color = 'red';
      descuentoGlobal = 0;
      window.celularReferidorValido = null;
    }

    calcularResumen();
    mostrarProductosRelacionados();
  }

  document.getElementById('enviar-whatsapp')?.addEventListener('click', async () => {
    const nombreCliente = document.getElementById('nombre-cliente')?.value.trim();
    if (!nombreCliente) {
      alert("Por favor, ingresá tu nombre antes de confirmar el pedido.");
      return;
    }

    const celularCliente = document.getElementById('celular-cliente')?.value.trim();
    if (!celularCliente || celularCliente === '+549') {
      alert("Por favor, ingresá tu celular antes de confirmar el pedido.");
      return;
    }

    const celularConfirmarCheck = document.getElementById('celular-cliente-confirmar')?.value.trim();
    if (celularCliente !== celularConfirmarCheck) {
      alert("Los dos números de celular no coinciden. Volvé al paso anterior y revisalos.");
      return;
    }

    if (!formaPagoSeleccionada) {
      alert("Elegí una forma de pago (transferencia o efectivo) antes de confirmar el pedido.");
      return;
    }

    if (!carrito || carrito.length === 0) {
      alert('El carrito está vacío');
      return;
    }

    guardarNombreCliente(nombreCliente); // ✅ guardamos el nombre
    guardarCelularCliente(celularCliente); // ✅ guardamos el celular

    // ✅ CORREGIDO: antes esto se regeneraba en CADA click de "Confirmar
    // pedido", incluso en un reintento después de un error de timeout — eso
    // hacía que si el primer intento en realidad SÍ se había guardado del
    // lado del servidor (pero el navegador se cansó de esperar y avisó error
    // igual), el reintento generara un número totalmente nuevo, y terminara
    // duplicando el pedido en la planilla. Ahora solo se genera una vez por
    // intento de compra: el primer click arma el número "real" del momento
    // de confirmar, y si hay que reintentar (mismo checkout, sin cerrar el
    // modal), se reusa el mismo — así el backend puede reconocerlo como
    // duplicado si el primer intento ya había llegado.
    if (!window.yaIntentadoEnvioPedido) {
      window.numeroPedidoActual = generarNumeroPedido();
      window.yaIntentadoEnvioPedido = true;
    }

    // Armamos el mensaje completo igual que antes — ahora solo se usa como
    // respaldo manual si el guardado automático en la planilla falla.
    let mensaje = `Pedido #${window.numeroPedidoActual}\n\n`;
    mensaje += `Hola! mi nombre es ${nombreCliente}, quiero realizar una compra:\n\n`;
    mensaje += document.getElementById('enviar-whatsapp').dataset.mensaje;

    let total = 0;
    carrito.forEach(item => {
      total += Number(item.precio) * Number(item.cantidad);
    });

    mensaje = mensaje.trim();
    mensaje += `\nTotal: $${total.toLocaleString()}`;

    const textoFormaPago = formaPagoSeleccionada === 'transferencia'
      ? 'Transferencia ⚠️ (envío el comprobante en este mismo chat)'
      : 'Efectivo (pedido válido por 5 días)';
    mensaje += `\n\nForma de pago: ${textoFormaPago}`;

    // Deshabilitamos el botón mientras se procesa, para evitar doble-click
    const btnConfirmar = document.getElementById('enviar-whatsapp');
    const textoOriginalBoton = btnConfirmar ? btnConfirmar.textContent : '';
    if (btnConfirmar) { btnConfirmar.disabled = true; btnConfirmar.textContent = 'Confirmando...'; }
    mostrarCargando('Confirmando tu pedido...');

    // ✅ NUEVO: lo que se ve en pantalla (con el emoji "🎁" y "(regalo)") queda
    // lindo en la web, pero a la planilla "Pedidos Web" le mandamos el nombre
    // del producto tal cual está en tu base (sin el agregado), así podés
    // cruzarlo con stock/categorías sin problema. El precio $0 ya alcanza
    // para identificar que fue un regalo.
    const carritoParaPlanilla = carrito.map(item => ({
      ...item,
      nombre: item.esRegalo ? (item.nombreOriginal || item.nombre) : item.nombre
    }));

    // ✅ Guardamos el pedido en la planilla "Pedidos Web" Y ESPERAMOS la confirmación real
    const resultado = await guardarPedidoEnPlanilla({
      numeroPedido: window.numeroPedidoActual,
      cliente: nombreCliente,
      celular: celularCliente,
      carrito: carritoParaPlanilla,
      cupon: document.getElementById('cupon')?.value.trim() || '',
      descuento: descuentoGlobal,
      total: total,
      formaPago: formaPagoSeleccionada === 'transferencia' ? 'Transferencia' : 'Efectivo',
      // ✅ NUEVO: si se validó un código de referido, lo mandamos aparte del
      // campo "cupón" (que puede quedar vacío o con otro texto), para que el
      // backend pueda registrar el referido en su propia hoja.
      celularReferidor: window.celularReferidorValido || ''
    });

    if (btnConfirmar) { btnConfirmar.disabled = false; btnConfirmar.textContent = textoOriginalBoton; }
    ocultarCargando();

    if (resultado && resultado.ok) {
      // ✅ Se guardó bien: trackeamos la compra ANTES de vaciar el carrito (para poder listar los items)
      trackEvento('purchase', {
        transaction_id: window.numeroPedidoActual,
        currency: 'ARS',
        value: total,
        forma_pago: formaPagoSeleccionada,
        items: carrito.map(i => ({ item_name: i.nombre, quantity: i.cantidad, price: i.precio }))
      });

      // guardamos el historial, vaciamos el carrito y mostramos "¡Listo!"
      guardarUltimoPedido();
      guardarEnHistorialPedidos(window.numeroPedidoActual, total, formaPagoSeleccionada === 'transferencia' ? 'Transferencia' : 'Efectivo');
      vaciarCarrito();
      mostrarPasoConfirmacion(window.numeroPedidoActual, formaPagoSeleccionada);
    } else {
      // ⚠️ Falló el guardado automático: no tocamos el carrito, y ofrecemos el respaldo por WhatsApp
      console.warn('No se pudo registrar el pedido automáticamente:', resultado);
      trackEvento('checkout_error', { motivo: (resultado && resultado.motivo) || 'desconocido' });
      mostrarPasoConfirmacionError(mensaje, resultado && resultado.motivo);
    }
  });

  document.getElementById('seguir-comprando')?.addEventListener('click', () => {
    cerrarResumenModal();
  });

  document.getElementById('btn-continuar-pago')?.addEventListener('click', () => {
    const nombreCliente = document.getElementById('nombre-cliente')?.value.trim();
    const celularCliente = document.getElementById('celular-cliente')?.value.trim();
    const celularConfirmar = document.getElementById('celular-cliente-confirmar')?.value.trim();

    if (!nombreCliente) {
      alert('Por favor, ingresá tu nombre antes de continuar.');
      return;
    }
    if (!celularCliente || celularCliente === '+549') {
      alert('Por favor, ingresá tu celular antes de continuar.');
      return;
    }
    if (!celularConfirmar || celularConfirmar === '+549') {
      alert('Por favor, confirmá tu celular en el segundo campo antes de continuar.');
      return;
    }
    if (celularCliente !== celularConfirmar) {
      alert('Los dos números de celular no coinciden. Revisá que estén bien escritos.');
      return;
    }

    // ✅ NUEVO: si el total (sin contar el regalo, que es $0) supera el
    // umbral y todavía no eligió ningún regalo, mostramos el paso intermedio
    // en vez de ir directo a "Forma de pago".
    const yaTieneRegalo = carrito.some(item => item.esRegalo);
    const totalSinRegalo = carrito
      .filter(item => !item.esRegalo)
      .reduce((acc, item) => acc + (Number(item.precio) * Number(item.cantidad)), 0);

    if (!yaTieneRegalo && totalSinRegalo >= UMBRAL_REGALO) {
      mostrarPasoRegalo();
      return;
    }

    mostrarPasoPago();
  });
  document.getElementById('btn-volver-resumen')?.addEventListener('click', mostrarPasoResumen);
  document.getElementById('btn-volver-resumen-desde-regalo')?.addEventListener('click', volverAResumenDesdeRegalo);
  document.getElementById('btn-cerrar-confirmacion')?.addEventListener('click', cerrarResumenModal);
  document.getElementById('btn-pago-transferencia')?.addEventListener('click', () => seleccionarFormaPago('transferencia'));
  document.getElementById('btn-pago-efectivo')?.addEventListener('click', () => seleccionarFormaPago('efectivo'));

  document.getElementById('btn-cargar-lista')?.addEventListener('click', abrirListaCatedra);
  document.getElementById('btn-buscar-lista')?.addEventListener('click', procesarListaCatedra);
  document.getElementById('btn-agregar-lista-carrito')?.addEventListener('click', agregarListaCatedraAlCarrito);
  document.getElementById('btn-editar-lista')?.addEventListener('click', volverAEditarListaCatedra);
  document.getElementById('btn-ver-favoritos')?.addEventListener('click', abrirFavoritosModal);
  document.getElementById('btn-mis-pedidos')?.addEventListener('click', abrirHistorialPedidos);
  document.getElementById('historial-celular-input')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') buscarMisPedidosPorCelular();
  });
  document.getElementById('btn-repetir-pedido')?.addEventListener('click', abrirRepetirPedidoModal);
  document.getElementById('repetir-celular-input')?.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') buscarYRepetirUltimoPedido();
  });

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
window.abrirGaleria = abrirGaleria;
window.cambiarFotoGaleria = cambiarFotoGaleria;
window.irAFotoGaleria = irAFotoGaleria;
window.toggleFavorito = toggleFavorito;
window.repetirPedidoDesdeHistorial = repetirPedidoDesdeHistorial;
window.buscarMisPedidosPorCelular = buscarMisPedidosPorCelular;

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
          <div style="font-weight:bold;font-size:0.8rem">${productoEnOferta(p) ? `<span style="text-decoration:line-through;font-weight:400;color:var(--texto-secundario);">$${p.precio.toLocaleString()}</span> $${p.precioOferta.toLocaleString()}` : '$' + p.precio.toLocaleString()}</div>
          <button onclick="agregarRelacionado('${p.nombre}', ${precioFinal(p)})">
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
      const precioItem = precioFinal(item.producto);
      total += precioItem * item.cantidad;
      div.className = 'lista-item';
      div.innerHTML = `
        <div class="lista-item-nombre">${item.producto.nombre}${productoEnOferta(item.producto) ? ' 🏷️' : ''}</div>
        <div class="lista-item-controles">
          <button type="button" onclick="cambiarCantidadListaCatedra(${item.id}, -1)">−</button>
          <span class="lista-item-cantidad">${item.cantidad}</span>
          <button type="button" onclick="cambiarCantidadListaCatedra(${item.id}, 1)">+</button>
        </div>
        <div class="lista-item-precio">$${(precioItem * item.cantidad).toLocaleString()}</div>
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
      carrito.push({ nombre: item.producto.nombre, precio: precioFinal(item.producto), cantidad: item.cantidad });
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

// ✅ NUEVO: banner de "instalar la app" (PWA).
// - En Android/Chrome/Edge: el navegador dispara el evento
//   "beforeinstallprompt" cuando el sitio cumple los requisitos. Lo
//   capturamos, evitamos el mini-cartel automático del navegador, y en su
//   lugar mostramos nuestro propio banner con un botón — al tocarlo,
//   disparamos el prompt nativo de instalación.
// - En iPhone/iPad (Safari): Apple directamente NO permite disparar la
//   instalación por código, así que ahí mostramos instrucciones cortas de
//   cómo hacerlo a mano (Compartir → Agregar a pantalla de inicio).
// - Si ya está instalada (corriendo en modo standalone), no mostramos nada.
// - Si el cliente cierra el banner, no lo volvemos a mostrar en ese
//   dispositivo (se guarda en localStorage).
(function () {
  const CLAVE_DESCARTADO = 'smilemarket_pwa_banner_descartado_v2';

  function yaEstaInstalada() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true // iOS
    );
  }

  function fueDescartado() {
    try {
      return localStorage.getItem(CLAVE_DESCARTADO) === '1';
    } catch (e) {
      return false;
    }
  }

  function marcarDescartado() {
    try {
      localStorage.setItem(CLAVE_DESCARTADO, '1');
    } catch (e) { /* nada, no es crítico */ }
  }

  function esIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function mostrarBanner(textoHTML, mostrarBotonInstalar) {
    const banner = document.getElementById('pwa-instalar-banner');
    const texto = document.getElementById('pwa-instalar-texto');
    const btnInstalar = document.getElementById('pwa-instalar-btn');
    if (!banner || !texto || !btnInstalar) return;

    texto.innerHTML = textoHTML;
    btnInstalar.style.display = mostrarBotonInstalar ? 'inline-block' : 'none';
    banner.style.display = 'flex';
  }

  function ocultarBanner() {
    const banner = document.getElementById('pwa-instalar-banner');
    if (banner) banner.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    // ✅ NUEVO: el botón flotante (debajo de Instagram) queda siempre visible
    // para quien todavía no instaló la app, sin importar si cerró el banner
    // alguna vez o no. Si ya está instalada (entrando desde el ícono en la
    // pantalla de inicio), ni el banner ni este botón aparecen.
    const btnFlotante = document.getElementById('btn-instalar-flotante');
    if (btnFlotante && !yaEstaInstalada()) {
      btnFlotante.style.display = 'flex';
    }

    if (yaEstaInstalada() || fueDescartado()) return;

    document.getElementById('pwa-instalar-cerrar')?.addEventListener('click', () => {
      ocultarBanner();
      marcarDescartado();
    });

    // Caso iPhone/iPad: no hay evento que capturar, mostramos instrucciones directo.
    if (esIOS()) {
      mostrarBanner(
        '📲 <strong>Instalá SmileMarket</strong> en tu pantalla de inicio: tocá el botón Compartir <strong>⬆️</strong> y elegí <strong>"Agregar a pantalla de inicio"</strong>.',
        false
      );
    }
  });

  // Caso Android/Chrome/Edge: esperamos el evento del navegador.
  let promptDiferido = null;
  window.addEventListener('beforeinstallprompt', (evento) => {
    evento.preventDefault();
    promptDiferido = evento;

    if (yaEstaInstalada() || fueDescartado()) return;

    mostrarBanner('📲 <strong>Instalá SmileMarket</strong> en tu celular para comprar más rápido, como cualquier otra app.', true);
  });

  document.addEventListener('click', (ev) => {
    if (ev.target && ev.target.id === 'pwa-instalar-btn' && promptDiferido) {
      promptDiferido.prompt();
      promptDiferido.userChoice.finally(() => {
        promptDiferido = null;
        ocultarBanner();
        marcarDescartado();
      });
    }

    // ✅ NUEVO: click en el botón flotante persistente.
    if (ev.target && ev.target.closest && ev.target.closest('#btn-instalar-flotante')) {
      ev.preventDefault();
      if (esIOS()) {
        mostrarBanner(
          '📲 <strong>Instalá SmileMarket</strong> en tu pantalla de inicio: tocá el botón Compartir <strong>⬆️</strong> y elegí <strong>"Agregar a pantalla de inicio"</strong>.',
          false
        );
      } else if (promptDiferido) {
        promptDiferido.prompt();
        promptDiferido.userChoice.finally(() => {
          promptDiferido = null;
          ocultarBanner();
          marcarDescartado();
          document.getElementById('btn-instalar-flotante').style.display = 'none';
        });
      } else {
        // El navegador todavía no disparó el evento nativo (o no lo soporta):
        // mostramos instrucciones manuales como respaldo.
        mostrarBanner(
          '📲 Para instalar, buscá <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong> en el menú de tu navegador (⋮ o ☰).',
          false
        );
      }
    }
  });

  window.addEventListener('appinstalled', () => {
    ocultarBanner();
    marcarDescartado();
    const btnFlotante = document.getElementById('btn-instalar-flotante');
    if (btnFlotante) btnFlotante.style.display = 'none';
  });
})();

// ✅ NUEVO: popup automático de "Ofertas por tiempo limitado". Si hay algún
// producto en oferta vigente cuando alguien entra a la página, se le
// muestra un pop-up con todos esos productos, y puede agregarlos al
// carrito directo desde ahí (misma tarjeta, mismo botón, mismo comportamiento
// que en el catálogo normal — no es una versión "light").
//
// ✅ A PROPÓSITO se muestra en CADA entrada a la página (no una sola vez),
// mientras haya ofertas activas — así, aunque alguien no compre la primera
// vez que lo ve, se lo vuelve a encontrar la próxima visita. Esto es
// intencional: se busca que la repetición ayude a decidir la compra, no
// que sea "una sola oportunidad y listo". Funciona igual en computadora,
// celular o la app instalada (PWA) — es la misma página en los tres casos.
function yaVioElTourGlobal() {
  try {
    return localStorage.getItem('smilemarket_tour_visto_v2') === '1';
  } catch (e) {
    return false;
  }
}

function abrirPopupOfertasSiHay() {
  const enOferta = productos.filter(p => productoEnOferta(p) && p.stock > 0);
  if (enOferta.length === 0) return;

  const contenedor = document.getElementById('ofertas-modal-lista');
  const modal = document.getElementById('ofertas-modal');
  if (!contenedor || !modal) return;

  contenedor.innerHTML = '';
  enOferta.forEach(producto => {
    contenedor.appendChild(crearTarjetaProducto(producto));
  });

  modal.style.display = 'flex';
  iniciarFuegosArtificiales();
  trackEvento('ver_popup_ofertas', { cantidad_productos: enOferta.length });
}

function cerrarOfertasModal() {
  const modal = document.getElementById('ofertas-modal');
  if (modal) modal.style.display = 'none';
  detenerFuegosArtificiales();
}
window.cerrarOfertasModal = cerrarOfertasModal;

// ✅ NUEVO: fuegos artificiales de fondo para el popup de ofertas — se
// prenden solo mientras el popup está abierto. Se apagan solos a los 6
// segundos (da el golpe de efecto visual al abrirse, sin quedar
// consumiendo batería/CPU todo el rato que alguien se quede mirando el
// catálogo con el popup abierto) y también se apagan al instante si lo
// cierran antes. Es dibujo a mano en canvas, sin librerías externas.
let fuegosFrameId = null;
let fuegosApagadoId = null;

function iniciarFuegosArtificiales() {
  const canvas = document.getElementById('ofertas-fuegos');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  function ajustarTamano() {
    // ✅ Usamos document.documentElement.clientWidth/Height como primera
    // opción (más confiable en algunos navegadores/embebidos que
    // window.innerWidth, sobre todo si hay barras de herramientas o
    // teclados en pantalla en el celular), con window.innerWidth como
    // respaldo si por algún motivo el primero no está disponible.
    canvas.width = document.documentElement.clientWidth || window.innerWidth || 0;
    canvas.height = document.documentElement.clientHeight || window.innerHeight || 0;
  }
  ajustarTamano();

  const COLORES = ['#E8749E', '#F6C9DE', '#FCEFD8', '#BFE8DC', '#FFD166', '#FF6B6B'];
  let cohetes = [];
  let particulas = [];
  let ultimoLanzamiento = 0;

  // Los cohetes salen desde las franjas de los costados (izquierda/derecha),
  // no desde el centro — así el efecto rodea el popup en vez de taparlo.
  function lanzarCohete() {
    const desdeIzquierda = Math.random() < 0.5;
    const x = desdeIzquierda
      ? Math.random() * canvas.width * 0.24
      : canvas.width - Math.random() * canvas.width * 0.24;
    cohetes.push({
      x, y: canvas.height,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -(Math.random() * 3 + 7),
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      objetivoY: canvas.height * (0.2 + Math.random() * 0.35)
    });
  }

  function explotar(x, y, color) {
    const cantidad = 34;
    for (let i = 0; i < cantidad; i++) {
      const angulo = (Math.PI * 2 * i) / cantidad;
      const velocidad = Math.random() * 3.3 + 1.4;
      particulas.push({
        x, y,
        vx: Math.cos(angulo) * velocidad,
        vy: Math.sin(angulo) * velocidad,
        color,
        vida: 1
      });
    }
  }

  function loop(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (t - ultimoLanzamiento > 450) {
      lanzarCohete();
      ultimoLanzamiento = t;
    }

    for (let i = cohetes.length - 1; i >= 0; i--) {
      const c = cohetes[i];
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.05;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = c.color;
      ctx.fill();
      if (c.vy >= 0 || c.y <= c.objetivoY) {
        explotar(c.x, c.y, c.color);
        cohetes.splice(i, 1);
      }
    }

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.vida -= 0.018;
      if (p.vida <= 0) { particulas.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(p.vida, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    fuegosFrameId = requestAnimationFrame(loop);
  }

  fuegosFrameId = requestAnimationFrame(loop);
  fuegosApagadoId = setTimeout(detenerFuegosArtificiales, 6000);
}

function detenerFuegosArtificiales() {
  if (fuegosFrameId) {
    cancelAnimationFrame(fuegosFrameId);
    fuegosFrameId = null;
  }
  if (fuegosApagadoId) {
    clearTimeout(fuegosApagadoId);
    fuegosApagadoId = null;
  }
  const canvas = document.getElementById('ofertas-fuegos');
  if (canvas && canvas.getContext) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }
}

// ✅ NUEVO: tour de bienvenida de 3 pantallas, solo para quien entra por
// primera vez (se guarda en localStorage para no volver a mostrarlo nunca
// más en ese dispositivo, salvo que borren los datos del navegador).
(function () {
  const CLAVE_TOUR_VISTO = 'smilemarket_tour_visto_v2';
  let pasoActual = 1;
  const TOTAL_PASOS = 3;

  function yaVioElTour() {
    try {
      return localStorage.getItem(CLAVE_TOUR_VISTO) === '1';
    } catch (e) {
      return false;
    }
  }

  function marcarTourVisto() {
    try {
      localStorage.setItem(CLAVE_TOUR_VISTO, '1');
    } catch (e) { /* no es crítico */ }
  }

  function mostrarPasoTour(numero) {
    for (let i = 1; i <= TOTAL_PASOS; i++) {
      const paso = document.getElementById('tour-paso-' + i);
      if (paso) paso.style.display = i === numero ? 'block' : 'none';
    }
    document.querySelectorAll('.tour-dot').forEach((dot) => {
      const esActivo = Number(dot.dataset.paso) === numero;
      dot.style.background = esActivo ? 'var(--rosa-acento)' : 'var(--borde)';
      dot.style.width = esActivo ? '20px' : '8px';
      dot.style.borderRadius = '999px';
    });
    const btn = document.getElementById('tour-btn-siguiente');
    if (btn) btn.textContent = numero === TOTAL_PASOS ? '¡Empezar! 🎉' : 'Siguiente →';
  }

  window.avanzarTour = function () {
    if (pasoActual < TOTAL_PASOS) {
      pasoActual++;
      mostrarPasoTour(pasoActual);
    } else {
      cerrarTour();
    }
  };

  window.cerrarTour = function () {
    const modal = document.getElementById('tour-modal');
    if (modal) modal.style.display = 'none';
    marcarTourVisto();
    // ✅ NUEVO: si hay ofertas activas, se muestran justo después de cerrar
    // el tour (nunca al mismo tiempo, para no superponer dos modales).
    setTimeout(abrirPopupOfertasSiHay, 400);
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (yaVioElTour()) {
      // Ya vio el tour antes: no hay nada que hacer acá. El popup de
      // ofertas para quien ya conoce el sitio se dispara desde el handler
      // principal (más arriba en el archivo), justo después de que los
      // productos terminan de cargar — así nunca corre "en vacío".
      return;
    }
    // Esperamos a que termine el splash de carga para no superponer animaciones.
    setTimeout(() => {
      const modal = document.getElementById('tour-modal');
      if (modal) {
        pasoActual = 1;
        mostrarPasoTour(1);
        modal.style.display = 'flex';
      }
    }, 900);
  });
})();

// ✅ NUEVO: registro del Service Worker para la PWA. Si el navegador no lo
// soporta (o falla por cualquier motivo), la tienda sigue funcionando
// exactamente igual — esto es puramente aditivo, nunca bloquea nada.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('No se pudo registrar el Service Worker (no afecta el uso normal de la tienda):', err);
    });
  });
}