import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { Transfer } from "./transfer-query";
import type { useReceptionDraft } from "./use-reception-draft";
export function useReceptionScanner(
  transfer: Transfer,
  reception: ReturnType<typeof useReceptionDraft>,
) {
  const [scan, setScan] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notice, setNotice] = useState("ready");
  const scanner = useRef<HTMLInputElement>(null);
  /** The camera passes the code it read; the form button and Enter use the typed one. */
  const add = (code: string = scan) => {
    setNotice(reception.recordScan(transfer, { code, quantity }));
    setScan("");
    scanner.current?.focus();
  };
  const changeQuantity = (event: ChangeEvent<HTMLInputElement>) => {
    setQuantity(event.target.value);
  };
  return { scan, setScan, quantity, setQuantity, notice, scanner, add, changeQuantity };
}
