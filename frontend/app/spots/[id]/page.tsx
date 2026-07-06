"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSpotInfo, type SpotResult } from "@/lib/api";
import { getCachedSpot } from "@/lib/spotCache";
import StarRating from "@/components/StarRating";

export default function SpotDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { source?: string };
}) {
  const [spot, setSpot] = useState<SpotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const spotId = decodeURIComponent(params.id);
  const source = searchParams.source;

  useEffect(() => {
    setImageError(false);
    const cached = getCachedSpot(spotId, source);
    if (cached) {
      setSpot(cached);
      return;
    }

    if (source === "user") {
      setError("この場所は地図上で選んだ地点です。詳細情報はありません。");
      return;
    }

    getSpotInfo(spotId, source)
      .then(setSpot)
      .catch((err) => setError(err instanceof Error ? err.message : "店舗が見つかりません"));
  }, [spotId, source]);

  if (error) {
    return (
      <section className="mx-auto max-w-lg space-y-4">
        <Link href="/plans/new" className="text-sm text-[#8b5e3c] underline underline-offset-2">
          プランに戻る
        </Link>
        <div className="glass p-6">
          <p role="alert" className="text-[#5c4030]">{error}</p>
        </div>
      </section>
    );
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
        {spot.image_url && !imageError && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={spot.image_url}
            alt={spot.name}
            className="mb-4 h-48 w-full rounded-xl object-cover"
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
          />
        )}
        <h2 className="text-xl font-bold text-[#5c4030]">{spot.name}</h2>

        <div className="mt-4 rounded-xl border border-[#8b5e3c]/20 bg-white/60 px-4 py-3">
          <p className="text-xs font-medium text-[#8b7355]">料金目安</p>
          <p className="text-xl font-bold text-[#5c4030]">
            {spot.price > 0 ? `約 ${spot.price.toLocaleString()}円` : "無料"}
          </p>
        </div>

        <div className="mt-3">
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
