import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntApp, Spin } from "antd";
import "antd/dist/reset.css";
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
        <ConfigProvider theme={{ token: { colorPrimary: "#1677ff", borderRadius: 6 } }}>
          <AntApp>
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>
                <QtpApp />
              </BrowserRouter>
            </QueryClientProvider>
          </AntApp>
        </ConfigProvider>
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
