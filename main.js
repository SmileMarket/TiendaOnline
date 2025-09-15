// main.js (archivo completo modificado, conserva la lógica original y añade nuevas mejoras)

const carrito = [];
let productos = [];
let cupones = [];
let cuponAplicado = null;
let totalGlobal = 0;
let descuentoGlobal = 0;

// --- UTILS: localStorage para carrito y funciones auxiliares ---
const STORAGE_KEY = 'smilemarket_carrito_v1';
const STORAGE_PRODUCTS_STOCK = 'smilemarket_products_stock_v1';

function guardarCarritoEnLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(carrito));
  } catch (e) {
    console.warn('No se pudo guardar carrito en localStorage', e);
  }
}

function cargarCarritoDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // vaciamos y reponemos
        carrito.length = 0;
        parsed.forEach(it => carrito.push(it));
      }
    }
  } catch (e) {
    console.warn('No se pudo cargar carrito desde localStorage', e);
  }
}

function guardarStockEnLocalStorage(stockObj) {
  try {
    localStorage.setItem(STORAGE_PRODUCTS_STOCK, JSON.stringify(stockObj));
  } catch (e) {
    console.warn('No se pudo guardar stock en localStorage', e);
  }
}

function cargarStockDesdeLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS_STOCK);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

// --- SPLASH / BARRA DE PROGRESO SIMULADA ---
const splash = document.getElementById('splash');
const progressFill = document.getElementById('progress-fill');

function setProgress(p) {
  if (progressFill) progressFill.style.width = `${Math.max(0, Math.min(100, p))}%`;
}

// función para animar progresivamente la barra hasta un número (usada mientras fetch está en curso)
let progressInterval;
function iniciarProgressSimulado() {
  setProgress(10);
  let val = 10;
  if (progressInterval) clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    val += Math.random() * 8; // avance variable
    if (val >= 90) {
      val = 90;
      clearInterval(progressInterval);
    }
    setProgress(val);
  }, 300);
}

function finalizarProgress() {
  if (progressInterval) clearInterval(progressInterval);
  setProgress(100);
  setTimeout(() => {
    if (splash) splash.style.display = 'none';
    setTimeout(() => setProgress(0), 300);
  }, 300);
}

// --- CARGA DE PRODUCTOS Y CUPONES DESDE GOOGLE SHEETS ---
async function cargarProductosDesdeGoogleSheet() {
  const urlCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=1670706691&single=true&output=csv';
  try {
    iniciarProgressSimulado();
    const response = await fetch(urlCSV);
    const texto = await response.text();
    const lineas = texto.split('\n').filter(l => l.trim() !== '');
    const headers = lineas[0].split(',').map(h => h.trim());

    const stockLocal = cargarStockDesdeLocalStorage();

    productos = lineas.slice(1).map(linea => {
      const columnas = linea.split(',').map(c => c.trim());
      const producto = Object.fromEntries(headers.map((h, i) => [h.toLowerCase(), columnas[i] || '']));
      const prodObj = {
        nombre: producto.nombre || 'Sin nombre',
        categoria: producto.categoria || 'Sin categoría',
        precio: parseFloat(producto.precio) || 0,
        descripcion: producto.descripcion || '',
        imagen: producto.imagen || '',
        stock: parseInt(producto.stock) || 0,
        nuevo: (producto.nuevo || '').toUpperCase() === 'TRUE',
        masvendido: (producto.masvendido || '').toUpperCase() === 'TRUE',
        recomendado: (producto.recomendado || '').toUpperCase() === 'TRUE'
      };
      // si hay stock guardado localmente (por carrito o ajustes) prevalece:
      if (stockLocal[prodObj.nombre] != null) {
        prodObj.stock = stockLocal[prodObj.nombre];
      }
      return prodObj;
    });
    finalizarProgress();
  } catch (e) {
    console.error('Error cargando productos', e);
    finalizarProgress();
  }
}

async function cargarCuponesDesdeGoogleSheet() {
  const urlCSV = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=713979488&single=true&output=csv';
  try {
    const response = await fetch(urlCSV);
    const texto = await response.text();
    const lineas = texto.split('\n').filter(l => l.trim() !== '');
    const headers = lineas[0].split(',').map(h => h.trim().toLowerCase());

    cupones = lineas.slice(1).map(linea => {
      const columnas = linea.split(',').map(c => c.trim());
      const fila = Object.fromEntries(headers.map((h, i) => [h, columnas[i] || '']));
      return {
        codigo: (fila.codigo || '').toUpperCase(),
        descuento: parseFloat(fila.descuento) || 0
      };
    });
  } catch (e) {
    console.error('Error cargando cupones', e);
  }
}

// --- RENDER PRODUCTOS (manteniendo la estructura original, mejorada) ---
function crearCardProducto(producto) {
  const div = document.createElement('div');
  div.className = 'producto';
  div.dataset.nombre = producto.nombre;
  div.dataset.precio = producto.precio;
  div.dataset.descripcion = producto.descripcion;
  div.dataset.categoria = producto.categoria;

  const etiquetas = [];
  if (producto.nuevo) etiquetas.push('🆕');
  if (producto.masvendido) etiquetas.push('🔥');
  if (producto.recomendado) etiquetas.push('⭐');

  // etiquetas HTML con clases de color
  const etiquetasHTML = `<div class="etiquetas">
    ${producto.nuevo ? `<span class="etiqueta nuevo">Nuevo</span>` : ''}
    ${producto.masvendido ? `<span class="etiqueta masvendido">Muy vendido</span>` : ''}
    ${producto.recomendado ? `<span class="etiqueta recomendado">Recomendado</span>` : ''}
  </div>`;

  // imagen con loading lazy
  const imagenHTML = producto.imagen ? `
    <div class="producto-imagen-container" onclick="mostrarModalInfo('${escapeJs(producto.nombre)}', \`${escapeBackticks(producto.descripcion || 'Sin descripción disponible')}\`)">
      <img loading="lazy" src="${producto.imagen}" alt="${escapeHtml(producto.nombre)}" style="width:100%; height:160px; object-fit:contain;" />
      ${producto.stock <= 0
        ? '<div class="sin-stock-overlay">SIN STOCK</div>'
        : '<div class="info-overlay">+ info</div>'}
    </div>` : '';

  // urgencia / stock pequeño
  const urgenciaHTML = (producto.stock > 0 && producto.stock <= 3) ? `<div class="stock-urgente"></div>` : '';

  div.innerHTML = `
    ${imagenHTML}
    <h3>${escapeHtml(producto.nombre)}</h3>
    ${etiquetasHTML}
    <p class="categoria-texto">${escapeHtml(producto.categoria)}</p>
    <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
    ${urgenciaHTML}
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

function renderizarProductos(productosAUsar) {
  const contenedor = document.getElementById('productos');
  contenedor.innerHTML = '';
  const productosPorCategoria = {};

  // Agrupar
  productosAUsar.forEach(producto => {
    const categoria = producto.categoria || 'Sin categoría';
    if (!productosPorCategoria[categoria]) productosPorCategoria[categoria] = [];
    productosPorCategoria[categoria].push(producto);
  });

  // Ordenar categorías alfabéticamente
  const categoriasOrdenadas = Object.keys(productosPorCategoria).sort((a, b) =>
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );

  categoriasOrdenadas.forEach(categoria => {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-categoria';

    const titulo = document.createElement('h2');
    titulo.textContent = categoria;
    titulo.className = 'titulo-categoria';
    grupo.appendChild(titulo);

    const contenedorCategoria = document.createElement('div');
    contenedorCategoria.className = 'productos';

    productosPorCategoria[categoria].forEach(producto => {
      const card = crearCardProducto(producto);
      contenedorCategoria.appendChild(card);
    });

    grupo.appendChild(contenedorCategoria);
    contenedor.appendChild(grupo);
  });

  // llenar select de categorías únicas
  llenarSelectCategorias(productosAUsar);
  actualizarContadorCarrito();
}

// --- BUSCADOR CON SUGERENCIAS ---
const sugerenciasDiv = document.getElementById('sugerencias');
function mostrarSugerencias(items) {
  if (!sugerenciasDiv) return;
  sugerenciasDiv.innerHTML = '';
  if (!items || items.length === 0) {
    sugerenciasDiv.style.display = 'none';
    return;
  }

  items.slice(0, 10).forEach(prod => {
    const item = document.createElement('div');
    item.className = 'sugerencia-item';
    item.innerHTML = `
      <img src="${prod.imagen || ''}" alt="${escapeHtml(prod.nombre)}" onerror="this.style.display='none'"/>
      <div style="display:flex; flex-direction:column;">
        <div class="sugerencia-text">${escapeHtml(prod.nombre)}</div>
        <div style="font-weight:700; font-size:0.9rem;">$ ${prod.precio.toLocaleString()}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      document.getElementById('buscador').value = prod.nombre;
      document.getElementById('buscador').dispatchEvent(new Event('input'));
      sugerenciasDiv.style.display = 'none';
      window.scrollTo({ top: 220, behavior: 'smooth' });
    });
    sugerenciasDiv.appendChild(item);
  });

  sugerenciasDiv.style.display = 'block';
}

// escucha del input buscador
document.getElementById('buscador')?.addEventListener('input', (ev) => {
  const texto = ev.target.value.toLowerCase();
  // sugerencias: buscar por nombre que empiece o contenga
  const sugeridos = productos.filter(p => p.nombre.toLowerCase().includes(texto) || p.categoria.toLowerCase().includes(texto));
  if (texto.trim()) {
    mostrarSugerencias(sugeridos.slice(0, 10));
  } else {
    mostrarSugerencias([]);
  }

  // filtrado visual inmediato (manteniendo la lógica del buscador existente)
  document.querySelectorAll('.grupo-categoria').forEach(grupo => {
    let coincidencias = 0;
    grupo.querySelectorAll('.producto').forEach(prod => {
      const nombre = prod.dataset.nombre?.toLowerCase() || '';
      const categoria = prod.dataset.categoria?.toLowerCase() || '';
      const descripcion = prod.dataset.descripcion?.toLowerCase() || '';

      if (nombre.includes(texto) || categoria.includes(texto) || descripcion.includes(texto)) {
        prod.style.display = 'flex';
        coincidencias++;
      } else {
        prod.style.display = 'none';
      }
    });

    // mostrar/ocultar categoría y título
    grupo.style.display = coincidencias > 0 ? 'block' : 'none';
    const titulo = grupo.querySelector('.titulo-categoria');
    if (titulo) {
      titulo.style.display = texto ? 'none' : 'block';
    }
  });
});

// cerrar sugerencias al click fuera
document.addEventListener('click', (e) => {
  if (!document.getElementById('buscador').contains(e.target) && !sugerenciasDiv.contains(e.target)) {
    if (sugerenciasDiv) sugerenciasDiv.style.display = 'none';
  }
});

// --- FILTROS Y ORDENAMIENTO ---
function llenarSelectCategorias(listaProductos) {
  const select = document.getElementById('filtro-categoria');
  if (!select) return;
  const categorias = Array.from(new Set(listaProductos.map(p => p.categoria || 'Sin categoría')));
  const actual = select.value || 'todos';
  select.innerHTML = `<option value="todos">Todas</option>` + categorias.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  select.value = actual;
}

document.getElementById('orden')?.addEventListener('change', () => aplicarFiltrosYOrden());
document.getElementById('filtro-categoria')?.addEventListener('change', () => aplicarFiltrosYOrden());

function aplicarFiltrosYOrden() {
  const orden = document.getElementById('orden')?.value || 'default';
  const categoria = document.getElementById('filtro-categoria')?.value || 'todos';

  let lista = productos.slice();

  if (categoria && categoria !== 'todos') {
    lista = lista.filter(p => p.categoria === categoria);
  }

  switch (orden) {
    case 'precio-asc':
      lista.sort((a,b) => a.precio - b.precio);
      break;
    case 'precio-desc':
      lista.sort((a,b) => b.precio - a.precio);
      break;
    case 'masvendido':
      lista.sort((a,b) => (b.masvendido?1:0) - (a.masvendido?1:0));
      break;
    case 'nuevo':
      lista.sort((a,b) => (b.nuevo?1:0) - (a.nuevo?1:0));
      break;
    default:
      // por defecto, mantener orden original
      break;
  }

  renderizarProductos(lista);
}

// --- FUNCIONES DE CARRITO (manteniendo lo original) ---
function agregarAlCarrito(boton) {
  const productoElem = boton.closest('.producto');
  const nombre = productoElem.dataset.nombre;
  const precio = parseFloat(productoElem.dataset.precio);
  const cantidad = parseInt(productoElem.querySelector('.cantidad-input').value);

  // encontrar producto en data master
  const prodIndex = productos.findIndex(p => p.nombre === nombre);
  if (prodIndex === -1) {
    alert('Producto no encontrado.');
    return;
  }
  const prodObj = productos[prodIndex];

  if (prodObj.stock <= 0) {
    alert('No hay stock disponible');
    return;
  }

  // verificar cantidad solicitada <= stock
  if (cantidad > prodObj.stock) {
    alert(``);
    return;
  }

  const existente = carrito.find(item => item.nombre === nombre);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({ nombre, precio, cantidad });
  }

  // disminuir stock en memoria y DOM, y guardar en localStorage
  prodObj.stock -= cantidad;
  actualizarStockEnDOM(nombre, prodObj.stock);
  persistirStock();

  guardarCarritoEnLocalStorage();
  mostrarPopup();
  animarCarrito();
  actualizarCarrito();
  actualizarMiniCarrito();
}

function eliminarDelCarrito(index) {
  // cuando se elimina, devolver stock al producto correspondiente
  const item = carrito[index];
  if (item) {
    const prodIndex = productos.findIndex(p => p.nombre === item.nombre);
    if (prodIndex !== -1) {
      productos[prodIndex].stock += item.cantidad;
      actualizarStockEnDOM(item.nombre, productos[prodIndex].stock);
      persistirStock();
    }
  }
  carrito.splice(index, 1);
  guardarCarritoEnLocalStorage();
  actualizarCarrito();
  actualizarMiniCarrito();
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
      <div>${escapeHtml(item.nombre)} x ${item.cantidad}</div>
      <div>$${(item.precio * item.cantidad).toLocaleString()}</div>
      <button data-index="${index}">&times;</button>
    `;
    const btn = itemDiv.querySelector('button');
    btn.addEventListener('click', () => eliminarDelCarrito(index));
    carritoItems.appendChild(itemDiv);
    total += item.precio * item.cantidad;
    cantidadTotal += item.cantidad;
  });

  document.getElementById('total').textContent = 'Total: $' + total.toLocaleString();
  document.getElementById('contador-carrito').textContent = cantidadTotal;
  // almacenar total global
  totalGlobal = total;

  // actualizar dataset del boton enviar-whatsapp para construir mensaje
  const enviarBtn = document.getElementById('enviar-whatsapp');
  if (enviarBtn) {
    let mensaje = '';
    carrito.forEach(item => {
      mensaje += `• ${item.nombre} x ${item.cantidad} - $${(item.precio * item.cantidad).toLocaleString()}\n`;
    });
    mensaje += `\nTotal: $${total.toLocaleString()}`;
    enviarBtn.dataset.mensaje = mensaje;
  }

  guardarCarritoEnLocalStorage();
  actualizarMiniCarrito();
}

function mostrarPopup() {
  const popup = document.getElementById('popup');
  if (popup) {
    popup.style.display = 'block';
    setTimeout(() => {
      popup.style.display = 'none';
    }, 1000);
  }
}

function cambiarCantidad(boton, delta) {
  const input = boton.parentElement.querySelector('.cantidad-input');
  let cantidad = parseInt(input.value) || 1;
  cantidad += delta;
  if (cantidad < 1) cantidad = 1;
  input.value = cantidad;
}

function mostrarModalInfo(nombre, descripcion) {
  document.getElementById('modal-titulo').textContent = nombre;
  document.getElementById('modal-descripcion').textContent = descripcion;
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

// --- STOCK DINÁMICO: actualizar DOM y persistir stock en localStorage ---
function actualizarStockEnDOM(nombreProducto, nuevoStock) {
  // actualizar el objeto productos
  const prod = productos.find(p => p.nombre === nombreProducto);
  if (prod) prod.stock = nuevoStock;

  // actualizar botón y overlays en cards
  document.querySelectorAll('.producto').forEach(card => {
    const n = card.dataset.nombre;
    if (n === nombreProducto) {
      const boton = card.querySelector('button.boton');
      const menos = card.querySelector('button.menos');
      const mas = card.querySelector('button.mas');
      const sinStockOverlay = card.querySelector('.sin-stock-overlay');

      // actualizar urgencia
      let urg = card.querySelector('.stock-urgente');
      if (nuevoStock > 0 && nuevoStock <= 3) {
        if (!urg) {
          urg = document.createElement('div');
          urg.className = 'stock-urgente';
          urg.textContent = ``;
          boton.insertAdjacentElement('beforebegin', urg);
        } else {
          urg.textContent = ``;
        }
      } else {
        if (urg) urg.remove();
      }

      if (nuevoStock <= 0) {
        if (boton) {
          boton.disabled = true;
          boton.style.background = '#ccc';
          boton.style.cursor = 'not-allowed';
          boton.textContent = 'Sin stock';
        }
        if (!sinStockOverlay) {
          const overlay = document.createElement('div');
          overlay.className = 'sin-stock-overlay';
          overlay.textContent = 'SIN STOCK';
          card.querySelector('.producto-imagen-container')?.appendChild(overlay);
        } else {
          sinStockOverlay.style.display = 'block';
        }
        if (mas) mas.disabled = true;
      } else {
        if (boton) {
          boton.disabled = false;
          boton.style.background = '';
          boton.style.cursor = '';
          boton.textContent = 'Agregar al carrito';
        }
        if (sinStockOverlay) sinStockOverlay.style.display = 'none';
        if (mas) mas.disabled = false;
      }
    }
  });

  // guardar en localStorage el stock actualizado
  persistirStock();
}

function persistirStock() {
  const stockObj = {};
  productos.forEach(p => stockObj[p.nombre] = p.stock);
  guardarStockEnLocalStorage(stockObj);
}

// --- MINI-CARRITO: mostrar resumen rápido al pasar mouse o tocar ícono ---
const carritoIconoElem = document.getElementById('carrito-icono');
const miniCarritoElem = document.getElementById('mini-carrito');

function actualizarMiniCarrito() {
  const miniItems = document.getElementById('mini-items');
  const miniTotal = document.getElementById('mini-total');
  if (!miniItems || !miniTotal) return;

  miniItems.innerHTML = '';
  let total = 0;
  carrito.forEach(item => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '6px';
    row.innerHTML = `<div>${escapeHtml(item.nombre)} x ${item.cantidad}</div><div>$${(item.precio * item.cantidad).toLocaleString()}</div>`;
    miniItems.appendChild(row);
    total += item.precio * item.cantidad;
  });
  miniTotal.textContent = `Total: $${total.toLocaleString()}`;
  document.getElementById('contador-carrito').textContent = carrito.reduce((s, i) => s + i.cantidad, 0);
}

// mostrar mini-carrito al hover (desktop) y al touch (mobile)
if (carritoIconoElem && miniCarritoElem) {
  carritoIconoElem.addEventListener('mouseenter', () => {
    miniCarritoElem.style.display = 'block';
  });
  carritoIconoElem.addEventListener('mouseleave', () => {
    miniCarritoElem.style.display = 'none';
  });

  // toggle on click for mobile
  carritoIconoElem.addEventListener('click', (e) => {
    e.preventDefault();
    const carritoPanel = document.getElementById('carrito');
    // show carrito panel for checkout
    carritoPanel.classList.toggle('mostrar');
  });
}

// --- RESUMEN / CONFIRMAR COMPRA (manteniendo original) ---
document.getElementById('confirmar')?.addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  descuentoGlobal = 0;
  document.getElementById('cupon-feedback').textContent = '';
  document.getElementById('resumen-modal').style.display = 'flex';
  calcularResumen();
});

function calcularResumen() {
  const resumen = document.getElementById('resumen-contenido');
  resumen.innerHTML = '';
  totalGlobal = 0;
  let mensaje = '';

  carrito.forEach(item => {
    const linea = `${item.nombre} x ${item.cantidad} - $${(item.precio * item.cantidad).toLocaleString()}`;
    resumen.innerHTML += `<div style="margin-bottom: 0.4rem;">${escapeHtml(linea)}</div>`;
    mensaje += `• ${linea}\n`;
    totalGlobal += item.precio * item.cantidad;
  });

  resumen.innerHTML += `<div style="margin-top: 1rem;">Subtotal: $${totalGlobal.toLocaleString()}</div>`;

  if (descuentoGlobal > 0) {
    const montoDescuento = Math.round(totalGlobal * (descuentoGlobal / 100));
    const totalConDescuento = totalGlobal - montoDescuento;

    resumen.innerHTML += `<div>Descuento (${descuentoGlobal}%): -$${montoDescuento.toLocaleString()}</div>`;
    resumen.innerHTML += `<div style="font-weight:bold;">Total: $${totalConDescuento.toLocaleString()}</div>`;
    totalGlobal = totalConDescuento;

    mensaje += `\nSubtotal: $${(totalGlobal + montoDescuento).toLocaleString()}`;
    mensaje += `\nDescuento (${descuentoGlobal}%): -$${montoDescuento.toLocaleString()}`;
    mensaje += `\nTotal: $${totalConDescuento.toLocaleString()}`;
  } else {
    resumen.innerHTML += `<div style="font-weight:bold;">Total: $${totalGlobal.toLocaleString()}</div>`;
    mensaje += `\nTotal: $${totalGlobal.toLocaleString()}`;
  }

  document.getElementById('enviar-whatsapp').dataset.mensaje = mensaje;
}

// aplicar cupon (manteniendo la lógica y la carga desde sheet)
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
});

document.getElementById('enviar-whatsapp')?.addEventListener('click', async () => {
  const nombreCliente = document.getElementById('nombre-cliente')?.value.trim();
  if (!nombreCliente) {
    alert("Por favor, ingresá tu nombre antes de enviar el pedido.");
    return;
  }

  let mensaje = document.getElementById('enviar-whatsapp').dataset.mensaje || '';
  mensaje = `Hola! mi nombre es ${nombreCliente}, quiero realizar una compra:\n\n` + mensaje;

  // Datos para Google Sheets
  const hoy = new Date();
  const opciones = { year: 'numeric', month: 'long', day: '2-digit' };
  const fechaStr = hoy.toLocaleDateString('es-AR', opciones);
  const mesStr = hoy.toLocaleString('es-AR', { month: 'long', year: 'numeric' });

  const pedidoData = {
    mes: mesStr.charAt(0).toUpperCase() + mesStr.slice(1), // Ej: Septiembre 2025
    comprador: nombreCliente,
    fecha: fechaStr,
    items: carrito.map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio: i.precio
    }))
  };

  try {
    await fetch("https://script.google.com/macros/s/AKfycbx1FauSLBp5k766M-x-aGNmnz1gYGfIEpepHO9FVOoBmVZMD7BPGHy_2VYdGRsbSz0/exec", {
      method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pedidoData)
  });
} catch (e) {
  console.error("Error enviando a Google Sheets", e);
}

  // abrir WhatsApp
  const url = `https://wa.me/5491130335334?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
  document.getElementById('resumen-modal').style.display = 'none';
});


// --- INIT: carga inicial y renderizado, y restaurar carrito desde localStorage ---
document.addEventListener('DOMContentLoaded', async () => {
  cargarCarritoDesdeLocalStorage();

  await cargarProductosDesdeGoogleSheet();
  await cargarCuponesDesdeGoogleSheet();

  // si el carrito tiene items cargados desde localStorage, ajustar stocks
  if (carrito.length > 0) {
    carrito.forEach(item => {
      const prod = productos.find(p => p.nombre === item.nombre);
      if (prod) {
        // si por alguna razón el stock en memoria es menor que la cantidad comprada, ajustamos cantidad y stock
        if (prod.stock >= item.cantidad) {
          prod.stock -= item.cantidad;
        } else {
          // ajustar: reducir cantidad en el carrito a lo disponible
          item.cantidad = Math.max(0, prod.stock);
          prod.stock = 0;
        }
      }
    });
  }

  renderizarProductos(productos);
  aplicarFiltrosYOrden(); // asegura orden inicial
  actualizarCarrito();
  actualizarMiniCarrito();
  // splash cleanup si quedó visible
  if (splash) splash.style.display = 'none';
});

// --- FUNCIONES ADICIONALES PARA UI ---
// cerrar modal resumen si se hace click fuera
document.getElementById('resumen-modal')?.addEventListener('click', function(e) {
  if (e.target === this) {
    this.style.display = 'none';
  }
});

// === Búsqueda en vivo ===
document.getElementById("buscador").addEventListener("input", (e) => {
  const termino = e.target.value.toLowerCase();
  const productos = document.querySelectorAll(".producto");

  productos.forEach((producto) => {
    const nombre = producto.querySelector("h3").textContent.toLowerCase();
    const categoria = producto.querySelector(".categoria-texto")?.textContent.toLowerCase() || "";

    if (nombre.includes(termino) || categoria.includes(termino)) {
      producto.style.display = "flex";
    } else {
      producto.style.display = "none";
    }
  });
});

// Helper: actualizar contador en header
function actualizarContadorCarrito() {
  const totalCantidad = carrito.reduce((s, i) => s + i.cantidad, 0);
  const contador = document.getElementById('contador-carrito');
  if (contador) contador.textContent = totalCantidad;
}

// --- UTILIDADES DE ESCAPE (para evitar roturas si hay caracteres especiales) ---
function escapeHtml(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/[&<>"']/g, function (m) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m];
  });
}
function escapeBackticks(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
function escapeJs(text) {
  if (!text && text !== 0) return '';
  return String(text).replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

// --- Manejo cierre del mini sugerencias cuando el usuario borra input o cambia focus ---
document.getElementById('buscador')?.addEventListener('blur', () => {
  setTimeout(() => {
    if (sugerenciasDiv) sugerenciasDiv.style.display = 'none';
  }, 200);
});

// Inicio: iniciar progress simulado cuando se prepara la carga (por seguridad)
iniciarProgressSimulado();
