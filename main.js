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

document.addEventListener('DOMContentLoaded', () => {
  const confirmarBtn = document.getElementById('confirmar');
  if (confirmarBtn) {
    confirmarBtn.addEventListener('click', () => {
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

      const whatsappBtn = document.getElementById('enviar-whatsapp');
      const modal = document.getElementById('resumen-modal');
      if (whatsappBtn && modal) {
        whatsappBtn.dataset.mensaje = mensaje;
        modal.style.display = 'flex';
      }
    });
  }

  const whatsappBtn = document.getElementById('enviar-whatsapp');
  if (whatsappBtn) {
    whatsappBtn.addEventListener('click', () => {
      const mensaje = whatsappBtn.dataset.mensaje;
      const numeroWhatsApp = '5491130335334';
      const url = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
      const modal = document.getElementById('resumen-modal');
      if (modal) modal.style.display = 'none';
    });
  }

  const cancelarBtn = document.getElementById('cancelar-resumen');
  if (cancelarBtn) {
    cancelarBtn.addEventListener('click', () => {
      const modal = document.getElementById('resumen-modal');
      if (modal) modal.style.display = 'none';
    });
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
      <div class="control-cantidad">
        <button class="menos" onclick="cambiarCantidad(this, -1)">−</button>
        <input class="cantidad-input" type="number" value="1" min="1" readonly />
        <button class="mas" onclick="cambiarCantidad(this, 1)">+</button>
      </div>
      <button class="boton" onclick="agregarAlCarrito(this)">Agregar al carrito</button>
    `;
    contenedor.appendChild(div);
  });

  if (!document.getElementById('resumen-modal')) {
    const modal = document.createElement('div');
    modal.id = 'resumen-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.innerHTML = `
      <div style="background:white; padding:20px; border-radius:6px; max-width:400px; width:100%">
        <h2>Resumen de tu pedido</h2>
        <div id="resumen-contenido" style="margin-bottom: 1rem;"></div>
        <button id="enviar-whatsapp" class="boton" style="margin-bottom:10px;">Enviar por WhatsApp</button>
        <button id="cancelar-resumen" class="boton" style="background:#ccc; color:#333">Cancelar</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
});
