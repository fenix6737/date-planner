"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSpotInfo, type SpotResult } from "@/lib/api";
import StarRating from "@/components/StarRating";

export default function SpotDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { source?: string; name?: string; lat?: string; lng?: string };
}) {
  const [spot, setSpot] = useState<SpotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const spotId = decodeURIComponent(params.id);
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined;
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined;
  const fallbackName = searchParams.name ? decodeURIComponent(searchParams.name) : undefined;

  useEffect(() => {
    setImageError(false);
    getSpotInfo(spotId, searchParams.source, fallbackName, lat, lng)
      .then(setSpot)
      .catch((err) => setError(err instanceof Error ? err.message : "読み込みできませんでした"));
  }, [spotId, searchParams.source, fallbackName, lat, lng]);

  if (error) {
    return <p role="alert" className="text-red-700">{error}</p>;
  }

  if (!spot) {
    return <p className="text-[#7a6555]">読み込み中...</p>;
  }

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <Link href="/plans/new" className="text-sm text-[#8b5e3c] underline underline-offset-2">
        プランに戻る
      </Link>

      <div className="glass p-6">
        {spot.image_url && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.image_url}
            alt={spot.name}
            className="mb-4 h-48 w-full rounded-xl object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="mb-4 flex h-48 w-full items-center justify-center rounded-xl bg-[#f5ebe0] text-sm text-[#8b7355]">
            写真はありません
          </div>
        )}
        <h2 className="text-xl font-bold text-[#5c4030]">{spot.name}</h2>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-[#8b5e3c]/10 px-3 py-1 text-sm font-semibold text-[#8b5e3c]">
            料金目安: {spot.price > 0 ? `約 ${spot.price.toLocaleString()}円` : "無料"}
          </span>
          <StarRating rating={spot.rating} reviewCount={spot.review_count} />
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          {spot.address && (
            <div>
              <dt className="font-medium text-[#8b7355]">住所</dt>
              <dd className="mt-0.5 text-[#2c2419]">{spot.address}</dd>
            </div>
          )}
          {spot.hours && (
            <div>
              <dt className="font-medium text-[#8b7355]">営業時間</dt>
              <dd className="mt-0.5 text-[#2c2419]">{spot.hours}</dd>
            </div>
          )}
        </dl>

        {spot.url && (
          <a
            href={spot.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-6 inline-block"
          >
            お店のページを開く
          </a>
        )}
      </div>
    </section>
  );
}
