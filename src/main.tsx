import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./firebase/auth";
import { ToastProvider } from "./context/ToastContext";
import { App } from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
