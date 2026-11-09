import { createContext, useContext } from "react";
export interface ReorderItem {
  id: string;
  label: string;
  isDisabled: boolean;
  isBusy?: boolean;
}
export const ReorderContext = createContext<readonly ReorderItem[] | null>(null);
export const useReorderItems = () => useContext(ReorderContext);
