import { CardSkeleton } from "../ui/CardSkeleton";
import page from "../styles/page.module.css";
export function CatalogLoadingState() {
  return (
    <div className={page.page}>
      <CardSkeleton />
    </div>
  );
}
