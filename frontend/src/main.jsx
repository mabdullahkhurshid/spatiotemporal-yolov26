import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App";
import { store } from "./store/store";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";
import { initTheme } from "./utils/theme";

initTheme();

window.addEventListener("unhandledrejection", (event) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", event.reason);
});

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
          <App />
        </ErrorBoundary>
        <Toaster position="top-right" />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);
