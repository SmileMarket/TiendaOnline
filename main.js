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
  });

  document.getElementById('total').textContent = 'Total: $' + total.toLocaleString();
}

function mostrarPopup() {
  const popup = document.getElementById('popup');
  popup.style.display = 'block';
  setTimeout(() => {
    popup.style.display = 'none';
  }, 1000);
}

document.getElementById('confirmar').addEventListener('click', () => {
  if (carrito.length === 0) {
    alert('Tu carrito está vacío.');
    return;
  }

  const resumen = document.getElementById('resumen-contenido');
  resumen.innerHTML = '';
  let mensaje = 'Hola! Quiero realizar una compra:\n';
  let total = 0;

  carrito.forEach(item => {
    const linea = `${item.nombre} x ${item.cantidad} - $${(item.precio * item.cantidad).toLocaleString()}`;
    resumen.innerHTML += `<div style="margin-bottom: 0.4rem;">${linea}</div>`;
    mensaje += `• ${linea}\n`;
    total += item.precio * item.cantidad;
  });

  mensaje += `\nTotal: $${total.toLocaleString()}`;
  resumen.innerHTML += `<div style="margin-top: 1rem; font-weight: bold;">Total: $${total.toLocaleString()}</div>`;

  document.getElementById('enviar-whatsapp').dataset.mensaje = mensaje;
  document.getElementById('resumen-modal').style.display = 'flex';
});

document.getElementById('enviar-whatsapp').addEventListener('click', () => {
  const mensaje = document.getElementById('enviar-whatsapp').dataset.mensaje;
  const numeroWhatsApp = '5491130335334';
  const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
  document.getElementById('resumen-modal').style.display = 'none';
});

document.getElementById('cancelar-resumen').addEventListener('click', () => {
  document.getElementById('resumen-modal').style.display = 'none';
});

function mostrarModalInfo(nombre, descripcion) {
  document.getElementById('modal-titulo').textContent = nombre;
  document.getElementById('modal-descripcion').textContent = descripcion;
  document.getElementById('info-modal').style.display = 'flex';
}

function cerrarModalInfo() {
  document.getElementById('info-modal').style.display = 'none';
}

const contenedor = document.getElementById('productos');
productos.forEach(producto => {
  const div = document.createElement('div');
  div.className = 'producto';
  div.dataset.nombre = producto.nombre;
  div.dataset.precio = producto.precio;
  div.dataset.descripcion = producto.descripcion || 'Sin descripción disponible';

  div.innerHTML = `
    ${producto.imagen ? `
      <div class="producto-imagen-container" onclick="mostrarModalInfo('${producto.nombre}', \`${producto.descripcion || 'Sin descripción disponible'}\`)">
        <img src="${producto.imagen}" alt="${producto.nombre}" style="max-width:100%; height:auto; margin-bottom:10px;" />
        <div class="info-overlay">+ info</div>
      </div>
    ` : ''}
    <h3>${producto.nombre}</h3>
    <p class="precio">$ ${producto.precio.toLocaleString("es-AR")},00</p>
    <input class="cantidad-input" type="number" value="1" min="1" />
    <button class="boton" onclick="agregarAlCarrito(this)">Agregar al carrito</button>
  `;
  contenedor.appendChild(div);
});
