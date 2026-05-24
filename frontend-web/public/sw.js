self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sem cache de dados privados, sem cache de chat, PDFs ou chamadas Supabase/Edge.