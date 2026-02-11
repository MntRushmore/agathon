import { createContext, useContext } from 'react';

export const DocumentPanelContext = createContext(false);

export function useDocumentPanelOpen() {
  return useContext(DocumentPanelContext);
}
