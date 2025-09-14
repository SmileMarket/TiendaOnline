// =========================
// Configuración inicial
// =========================
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=0&single=true&output=csv";
const STOCK_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSm_x_4hR7AM7cghSD1NWOTzf1q8-o3QMhGqQOENtSBRtF0mIkiWPohv3hhbDhuzYGa459Tn3HQXKOL/pub?gid=123456789&single=true&output=csv";

let carrito = [];
let productosData = [];
let stockData = {};

// Splash de carga
const splash = document.getElementById("splash");
const splashBar = document.getElementById("splash-bar");

function updateSplashProgress(porcentaje) {
  if (splashBar) splashBar.style.width = porcentaje + "%";
}

// =========================
// Cargar productos y stock
// =========================
async function cargarDatos() {
  try {
    updateSplashProgress(10);

    const [productosRes, stockRes] = await Promise.all([
      fetch(SHEET_URL),
      fetch(STOCK_URL)
    ]);
    updateSplashProgress(30);

    const productosText = await productosRes.text();
    const stockText = await stockRes.text();
    updateSplashProgress(50);

    const productos = Papa.parse(productosText, { header: true }).data;
    const stock = Papa.parse(stockText, { header: true }).data;

    stock.forEach(item => {
      stockData[item.ID] = parseInt(item.Stock) || 0;
    });

    productosData = productos.filter(p => p.ID);

    mostrarProductos(productosData);
    updateSplashProgress(100);

    setTimeout(() => {
      if (splash) splash.style.display = "none";
    }, 600);

  } catch (error) {
    console.error("Error al cargar datos:", error);
  }
}

// =========================
// Mostrar productos
// =========================
function mostrarProductos(lista) {
  const contenedor = document.getElementById("productos");
  contenedor.innerHTML = "";

  lista.forEach((producto, index) => {
    const stockDisponible = stockData[producto.ID] ?? 0;

    const div = document.createElement("div");
    div.className = "producto";

    div.innerHTML = `
      <div class="producto-imagen-container">
        <img src="${producto.Imagen}" alt="${producto.Nombre}" loading="lazy" style="background:#fff;" />
        ${stockDisponible <= 0 ? `<div class="sin-stock-overlay">SIN STOCK</div>` : ""}
      </div>
      <h3>${producto.Nombre}</h3>
      <div class="categoria-texto">${producto.Categoria || ""}</div>
      <div class="precio">$${producto.Precio}</div>
      <div class="control-cantidad">
        <button onclick="cambiarCantidad('${producto.ID}', -1)">-</button>
        <input type="number" id="cantidad-${producto.ID}" value="1" min="1" />
        <button onclick="cambiarCantidad('${producto.ID}', 1)">+</button>
      </div>
      <button class="boton" onclick="agregarAlCarrito('${producto.ID}')" ${stockDisponible <= 0 ? "disabled" : ""}>Agregar</button>
    `;

    contenedor.appendChild(div);

    updateSplashProgress(Math.round(((index + 1) / lista.length) * 100));
  });
}

// =========================
// Carrito
// =========================
function agregarAlCarrito(id) {
  const producto = productosData.find(p => p.ID === id);
  if (!producto) return;

  const cantidadInput = document.getElementById(`cantidad-${id}`);
  const cantidad = parseInt(cantidadInput?.value) || 1;

  const stockDisponible = stockData[id] ?? 0;
  if (cantidad > stockDisponible) {
    alert("No hay suficiente stock disponible.");
    return;
  }

  const existente = carrito.find(item => item.ID === id);
  if (existente) {
    existente.cantidad += cantidad;
  } else {
    carrito.push({ ...producto, cantidad });
  }

  stockData[id] -= cantidad;

  guardarCarrito();
  renderizarCarrito();
  mostrarPopup("Producto agregado al carrito");
  vibrarCarrito();
}

function cambiarCantidad(id, delta) {
  const input = document.getElementById(`cantidad-${id}`);
  let valor = parseInt(input.value) || 1;
  valor = Math.max(1, valor + delta);
  input.value = valor;
}

function eliminarDelCarrito(id) {
  carrito = carrito.filter(item => item.ID !== id);
  guardarCarrito();
  renderizarCarrito();
}

function renderizarCarrito() {
  const contenedor = document.getElementById("carrito-items");
  contenedor.innerHTML = "";

  let total = 0;

  carrito.forEach(item => {
    const subtotal = item.cantidad * parseFloat(item.Precio);
    total += subtotal;

    const div = document.createElement("div");
    div.className = "carrito-item";
    div.innerHTML = `
      <span>${item.Nombre} x${item.cantidad}</span>
      <span>$${subtotal}</span>
      <button onclick="eliminarDelCarrito('${item.ID}')">&times;</button>
    `;

    contenedor.appendChild(div);
  });

  document.getElementById("total").textContent = `Total: $${total}`;
  document.getElementById("contador-carrito").textContent = carrito.length;
}

// =========================
// LocalStorage
// =========================
function guardarCarrito() {
  localStorage.setItem("carritoSmileMarket", JSON.stringify(carrito));
}

function cargarCarrito() {
  const guardado = localStorage.getItem("carritoSmileMarket");
  if (guardado) {
    carrito = JSON.parse(guardado);
    renderizarCarrito();
  }
}

// =========================
// Utilidades UI
// =========================
function mostrarPopup(texto) {
  const popup = document.getElementById("popup");
  popup.textContent = texto;
  popup.style.display = "block";
  setTimeout(() => popup.style.display = "none", 2000);
}

function vibrarCarrito() {
  const icono = document.getElementById("carrito-icono");
  icono.classList.add("vibrar");
  setTimeout(() => icono.classList.remove("vibrar"), 300);
}

// =========================
// Buscador en vivo
// =========================
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

// =========================
// Inicializar
// =========================
document.addEventListener("DOMContentLoaded", () => {
  cargarCarrito();
  cargarDatos();
});
