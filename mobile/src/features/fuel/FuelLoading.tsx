import { Skeleton } from "../../ui/Skeleton.tsx";

export function FuelLoading() {
  return (
    <>
      <Skeleton />
      <Skeleton />
      <Skeleton isShort />
    </>
  );
}
