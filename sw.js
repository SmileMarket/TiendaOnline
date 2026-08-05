// sw.js — Service Worker de SmileMarket
//
// Estrategia: "network first, cache como respaldo" para el shell de la
// página (HTML/JS/CSS/imágenes propias). Esto es clave: SIEMPRE intenta
// traer la versión más nueva de internet primero, y solo si falla (por
// ejemplo, sin conexión) usa lo que tenga guardado. Así nunca corre el
// riesgo de mostrarle a alguien una versión vieja de la tienda mientras
// hay internet — el cache es solo una red de seguridad para cuando no hay
// señal, no una fuente de verdad.
//
// Lo que NO se cachea nunca:
//  - Pedidos al backend de Apps Script (doPost / doGet) — siempre tienen
//    que ir a buscar el dato real, nunca servir algo guardado.
//  - La lista de productos (Google Sheets CSV) — el stock y los precios
//    tienen que ser siempre los actuales.

const CACHE_NAME = 'smilemarket-shell-v1';

const ARCHIVOS_SHELL = [
  './',
  './index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARCHIVOS_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    )
  );
  self.clients.claim();
});

function esLlamadaAlBackend(url) {
  // Cualquier request a Google Apps Script (doPost/doGet) o a Google Sheets
  // (CSV de productos/cupones) pasa siempre directo a la red, sin cachear.
  return (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('docs.google.com') ||
    url.hostname.includes('sheets.googleapis.com')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Solo nos metemos con pedidos GET del mismo origen (el shell de la web).
  // Todo lo demás (POST, llamadas cruzadas a Google, etc.) pasa de largo
  // directo a la red, tal cual, sin que el Service Worker lo toque.
  if (request.method !== 'GET' || esLlamadaAlBackend(url)) {
    return; // deja que el navegador lo maneje normal
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((respuestaRed) => {
        // Se pudo traer de internet: la guardamos como respaldo y la devolvemos.
        const copia = respuestaRed.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        return respuestaRed;
      })
      .catch(() => {
        // Sin conexión: buscamos si hay algo guardado de antes.
        return caches.match(request).then((respuestaCache) => {
          return respuestaCache || caches.match('./index.html');
        });
      })
  );
});
