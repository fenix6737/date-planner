"use client";

import { useState } from "react";

const GENDERS = [
  { id: "M", label: "男性" },
  { id: "F", label: "女性" },
  { id: "other", label: "その他" },
];

export default function GenderSetup({ onComplete }: { onComplete: () => void }) {
  const [gender, setGender] = useState("");

  const handleStart = () => {
    if (!gender) return;
    localStorage.setItem("userGender", gender);
    onComplete();
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="glass p-8 text-center">
        <h2 className="text-xl font-bold text-[#5c4030]">はじめに</h2>
        <p className="mt-2 text-sm text-[#7a6555]">
          あなたの性別を選んでください。準備リストの内容が変わります。
        </p>
        <p className="mt-1 text-xs text-[#8b7355]">メール登録は不要です</p>

        <div className="mt-6 flex flex-col gap-3">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGender(g.id)}
              className={`chip w-full ${gender === g.id ? "chip-active" : ""}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary mt-6 w-full"
          disabled={!gender}
          onClick={handleStart}
        >
          はじめる
        </button>
      </div>
    </div>
  );
}
