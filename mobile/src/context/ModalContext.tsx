import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ModalContextType {
  isImportModalVisible: boolean;
  showImportModal: () => void;
  hideImportModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isImportModalVisible, setIsImportModalVisible] = useState(false);

  const showImportModal = () => {
    setIsImportModalVisible(true);
  };

  const hideImportModal = () => {
    setIsImportModalVisible(false);
  };

  return (
    <ModalContext.Provider
      value={{
        isImportModalVisible,
        showImportModal,
        hideImportModal,
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within ModalProvider');
  }
  return context;
};

