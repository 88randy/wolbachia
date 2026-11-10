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
  const add = () => {
    setNotice(reception.recordScan(transfer, { code: scan, quantity }));
    setScan("");
    scanner.current?.focus();
  };
  const changeScan = (event: ChangeEvent<HTMLInputElement>) => {
    setScan(event.target.value);
  };
  const changeQuantity = (event: ChangeEvent<HTMLInputElement>) => {
    setQuantity(event.target.value);
  };
  return { scan, setScan, quantity, setQuantity, notice, scanner, add, changeScan, changeQuantity };
}
