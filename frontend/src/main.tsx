import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Spin } from "antd";
import "antd/dist/reset.css";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./index.css";

import { initKeycloak } from "./keycloak";
import QtpApp from "./QtpApp";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
    <Spin size="large" tip="Signing in…" />
  </div>,
);

initKeycloak()
  .then((authenticated) => {
    if (!authenticated) return;
    root.render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <QtpApp />
          </BrowserRouter>
        </QueryClientProvider>
      </React.StrictMode>,
    );
  })
  .catch((e) => {
    root.render(
      <div style={{ padding: 40 }}>
        <h2>Authentication failed</h2>
        <pre>{String(e)}</pre>
      </div>,
    );
  });
