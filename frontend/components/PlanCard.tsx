"use client";

import { useSwipeable } from "react-swipeable";
import Link from "next/link";
import type { PlanSpotItem } from "@/lib/api";

interface PlanCardProps {
  item: PlanSpotItem;
  index: number;
  onRemove: (index: number) => void;
}

export default function PlanCard({ item, index, onRemove }: PlanCardProps) {
  const handlers = useSwipeable({
    onSwipedLeft: () => onRemove(index),
    trackMouse: true,
  });

  const spotId = item.source_id || encodeURIComponent(item.name);

  return (
    <div {...handlers} className="card relative touch-pan-y">
      <div className="mb-1 text-sm text-brown/70">スワイプで除外 →</div>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-brown">{item.time}</p>
          <h3 className="text-lg font-bold text-black">{item.name}</h3>
          {item.category && (
            <span className="mt-1 inline-block rounded bg-brown/10 px-2 py-0.5 text-xs text-brown">
              {item.category}
            </span>
          )}
          <p className="mt-2 text-sm text-black/80">
            予算目安: ¥{item.budget_est.toLocaleString()} ／ 評価: {item.rating || "—"}
          </p>
          {item.address && <p className="mt-1 text-sm text-black/70">{item.address}</p>}
        </div>
        <Link
          href={`/spots/${spotId}?source=${item.source}`}
          className="btn-primary shrink-0 px-4 py-2 text-sm"
          aria-label={`${item.name}の詳細を見る`}
        >
          詳細
        </Link>
      </div>
    </div>
  );
}
