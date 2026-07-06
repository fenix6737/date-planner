"use client";

import { useEffect, useState } from "react";
import { loadSavedNote } from "@/lib/storage";

export default function PlanMemo({ fallback }: { fallback?: string }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    const saved = loadSavedNote();
    setNote(saved || fallback || "");
  }, [fallback]);

  if (!note.trim()) {
    return null;
  }

  return (
    <div className="glass p-5">
      <h3 className="mb-2 text-base font-bold text-[#5c4030]">自分用メモ</h3>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2c2419]">{note}</p>
    </div>
  );
}
