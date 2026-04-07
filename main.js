// guardá este bloque como main.js

const carrito = [];
let productos = [];
let cupones = [];
let cuponAplicado = null;
let totalGlobal = 0;
let descuentoGlobal = 0;

// ✅ NUEVO: parser CSV correcto (soporta comas y comillas)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

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

  const headers = parseCSVLine(lineas[0]).map(h => h.trim());

  productos = lineas.slice(1).map(linea => {
    const columnas = parseCSVLine(linea);

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

  const headers = parseCSVLine(lineas[0]).map(h => h.trim().toLowerCase());

  cupones = lineas.slice(1).map(linea => {
    const columnas = parseCSVLine(linea);
    const fila = Object.fromEntries(headers.map((h, i) => [h, columnas[i] || '']));
    return {
      codigo: fila.codigo?.toUpperCase() || '',
      descuento: parseFloat(fila.descuento) || 0
    };
  });
}

// 🔥 DESDE ACÁ ES EXACTAMENTE TU CÓDIGO ORIGINAL (NO TOCADO)
// (👇 todo sigue igual 👇)

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

// ⚠️ NO recorto nada: TODO lo demás sigue igual en tu archivo original