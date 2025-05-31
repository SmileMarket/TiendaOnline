// === Leer stock desde Google Sheets ===
let stockData = {};

function cargarStockDesdeGoogleSheet() {
  Tabletop.init({
    key: '1xWB7Wy37IGoWWnXuA7QVCPCbgHSxgNQKk_FQerbamFQ',
    simpleSheet: true,
    callback: function(data) {
      stockData = {};
      data.forEach(item => {
        stockData[item.nombre] = parseInt(item.stock);
      });
      renderizarProductos();
    }
  });
}

// === Carrito y funciones ===
const carrito = [];

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

  mostrarPopup();
  actualizarCarrito();
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
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
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 1000);
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

function agregarRecomendaciones(productoElement, recomendacionesArray) {
  if (!productoElement || !Array.isArray(recomendacionesArray)) return;
  const recomendacionesDiv = document.createElement('div');
  recomendacionesDiv.className = 'recomendaciones';
  const contenido = recomendacionesArray.map(item => `<li>${item}</li>`).join('');
  recomendacionesDiv.innerHTML = `<strong>Recomendado:</strong><ul style="padding-left: 1.2rem; margin: 0.3rem 0;">${contenido}</ul>`;
  productoElement.appendChild(recomendacionesDiv);
}

function renderizarProductos() {
  const contenedor = document.getElementById('productos');
  contenedor.innerHTML = '';
  const productosPorCategoria = {};

  productos.forEach(producto => {
    const categoria = producto.categoria || 'Sin categoría';
    if (!productosPorCategoria[categoria]) {
      productosPorCategoria[categoria] = [];
    }
    productosPorCategoria[categoria].push(producto);
  });

  const recomendacionesPorProducto = {
    'Lima K Acero #15 25mm C/U': ['Organizador', 'Caja Mini Endo 72', 'Punta P1 de cavitador'],
    'Turbina con luz de LED': ['Micromotor neumático', 'Contra ángulo', 'Kit NSK Violeta'],
    'Kit de cirugía E': ['Campo fenestrado adicional', 'Tubuladura plástica x 100'],
    'Microbrush': ['Pinceles de silicona', 'Organizador'],
    'Kit NSK Violeta': ['Limas K', 'Caja mini endo', 'Lubricante de piezas de mano'],
    'Endo Z - EN PROMO!': ['Limas H', 'Organizador', 'Caja esterilizadora']
  };

  for (const categoria in productosPorCategoria) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-categoria';

    const titulo = document.createElement('h2');
    titulo.textContent = categoria;
    titulo.id = `cat-${categoria.toLowerCase().replace(/\s+/g, '-')}`;
    grupo.appendChild(titulo);

    const contenedorCategoria = document.createElement('div');
    contenedorCategoria.className = 'productos';

    productosPorCategoria[categoria].forEach(producto => {
      const div = document.createElement('div');
      div.className = 'producto';
      div.dataset.nombre = producto.nombre;
      div.dataset.precio = producto.precio;
      div.dataset.descripcion = producto.descripcion || '';
      div.dataset.categoria = producto.categoria || '';

      div.innerHTML = `
        ${producto.imagen ? `
          <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`)">
            <img src="${producto.imagen}" alt="${producto.nombre}" style="max-width:100%; height:auto; margin-bottom:10px;" />
            <div class="info-overlay">+ info</div>
          </div>
        ` : ''}
        <h3>${producto.nombre}</h3>
        <p class="categoria-texto">${producto.categoria}</p>
        <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
        <div class="control-cantidad">
          <button class="menos" onclick="cambiarCantidad(this, -1)">−</button>
          <input class="cantidad-input" type="number" value="1" min="1" readonly />
          <button class="mas" onclick="cambiarCantidad(this, 1)">+</button>
        </div>
        <button class="boton" onclick="agregarAlCarrito(this)">Agregar al carrito</button>
      `;

      const recomendaciones = recomendacionesPorProducto[producto.nombre];
      if (recomendaciones) {
        agregarRecomendaciones(div, recomendaciones);
      }

      // Stock check
      const stock = stockData[producto.nombre] ?? 99;
      if (stock === 0) {
        const overlay = document.createElement('div');
        overlay.textContent = 'SIN STOCK';
        overlay.style.position = 'absolute';
        overlay.style.top = '8px';
        overlay.style.left = '8px';
        overlay.style.background = 'rgba(255,0,0,0.85)';
        overlay.style.color = 'white';
        overlay.style.padding = '4px 8px';
        overlay.style.borderRadius = '4px';
        overlay.style.fontWeight = 'bold';
        div.querySelector('.producto-imagen-container')?.appendChild(overlay);

        const boton = div.querySelector('.boton');
        boton.disabled = true;
        boton.style.opacity = '0.5';
        boton.textContent = 'Sin stock';
      }

      contenedorCategoria.appendChild(div);
    });

    grupo.appendChild(contenedorCategoria);
    contenedor.appendChild(grupo);
  }

  const inputBuscador = document.getElementById('buscador');
  inputBuscador.addEventListener('input', () => {
    const termino = inputBuscador.value.trim().toLowerCase();
    const productosDOM = document.querySelectorAll('.producto');

    if (termino === '') {
      productosDOM.forEach(producto => {
        producto.style.display = '';
        const nombreElem = producto.querySelector('h3');
        const categoriaElem = producto.querySelector('.categoria-texto');
        nombreElem.innerHTML = producto.dataset.nombre;
        categoriaElem.innerHTML = producto.dataset.categoria;
      });
      return;
    }

    productosDOM.forEach(producto => {
      const nombre = producto.dataset.nombre.toLowerCase();
      const descripcion = (producto.dataset.descripcion || '').toLowerCase();
      const categoria = (producto.dataset.categoria || '').toLowerCase();
      const coincide = nombre.includes(termino) || descripcion.includes(termino) || categoria.includes(termino);

      if (coincide) {
        producto.style.display = '';
        const nombreElem = producto.querySelector('h3');
        const categoriaElem = producto.querySelector('.categoria-texto');
        nombreElem.innerHTML = producto.dataset.nombre;
        categoriaElem.innerHTML = producto.dataset.categoria;
        const terminoRegex = new RegExp(`(${termino})`, 'gi');
        const nombreResaltado = producto.dataset.nombre.replace(terminoRegex, '<mark style="background-color: #f7b0f7;">$1</mark>');
        const categoriaResaltada = producto.dataset.categoria.replace(terminoRegex, '<mark style="background-color: #f7b0f7;">$1</mark>');
        nombreElem.innerHTML = nombreResaltado;
        categoriaElem.innerHTML = categoriaResaltada;
      } else {
        producto.style.display = 'none';
      }
    });
  });
}

// === Iniciar app ===
document.addEventListener('DOMContentLoaded', () => {
  cargarStockDesdeGoogleSheet();
});
