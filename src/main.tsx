import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProviders } from "./AppProviders";
import "./index.css";  // your CSS with @import "tailwindcss" and Poppins
import "./i18n";         // init i18n

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>
);
