import { TableSkeleton } from "../ui/TableSkeleton";
export function TableLoading({ columns = 4 }: { columns?: number }) {
  return <TableSkeleton columns={columns} />;
}
