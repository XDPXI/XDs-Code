import React, { createContext, useContext, useState, ReactNode } from "react";

export type ModalType = "alert" | "confirm" | "prompt";

export interface ModalState {
  isOpen: boolean;
  type: ModalType;
  message: string;
  inputValue?: string;
  onConfirm?: (value?: string) => void;
  onCancel?: () => void;
  cancelButton?: string;
  confirmButton?: string;
}

interface ModalContextType {
  modal: ModalState;
  alert: (message: string) => Promise<void>;
  confirm: (
    message: string,
    cancelButton?: string,
    confirmButton?: string,
  ) => Promise<boolean>;
  prompt: (message: string, defaultValue?: string) => Promise<string | null>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "alert",
    message: "",
  });

  const closeModal = () => {
    setModal((prev) => ({ ...prev, isOpen: false }));
  };

  const alert = (message: string): Promise<void> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "alert",
        message,
        onConfirm: () => {
          closeModal();
          resolve();
        },
      });
    });
  };

  const confirm = (
    message: string,
    cancelButton?: string,
    confirmButton?: string,
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "confirm",
        message,
        cancelButton: cancelButton || "Cancel",
        confirmButton: confirmButton || "Confirm",
        onConfirm: () => {
          closeModal();
          resolve(true);
        },
        onCancel: () => {
          closeModal();
          resolve(false);
        },
      });
    });
  };

  const prompt = (
    message: string,
    defaultValue?: string,
  ): Promise<string | null> => {
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: "prompt",
        message,
        inputValue: defaultValue || "",
        onConfirm: (value) => {
          closeModal();
          resolve(value || null);
        },
        onCancel: () => {
          closeModal();
          resolve(null);
        },
      });
    });
  };

  return (
    <ModalContext.Provider
      value={{ modal, alert, confirm, prompt, closeModal }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within ModalProvider");
  }
  return context;
};
