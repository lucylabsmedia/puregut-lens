/* PureGut / PurePlate service worker: makes the app load without a connection.
   Change VERSION whenever you upload a new index.html so old caches are cleared. */
const VERSION = 'pureplate-v3';
// The app itself (same folder as this file)
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './icon-maskable-512.png', './apple-touch-icon.png'];
// Small pinned files worth fetching up front; failures here never block the install
const EXTRAS = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js',
  'https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wdth,wght@8..144,25..151,100..1000&display=swap'
];
// Hosts that serve version-pinned libraries and fonts: safe to keep once downloaded
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fastly.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(SHELL).then(() =>
        Promise.all(EXTRAS.map(url => cache.add(new Request(url, { mode: 'cors' })).catch(() => {})))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function keep(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(VERSION).then(cache => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // App files: network first so updates appear straight away, cached copy when offline
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request).then(res => keep(request, res))
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // Pinned libraries (text reader, barcode reader) and fonts: cached copy first
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request, { ignoreVary: true })
        .then(hit => hit || fetch(request).then(res => keep(request, res)))
    );
  }
  // Everything else, including Open Food Facts lookups, always goes to the network
});
