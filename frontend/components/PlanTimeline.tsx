"use client";

import Link from "next/link";
import type { PlanSpotItem } from "@/lib/api";
import StarRating from "./StarRating";

interface PlanTimelineProps {
  items: PlanSpotItem[];
  budget: number;
}

export default function PlanTimeline({ items, budget }: PlanTimelineProps) {
  const total = items.reduce((sum, i) => sum + i.budget_est, 0);

  return (
    <div className="glass flex h-full flex-col">
      <div className="border-b border-white/50 px-5 py-4">
        <h2 className="text-base font-bold text-[#5c4030]">今日の予定</h2>
        <p className="mt-1 text-sm text-[#7a6555]">
          予算 {budget.toLocaleString()}円 / 使う見込み {total.toLocaleString()}円
        </p>
      </div>

      <div className="flex-1 space-y-0 overflow-y-auto p-4">
        {items.map((item, idx) => {
          const [start, end] = item.time.split("-");
          const spotId = item.source_id || encodeURIComponent(item.name);

          return (
            <div key={`${item.name}-${idx}`} className="relative flex gap-4 pb-6">
              {idx < items.length - 1 && (
                <div className="absolute left-[18px] top-10 h-[calc(100%-16px)] w-px bg-[#c4b5a5]" />
              )}
              <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8b5e3c] text-xs font-bold text-white">
                {idx + 1}
              </div>
              <div className="glass-soft min-w-0 flex-1 p-4">
                <p className="text-sm font-medium text-[#8b5e3c]">
                  {start} - {end}
                </p>
                <h3 className="mt-1 text-base font-bold text-[#2c2419]">{item.name}</h3>
                {item.is_user_destination && (
                  <span className="mt-1 inline-block rounded-full bg-[#8b5e3c]/10 px-2 py-0.5 text-xs text-[#8b5e3c]">
                    あなたが選んだ場所
                  </span>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-medium text-[#5c4030]">
                    {item.budget_est > 0 ? `約 ${item.budget_est.toLocaleString()}円` : "無料"}
                  </span>
                  <StarRating rating={item.rating} reviewCount={item.review_count} />
                </div>
                {item.address && (
                  <p className="mt-1 text-xs text-[#8b7355]">{item.address}</p>
                )}
                <Link
                  href={`/spots/${spotId}?source=${item.source}`}
                  className="mt-3 inline-block text-sm font-medium text-[#8b5e3c] underline underline-offset-2"
                >
                  店の詳細を見る
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
