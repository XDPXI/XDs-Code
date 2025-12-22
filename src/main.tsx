import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app.tsx";
import { ModalProvider } from "./hooks/useModal";
import Modal from "./components/Modal";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ModalProvider>
      <App />
      <Modal />
    </ModalProvider>
  </React.StrictMode>,
);
