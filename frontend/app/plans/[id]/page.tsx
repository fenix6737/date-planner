"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getPlan, type PlanResponse } from "@/lib/api";
import type { PlanSpotItem } from "@/lib/api";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

export default function PlanDetailPage({ params }: { params: { id: string } }) {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlan(Number(params.id))
      .then(setPlan)
      .catch((err) => setError(err instanceof Error ? err.message : "読み込み失敗"));
  }, [params.id]);

  if (error) {
    return <p role="alert" className="text-red-700">{error}</p>;
  }

  if (!plan) {
    return <p>読み込み中...</p>;
  }

  const items: PlanSpotItem[] = plan.items.map((item) => ({
    name: item.spot.name,
    lat: item.spot.lat,
    lng: item.spot.lng,
    time: `${item.start_time}-${item.end_time}`,
    budget_est: item.spot.price,
    rating: item.spot.rating,
    category: item.spot.category,
    source: item.spot.source,
    source_id: item.spot.id,
    address: item.spot.address,
    image_url: item.spot.image_url,
    hours: item.spot.hours,
    url: item.spot.url,
  }));

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-brown">保存済みプラン #{plan.id}</h2>
      <PlanMap
        startLat={plan.start_lat}
        startLng={plan.start_lng}
        items={items}
        totalTime={plan.total_time}
        totalDistance={plan.total_distance}
        totalPrice={plan.total_price}
      />
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="card">
            <p className="text-sm text-brown">{item.time}</p>
            <h3 className="text-lg font-bold">{item.name}</h3>
            <p className="text-sm">¥{item.budget_est.toLocaleString()}</p>
          </div>
        ))}
      </div>
      <Link href="/" className="btn-primary inline-block">
        新しいプランを作成
      </Link>
    </section>
  );
}
