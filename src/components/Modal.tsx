import React, { useState, useEffect } from "react";
import { useModal } from "../hooks/useModal";

const Modal: React.FC = () => {
  const { modal, closeModal } = useModal();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (modal.isOpen && modal.type === "prompt") {
      setInputValue(modal.inputValue || "");
    }
  }, [modal.isOpen, modal.type, modal.inputValue]);

  const handleConfirm = () => {
    if (modal.type === "prompt") {
      modal.onConfirm?.(inputValue);
    } else {
      modal.onConfirm?.();
    }
  };

  const handleCancel = () => {
    modal.onCancel?.();
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && modal.type !== "prompt") {
      handleConfirm();
    } else if (e.key === "Enter" && modal.type === "prompt" && e.ctrlKey) {
      handleConfirm();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (!modal.isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-container" onKeyDown={handleKeyDown}>
        <div className="modal-body">
          <p className="modal-message">{modal.message}</p>
          {modal.type === "prompt" && (
            <input
              type="text"
              className="modal-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter value..."
              autoFocus
            />
          )}
        </div>

        <div className="modal-footer">
          {(modal.type === "confirm" || modal.type === "prompt") && (
            <button
              className="modal-btn modal-btn-cancel"
              onClick={handleCancel}
            >
              {modal.cancelButton || "Cancel"}
            </button>
          )}
          <button
            className="modal-btn modal-btn-confirm"
            onClick={handleConfirm}
          >
            {modal.confirmButton || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
