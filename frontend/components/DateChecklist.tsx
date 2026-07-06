"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSavedNote, saveNoteToStorage } from "@/lib/storage";

const CHECKLIST_BASE = [
  "充電器とモバイルバッテリーを持つ",
  "現金と交通系ICカードを確認する",
  "当日の天気を確認する",
  "行きたい場所の営業時間を確認する",
];

const CHECKLIST_BY_GENDER: Record<string, string[]> = {
  M: ["汗拭きシートやハンカチを持つ", "服装のシワを確認する"],
  F: ["リップや整髪スプレーを持つ", "歩きやすい靴か確認する"],
  other: ["身だしなみを最終チェックする", "歩きやすい靴か確認する"],
};

const CHECKED_KEY = "dateChecklistChecked";

interface DateChecklistProps {
  gender: string;
}

export default function DateChecklist({ gender }: DateChecklistProps) {
  const [items, setItems] = useState<{ text: string; done: boolean }[]>([]);
  const [note, setNote] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    const genderItems = CHECKLIST_BY_GENDER[gender] || CHECKLIST_BY_GENDER.other;
    const allItems = [...CHECKLIST_BASE, ...genderItems];

    let checked: Record<string, boolean> = {};
    try {
      const raw = localStorage.getItem(CHECKED_KEY);
      if (raw) checked = JSON.parse(raw);
    } catch {
      checked = {};
    }

    setItems(allItems.map((text) => ({ text, done: checked[text] || false })));
    setNote(loadSavedNote());
  }, [gender]);

  const persistNote = useCallback((value: string) => {
    saveNoteToStorage(value);
    setSaveStatus("メモを保存しました");
    setTimeout(() => setSaveStatus(null), 2500);
  }, []);

  const toggle = (index: number) => {
    setItems((prev) => {
      const next = prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
      const checked: Record<string, boolean> = {};
      next.forEach((item) => {
        checked[item.text] = item.done;
      });
      localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
      return next;
    });
  };

  return (
    <div className="glass p-5">
      <h3 className="mb-3 text-base font-bold text-[#5c4030]">デート前の準備リスト</h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={item.text}>
            <label className="flex min-h-touch cursor-pointer items-center gap-3 rounded-lg px-2 py-1 hover:bg-white/40">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggle(i)}
                className="h-5 w-5 rounded accent-[#8b5e3c]"
              />
              <span className={item.done ? "text-[#8b7355] line-through" : ""}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <label htmlFor="checklist-note" className="mb-2 block text-sm font-medium text-[#5c4030]">
          自分用メモ
        </label>
        <textarea
          id="checklist-note"
          className="input-field min-h-[80px] resize-none"
          placeholder="忘れないように書いておく"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="btn-secondary px-4 py-2 text-sm"
            onClick={() => persistNote(note)}
          >
            メモを保存
          </button>
          {saveStatus && (
            <span role="status" className="text-sm text-[#5c4030]">
              {saveStatus}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
