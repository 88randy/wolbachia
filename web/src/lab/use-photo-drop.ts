import { useEffect, useRef, useState } from "react";
import { readPhotoDropFiles } from "./annotation-photo-file";

interface DropOptions {
  chooseFiles: (files: File[]) => void;
  isAllowed: boolean;
}
interface DropHandlers {
  over: (event: DragEvent) => void;
  leave: () => void;
  drop: (event: DragEvent) => void;
}

function listenToPhotoDrop(handlers: DropHandlers) {
  window.addEventListener("dragenter", handlers.over, true);
  window.addEventListener("dragover", handlers.over, true);
  window.addEventListener("dragleave", handlers.leave, true);
  window.addEventListener("drop", handlers.drop, true);
  return () => {
    window.removeEventListener("dragenter", handlers.over, true);
    window.removeEventListener("dragover", handlers.over, true);
    window.removeEventListener("dragleave", handlers.leave, true);
    window.removeEventListener("drop", handlers.drop, true);
  };
}

/** Own page-wide drops only while the upload step is mounted; child transitions retain the depth. */
export function usePhotoDrop({ chooseFiles, isAllowed }: DropOptions) {
  const [isDragging, setDragging] = useState(false);
  const depth = useRef(0);
  useEffect(() => {
    return listenToPhotoDrop({
      over: (event) => {
        event.preventDefault();
        if (event.type === "dragenter") depth.current += 1;
        setDragging(isAllowed);
      },
      leave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      drop: (event) => {
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        chooseFiles(readPhotoDropFiles(event.dataTransfer));
      },
    });
  }, [chooseFiles, isAllowed]);
  return isDragging && isAllowed;
}
