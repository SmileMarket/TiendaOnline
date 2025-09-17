// guardá este bloque como main.js

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
  } catch (e) { console.warn('No se pudo cargar carrito', e); }
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
      <div>${item.nombre} x ${item.cantidad}</div>
      <div>$${(item.precio * item.cantidad).toLocaleString()}</div>
      <button onclick="eliminarDelCarrito(${index})">&times;</button>
    `;
    carritoItems.appendChild(itemDiv);
    total += item.precio * item.cantidad;
    cantidadTotal += item.cantidad;
  });

  document.getElementById('total').textContent = 'Total: $' + total.toLocaleString();
  document.getElementById('contador-carrito').textContent = cantidadTotal;
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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  iniciarSplash();
  cargarCarritoDesdeLocalStorage();

  await cargarProductosDesdeGoogleSheet();
  await cargarCuponesDesdeGoogleSheet();

  finalizarSplash();

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
        <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`)">
          <img loading="lazy" src="${producto.imagen}" alt="${producto.nombre}" style="width:100%; height:160px; object-fit:contain; background:white;" />
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

  actualizarCarrito();

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

      mensaje += `\nSubtotal: $${(totalGlobal + montoDescuento).toLocaleString()}`;
      mensaje += `\nDescuento (${descuentoGlobal}%): -$${montoDescuento.toLocaleString()}`;
      mensaje += `\nTotal: $${totalConDescuento.toLocaleString()}`;
    } else {
      resumen.innerHTML += `<div style="font-weight:bold;">Total: $${totalGlobal.toLocaleString()}</div>`;
      mensaje += `\nTotal: $${totalGlobal.toLocaleString()}`;
    }

    document.getElementById('enviar-whatsapp').dataset.mensaje = mensaje;
  }

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

  document.getElementById('enviar-whatsapp')?.addEventListener('click', () => {
    const nombreCliente = document.getElementById('nombre-cliente')?.value.trim();
    if (!nombreCliente) {
      alert("Por favor, ingresá tu nombre antes de enviar el pedido.");
      return;
    }

    let mensaje = document.getElementById('enviar-whatsapp').dataset.mensaje;
    mensaje = `Hola! mi nombre es ${nombreCliente}, quiero realizar una compra:\n\n` + mensaje;

    const url = `https://wa.me/5491130335334?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    document.getElementById('resumen-modal').style.display = 'none';
  });

  document.getElementById('seguir-comprando')?.addEventListener('click', () => {
    document.getElementById('resumen-modal').style.display = 'none';
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

window.agregarAlCarrito = agregarAlCarrito;
window.eliminarDelCarrito = eliminarDelCarrito;
window.cambiarCantidad = cambiarCantidad;
window.mostrarModalInfo = mostrarModalInfo;
window.cerrarModalInfo = cerrarModalInfo;

setInterval(guardarCarritoEnLocalStorage, 3000);
