// API base URL — auto-detects environment
window.API_BASE = (() => {
  const host = window.location.host;
  // If served from same host as backend, use relative URL
  if (host.includes('localhost') || host.includes('127.0.0.1') || host.includes('app.github.dev')) {
    return '/api';
  }
  // Production: replace with Azure App Service URL when deployed
  return '/api';
})();