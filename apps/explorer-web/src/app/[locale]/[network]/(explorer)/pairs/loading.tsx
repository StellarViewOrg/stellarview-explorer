import { LoadingCard } from "@/components/common/loading-card";
import { PairTableSkeleton } from "@/components/pairs";

export default function PairsLoading() {
  return (
    <div className="space-y-6">
      <LoadingCard rows={2} />
      <PairTableSkeleton rows={10} />
    </div>
  );
}
