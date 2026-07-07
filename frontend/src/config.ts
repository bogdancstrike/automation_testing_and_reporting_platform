interface QtpConfig {
  apiBase: string;
  keycloakUrl: string;
  keycloakRealm: string;
  keycloakClientId: string;
}

const injected = (window as any).__QTP__ || {};

export const config: QtpConfig = {
  apiBase: injected.apiBase || "http://localhost:5100/qtp",
  keycloakUrl: injected.keycloakUrl || "http://localhost:8080",
  keycloakRealm: injected.keycloakRealm || "qtp",
  keycloakClientId: injected.keycloakClientId || "qtp-spa",
};
