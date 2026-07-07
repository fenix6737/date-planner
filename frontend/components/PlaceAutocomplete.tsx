"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { suggestPlaces, type SuggestItem } from "@/lib/api";
import { hasStrongLocalMatches, localSuggest, mergeRankedSuggestions } from "@/lib/localSuggest";
import { filterSuggestions } from "@/lib/placeFilters";

interface PlaceAutocompleteProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  nearLat?: number;
  nearLng?: number;
  /** 出発地など地域のみ。店名を候補から除外 */
  areasOnly?: boolean;
  /** 出発地点と同じ都道府県内に候補を絞る */
  filterPrefecture?: string;
  onChange: (value: string) => void;
  onSelect: (item: SuggestItem) => void;
}

export default function PlaceAutocomplete({
  id,
  label,
  value,
  placeholder,
  nearLat,
  nearLng,
  areasOnly = false,
  filterPrefecture,
  onChange,
  onSelect,
}: PlaceAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [searched, setSearched] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const filterOptions = { areasOnly, prefecture: filterPrefecture };

  const updateMenuRect = useCallback(() => {
    if (wrapperRef.current) {
      setMenuRect(wrapperRef.current.getBoundingClientRect());
    }
  }, []);

  const applyLocal = useCallback(
    (query: string) => {
      const limit = query ? 20 : 47;
      const local = localSuggest(query, limit, {
        nearLat,
        nearLng,
        areasOnly,
        prefecture: filterPrefecture,
      });
      setSuggestions(local);
      setOpen(true);
      setSearched(true);
      setFetchError(false);
      updateMenuRect();
      return local;
    },
    [nearLat, nearLng, areasOnly, filterPrefecture, updateMenuRect]
  );

  const fetchRemote = useCallback(
    async (query: string, local: SuggestItem[]) => {
      if (query && hasStrongLocalMatches(query)) {
        return;
      }

      const current = ++requestId.current;
      setLoadingRemote(true);
      try {
        const limit = query ? 20 : 47;
        const remote = await suggestPlaces(query, {
          nearLat,
          nearLng,
          limit,
          areasOnly,
          prefecture: filterPrefecture,
        });
        if (current !== requestId.current) return;
        const merged = mergeRankedSuggestions(query, local, remote, limit);
        setSuggestions(filterSuggestions(merged, filterOptions));
        setFetchError(false);
      } catch {
        if (current !== requestId.current) return;
        setFetchError(local.length === 0);
        setSuggestions(local);
      } finally {
        if (current === requestId.current) setLoadingRemote(false);
      }
    },
    [nearLat, nearLng, areasOnly, filterPrefecture]
  );

  useEffect(() => {
    const trimmed = value.trim();
    const local = applyLocal(trimmed);

    if (!trimmed) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchRemote(trimmed, local);
    }, 700);

    return () => clearTimeout(timer);
  }, [value, applyLocal, fetchRemote]);

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
    applyLocal(value.trim());
  };

  const handleInputChange = (nextValue: string) => {
    onChange(nextValue);
    applyLocal(nextValue.trim());
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
            {loadingRemote && suggestions.length === 0 && (
              <p className="px-5 py-4 text-sm text-[#8b7355]">候補を検索中...</p>
            )}
            {suggestions.length > 0 && (
              <>
                {!value.trim() && (
                  <p className="suggest-hint px-5 py-3 text-sm text-[#8b7355]">
                    都道府県から選べます（全47件）
                  </p>
                )}
                {filterPrefecture && value.trim() && (
                  <p className="suggest-hint px-5 py-2 text-xs text-[#8b7355]">
                    {filterPrefecture}内の候補を表示中
                  </p>
                )}
                {loadingRemote && value.trim() && (
                  <p className="suggest-hint px-5 py-2 text-xs text-[#8b7355]">
                    追加候補を検索中...
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
            {!loadingRemote && fetchError && suggestions.length === 0 && (
              <p className="px-5 py-4 text-sm leading-relaxed text-[#8b7355]">
                サーバーに接続できませんでした。市区町村名をもう一度入力してください。
              </p>
            )}
            {!loadingRemote && !fetchError && searched && suggestions.length === 0 && value.trim().length >= 1 && (
              <p className="px-5 py-4 text-sm leading-relaxed text-[#8b7355]">
                {filterPrefecture
                  ? `${filterPrefecture}内に候補が見つかりません。市区町村・駅名で入力してください`
                  : "候補が見つかりません。市区町村・駅名・店名で入力してください"}
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
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />
      {menu}
    </div>
  );
}
