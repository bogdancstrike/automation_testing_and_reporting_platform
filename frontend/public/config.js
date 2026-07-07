// Runtime configuration for the QTP SPA. Served statically; edit to point the
// app at a different API / Keycloak without rebuilding the image.
window.__QTP__ = {
  apiBase: "http://localhost:5100/qtp",
  keycloakUrl: "http://localhost:8080",
  keycloakRealm: "qtp",
  keycloakClientId: "qtp-spa",
};
