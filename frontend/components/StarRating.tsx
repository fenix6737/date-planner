"use client";

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
}

export default function StarRating({ rating, reviewCount }: StarRatingProps) {
  const full = Math.round(rating);
  const stars = Array.from({ length: 5 }, (_, i) => i < full);

  return (
    <div className="flex items-center gap-2 text-sm text-[#5c4030]">
      <span className="flex gap-0.5" aria-label={`評価 ${rating.toFixed(1)}`}>
        {stars.map((filled, i) => (
          <span
            key={i}
            className={filled ? "text-[#c4952a]" : "text-[#d4c4b0]"}
            aria-hidden
          >
            &#9733;
          </span>
        ))}
      </span>
      <span>{rating > 0 ? rating.toFixed(1) : "—"}</span>
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="text-[#8b7355]">({reviewCount}件)</span>
      )}
    </div>
  );
}
