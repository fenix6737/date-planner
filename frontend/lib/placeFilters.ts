import type { SuggestItem } from "./api";

const PREFECTURE_RE = /^(.+?[都道府県])/;

export function extractPrefecture(text: string): string | undefined {
  const match = text.match(PREFECTURE_RE);
  return match?.[1];
}

const AREA_NAME_RE = /(?:都|道|府|県|市|区|町|村|駅|公園|城|寺|社|堀|橋)$/;

export function isAreaPlace(
  place: Pick<SuggestItem, "name" | "address">
): boolean {
  if (place.name === place.address) return true;
  return AREA_NAME_RE.test(place.name);
}

export function placeInPrefecture(
  place: Pick<SuggestItem, "name" | "address">,
  prefecture?: string
): boolean {
  if (!prefecture) return true;
  return place.address.startsWith(prefecture) || place.name === prefecture;
}

export function filterSuggestions(
  items: SuggestItem[],
  options: {
    areasOnly?: boolean;
    prefecture?: string;
  }
): SuggestItem[] {
  return items.filter((item) => {
    if (options.areasOnly && !isAreaPlace(item)) return false;
    if (!placeInPrefecture(item, options.prefecture)) return false;
    return true;
  });
}
