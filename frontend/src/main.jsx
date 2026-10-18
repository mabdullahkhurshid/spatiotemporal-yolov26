import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { store } from "./store/store";
import ErrorBoundary from "./components/ErrorBoundary";
import { ConfirmProvider } from "./components/ui/Confirm";
import "@fontsource-variable/inter";
import "./index.css";
import { initTheme } from "./utils/theme";

initTheme();

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

// Toasts follow the design tokens (and therefore light/dark theme).
const toastOptions = {
  duration: 4000,
  className: "!rounded-lg !border !border-line !bg-surface !text-fg !text-sm !shadow-overlay !px-3.5 !py-2.5",
  success: { iconTheme: { primary: "rgb(7 148 85)", secondary: "#fff" } },
  error: { duration: 6000, iconTheme: { primary: "rgb(217 45 32)", secondary: "#fff" } },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ErrorBoundary>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ErrorBoundary>
        <Toaster position="top-right" gutter={8} toastOptions={toastOptions} />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
