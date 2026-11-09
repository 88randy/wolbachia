import { Card } from "../../ui/Card.tsx";
import { Skeleton } from "../../ui/Skeleton.tsx";

export function FuelLoading() {
  return (
    <Card>
      <Skeleton />
      <Skeleton />
      <Skeleton isShort />
    </Card>
  );
}
