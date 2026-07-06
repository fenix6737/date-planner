"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { suggestPlaces, type SuggestItem } from "@/lib/api";
import { localSuggest, rankSuggestions } from "@/lib/localSuggest";

interface PlaceAutocompleteProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  nearLat?: number;
  nearLng?: number;
  onChange: (value: string) => void;
  onSelect: (item: SuggestItem) => void;
}

function mergeSuggestions(
  query: string,
  local: SuggestItem[],
  remote: SuggestItem[],
  limit: number,
  nearLat?: number,
  nearLng?: number
): SuggestItem[] {
  const combined: SuggestItem[] = [];
  const seen = new Set<string>();
  for (const item of [...local, ...remote]) {
    const key = `${item.name}:${item.lat}:${item.lng}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(item);
  }
  return rankSuggestions(query, combined, limit, nearLat, nearLng);
}

export default function PlaceAutocomplete({
  id,
  label,
  value,
  placeholder,
  nearLat,
  nearLng,
  onChange,
  onSelect,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const updateMenuRect = useCallback(() => {
    if (wrapperRef.current) {
      setMenuRect(wrapperRef.current.getBoundingClientRect());
    }
  }, []);

  const fetchSuggestions = useCallback(
    async (query: string) => {
      const current = ++requestId.current;
      const limit = query ? 20 : 47;
      const local = localSuggest(query, limit, nearLat, nearLng);

      setLoading(true);
      setFetchError(false);
      setSuggestions(local);
      setOpen(true);
      setSearched(true);
      updateMenuRect();

      try {
        const remote = await suggestPlaces(query, nearLat, nearLng, limit);
        if (current !== requestId.current) return;
        setSuggestions(mergeSuggestions(query, local, remote, limit, nearLat, nearLng));
      } catch {
        if (current !== requestId.current) return;
        setFetchError(local.length === 0);
        setSuggestions(local);
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    },
    [nearLat, nearLng, updateMenuRect]
  );

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setSearched(false);
      setFetchError(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuggestions(trimmed);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    if (!open) return;
    updateMenuRect();
    const handleLayout = () => updateMenuRect();
    window.addEventListener("resize", handleLayout);
    window.addEventListener("scroll", handleLayout, true);
    return () => {
      window.removeEventListener("resize", handleLayout);
      window.removeEventListener("scroll", handleLayout, true);
    };
  }, [open, suggestions, updateMenuRect]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest("[data-suggest-menu]")) {
          setOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pick = (item: SuggestItem) => {
    onChange(item.name);
    onSelect(item);
    setOpen(false);
    setSuggestions([]);
    setSearched(false);
    setFetchError(false);
  };

  const handleFocus = () => {
    updateMenuRect();
    if (value.trim().length < 1) {
      fetchSuggestions("");
      return;
    }
    if (suggestions.length > 0 || searched) setOpen(true);
  };

  const menu =
    open && menuRect && typeof document !== "undefined"
      ? createPortal(
          <div
            data-suggest-menu
            className="suggest-list fixed overflow-y-auto"
            style={{
              top: menuRect.bottom + 8,
              left: menuRect.left,
              width: menuRect.width,
              maxHeight: "min(24rem, 55vh)",
              zIndex: 9999,
            }}
            role="listbox"
          >
            {loading && suggestions.length === 0 && (
              <p className="px-5 py-4 text-sm text-[#8b7355]">候補を検索中...</p>
            )}
            {!loading && suggestions.length > 0 && (
              <>
                {!value.trim() && (
                  <p className="suggest-hint px-5 py-3 text-sm text-[#8b7355]">
                    都道府県から選べます（全47件）
                  </p>
                )}
                <ul>
                  {suggestions.map((item, i) => (
                    <li key={`${item.name}-${item.lat}-${i}`} role="option">
                      <button
                        type="button"
                        className="suggest-item"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(item)}
                      >
                        <span className="block text-base font-semibold leading-snug text-[#5c4030]">
                          {item.name}
                        </span>
                        <span className="mt-1 block whitespace-normal break-words text-sm leading-relaxed text-[#8b7355]">
                          {item.address}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!loading && fetchError && (
              <p className="px-5 py-4 text-sm leading-relaxed text-[#8b7355]">
                サーバーに接続できませんでした。表示中の候補から選ぶか、しばらくして再試行してください。
              </p>
            )}
            {!loading && !fetchError && searched && suggestions.length === 0 && value.trim().length >= 1 && (
              <p className="px-5 py-4 text-sm leading-relaxed text-[#8b7355]">
                候補が見つかりません。市区町村・駅名・店名で入力してください
              </p>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={wrapperRef} className="relative z-20">
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-[#5c4030]">
        {label}
      </label>
      <input
        id={id}
        type="text"
        className="input-field text-lg"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          updateMenuRect();
        }}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />
      {menu}
    </div>
  );
}
