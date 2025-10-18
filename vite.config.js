export default {
    root: '.',  // Use root as base (matches your app.js location)
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: 'index.html'  // Bundles from HTML, pulls in app.js
      }
    },
    server: {
      port: 3000
    }
  };