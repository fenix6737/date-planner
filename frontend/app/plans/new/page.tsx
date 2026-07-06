"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import Link from "next/link";
import PlanTimeline from "@/components/PlanTimeline";
import DateChecklist from "@/components/DateChecklist";
import PlanExport from "@/components/PlanExport";
import PlanMemo from "@/components/PlanMemo";
import { savePlan, type GeneratePlanResponse, type PlanSpotItem } from "@/lib/api";
import { loadSavedNote } from "@/lib/storage";

const PlanMap = dynamic(() => import("@/components/PlanMap"), { ssr: false });

interface StoredPlan {
  plan: GeneratePlanResponse;
  meta: {
    date: string;
    budget: number;
    gender: string;
    route_style: string;
    time_start: string;
    time_end: string;
    start_lat: number;
    start_lng: number;
    address: string;
    destinations: { name: string; lat: number; lng: number }[];
    memo?: string;
  };
}

const STYLE_LABELS: Record<string, string> = {
  relaxed: "のんびり",
  active: "アスレチック",
  stylish: "おしゃれ",
};

export default function NewPlanPage() {
  const [stored, setStored] = useState<StoredPlan | null>(null);
  const [items, setItems] = useState<PlanSpotItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("generatedPlan");
    if (!raw) return;
    const data = JSON.parse(raw) as StoredPlan;
    setStored(data);
    setItems(data.plan.plan);
  }, []);

  const handleSave = async () => {
    if (!stored) return;
    setSaving(true);
    setError(null);
    try {
      const result = await savePlan({
        date: stored.meta.date,
        start_lat: stored.meta.start_lat,
        start_lng: stored.meta.start_lng,
        budget: stored.meta.budget,
        preferences: {
          gender: stored.meta.gender,
          route_style: stored.meta.route_style,
          time_start: stored.meta.time_start,
          time_end: stored.meta.time_end,
        },
        total_time: stored.plan.total_time,
        total_distance: stored.plan.total_distance,
        total_price: items.reduce((s, i) => s + i.budget_est, 0),
        items,
      });
      const url = `${window.location.origin}${result.share_url}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  if (!stored) {
    return (
      <div className="glass p-8 text-center">
        <p className="mb-4 text-[#7a6555]">プランがありません。先に条件を入力してください。</p>
        <Link href="/" className="btn-primary inline-block">入力画面へ</Link>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass px-5 py-4">
        <h2 className="text-xl font-bold text-[#5c4030]">あなたのデートプラン</h2>
        <p className="mt-1 text-sm text-[#7a6555]">
          {stored.meta.address} 発 / {STYLE_LABELS[stored.meta.route_style] || stored.meta.route_style} /
          {stored.plan.total_time} / {stored.plan.total_distance}
        </p>
        <p className="mt-2 text-base font-bold text-[#5c4030]">
          料金目安 合計 {items.reduce((s, i) => s + i.budget_est, 0).toLocaleString()}円
          <span className="ml-2 text-sm font-normal text-[#8b7355]">
            （予算 {stored.meta.budget.toLocaleString()}円）
          </span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="glass overflow-hidden lg:sticky lg:top-4">
          <PlanMap
            startLat={stored.meta.start_lat}
            startLng={stored.meta.start_lng}
            items={items}
            totalTime={stored.plan.total_time}
            totalDistance={stored.plan.total_distance}
            totalPrice={items.reduce((s, i) => s + i.budget_est, 0)}
            compact={false}
          />
        </div>
        <div className="space-y-4">
          <PlanTimeline items={items} budget={stored.meta.budget} />
          <PlanMemo fallback={stored.meta.memo} />
        </div>
      </div>

      <DateChecklist gender={stored.meta.gender} />

      <PlanExport
        data={{
          date: stored.meta.date,
          address: stored.meta.address,
          routeStyle: stored.meta.route_style,
          totalTime: stored.plan.total_time,
          totalDistance: stored.plan.total_distance,
          budget: stored.meta.budget,
          totalPrice: items.reduce((s, i) => s + i.budget_est, 0),
          items,
          memo: stored.meta.memo || loadSavedNote(),
        }}
      />

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50/80 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {shareUrl && (
        <div role="status" className="glass p-4 text-sm text-[#5c4030]">
          保存しました。共有リンクをコピーしました:
          <a href={shareUrl} className="mt-1 block break-all underline">{shareUrl}</a>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving || items.length === 0}>
          {saving ? "保存中..." : "プランを保存して共有"}
        </button>
        <Link href="/" className="btn-secondary">条件を変える</Link>
      </div>
    </section>
  );
}
