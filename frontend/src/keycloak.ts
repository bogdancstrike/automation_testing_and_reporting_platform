import Keycloak from "keycloak-js";
import { config } from "./config";

export const keycloak = new Keycloak({
  url: config.keycloakUrl,
  realm: config.keycloakRealm,
  clientId: config.keycloakClientId,
});

let initialized = false;

export async function initKeycloak(): Promise<boolean> {
  if (initialized) return keycloak.authenticated ?? false;
  initialized = true;
  return keycloak.init({
    onLoad: "login-required",
    pkceMethod: "S256",
    checkLoginIframe: false,
  });
}

/** Return a fresh access token, refreshing if it expires within 30s. */
export async function getToken(): Promise<string> {
  try {
    await keycloak.updateToken(30);
  } catch {
    keycloak.login();
  }
  return keycloak.token || "";
}
