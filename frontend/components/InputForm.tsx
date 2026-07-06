"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { geocode, generatePlan, reverseGeocode, type SuggestItem } from "@/lib/api";
import { loadSavedNote } from "@/lib/storage";
import PlaceAutocomplete from "./PlaceAutocomplete";

const DepartureMap = dynamic(() => import("./DepartureMap"), { ssr: false });

const ROUTE_STYLES = [
  { id: "relaxed", label: "のんびり", desc: "カフェや公園をゆっくり回る" },
  { id: "active", label: "アスレチック", desc: "歩いたり体を動かす場所中心" },
  { id: "stylish", label: "おしゃれ", desc: "カフェやレストランを楽しむ" },
];

export default function InputForm() {
  const router = useRouter();
  const [departure, setDeparture] = useState("");
  const [departureCoords, setDepartureCoords] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [destinations, setDestinations] = useState(["", "", ""]);
  const [destCoords, setDestCoords] = useState<(SuggestItem | null)[]>([null, null, null]);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [timeStart, setTimeStart] = useState("10:00");
  const [timeEnd, setTimeEnd] = useState("18:00");
  const [budget, setBudget] = useState(5000);
  const [routeStyle, setRouteStyle] = useState("relaxed");
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const departurePickRef = useRef(false);
  const geocodeRequestRef = useRef(0);

  const gender = typeof window !== "undefined" ? localStorage.getItem("userGender") || "other" : "other";
  const nearLat = departureCoords?.lat;
  const nearLng = departureCoords?.lng;

  const updateDestination = (index: number, value: string) => {
    setDestinations((prev) => prev.map((d, i) => (i === index ? value : d)));
    if (!value.trim()) {
      setDestCoords((prev) => prev.map((c, i) => (i === index ? null : c)));
    }
  };

  const handleDepartureChange = (value: string) => {
    departurePickRef.current = false;
    setDeparture(value);
    if (!value.trim()) {
      setDepartureCoords(null);
    }
  };

  const handleDepartureSelect = (item: SuggestItem) => {
    departurePickRef.current = true;
    setDepartureCoords({ lat: item.lat, lng: item.lng, address: item.address });
  };

  const handleDestSelect = (index: number, item: SuggestItem) => {
    setDestCoords((prev) => prev.map((c, i) => (i === index ? item : c)));
  };

  useEffect(() => {
    const trimmed = departure.trim();
    if (!trimmed || departurePickRef.current) return;

    const timer = setTimeout(async () => {
      const requestId = ++geocodeRequestRef.current;
      setMapLoading(true);
      try {
        const loc = await geocode(trimmed, nearLat, nearLng);
        if (requestId === geocodeRequestRef.current && !departurePickRef.current) {
          setDepartureCoords(loc);
        }
      } catch {
        // keep previous marker or japan overview
      } finally {
        if (requestId === geocodeRequestRef.current) setMapLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [departure, nearLat, nearLng]);

  const handleMapPick = async (lat: number, lng: number) => {
    setMapLoading(true);
    setError(null);
    departurePickRef.current = true;
    try {
      const result = await reverseGeocode(lat, lng);
      setDepartureCoords(result);
      setDeparture(result.address.split(",")[0] || result.address);
    } catch {
      setDepartureCoords({ lat, lng, address: "選択した地点付近" });
    } finally {
      setMapLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const filledIndices = destinations.map((d, i) => (d.trim() ? i : -1)).filter((i) => i >= 0);
    if (filledIndices.length === 0) {
      setError("行きたい場所を1つ以上入力してください");
      return;
    }
    if (!departure.trim() && !departureCoords) {
      setError("出発地を入力するか、地図から選んでください");
      return;
    }

    setLoading(true);
    try {
      const start = departureCoords || (await geocode(departure, nearLat, nearLng));
      const geocodedDests = await Promise.all(
        filledIndices.map(async (i) => {
          const cached = destCoords[i];
          if (cached) {
            return { name: cached.name, lat: cached.lat, lng: cached.lng };
          }
          const name = destinations[i];
          const loc = await geocode(name, nearLat, nearLng);
          return { name: loc.address.split(",")[0] || name, lat: loc.lat, lng: loc.lng };
        })
      );

      const savedNote = loadSavedNote();

      const plan = await generatePlan({
        start: { lat: start.lat, lng: start.lng },
        date,
        budget,
        time_start: timeStart,
        time_end: timeEnd,
        route_style: routeStyle,
        destinations: geocodedDests,
        gender: gender === "other" ? undefined : gender,
        prefs: {},
      });

      sessionStorage.setItem(
        "generatedPlan",
        JSON.stringify({
          plan,
          meta: {
            date,
            budget,
            gender,
            route_style: routeStyle,
            time_start: timeStart,
            time_end: timeEnd,
            start_lat: start.lat,
            start_lng: start.lng,
            address: start.address,
            destinations: geocodedDests,
            memo: savedNote,
          },
        })
      );
      router.push("/plans/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "プランを作れませんでした");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="glass overflow-visible p-5">
        <PlaceAutocomplete
          id="departure"
          label="出発地"
          value={departure}
          placeholder="例: 東京都、渋谷区、横浜市、大阪駅"
          nearLat={nearLat}
          nearLng={nearLng}
          onChange={handleDepartureChange}
          onSelect={handleDepartureSelect}
        />
        {mapLoading && <p className="mt-2 text-xs text-[#8b7355]">地図を更新中...</p>}
        <div className="mt-3">
          <DepartureMap
            lat={departureCoords?.lat ?? 0}
            lng={departureCoords?.lng ?? 0}
            label={departureCoords?.address}
            onLocationPick={handleMapPick}
          />
        </div>
      </div>

      <div className="glass overflow-visible p-5">
        <p className="mb-3 text-sm font-bold text-[#5c4030]">行きたい場所（1つ以上）</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="mb-3 last:mb-0">
            <PlaceAutocomplete
              id={`dest-${i}`}
              label={`場所 ${i + 1}`}
              value={destinations[i]}
              placeholder={i === 0 ? "例: 渋谷区、道頓堀、もうもう亭" : "空欄でもOK"}
              nearLat={nearLat}
              nearLng={nearLng}
              onChange={(v) => updateDestination(i, v)}
              onSelect={(item) => handleDestSelect(i, item)}
            />
          </div>
        ))}
      </div>

      <div className="glass p-5">
        <p className="mb-3 text-sm font-bold text-[#5c4030]">何時から何時まで</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="time-start" className="mb-1 block text-xs text-[#8b7355]">開始</label>
            <input
              id="time-start"
              type="time"
              className="input-field"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="time-end" className="mb-1 block text-xs text-[#8b7355]">終了</label>
            <input
              id="time-end"
              type="time"
              className="input-field"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      <div className="glass p-5">
        <label htmlFor="date" className="mb-2 block text-sm font-bold text-[#5c4030]">日付</label>
        <input
          id="date"
          type="date"
          className="input-field"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      <div className="glass p-5">
        <label htmlFor="budget" className="mb-2 block text-sm font-bold text-[#5c4030]">
          予算（円）
        </label>
        <input
          id="budget"
          type="number"
          className="input-field"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          min={1000}
          step={500}
          required
        />
      </div>

      <div className="glass p-5">
        <p className="mb-3 text-sm font-bold text-[#5c4030]">どんなデートにする？</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ROUTE_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => setRouteStyle(style.id)}
              className={routeStyle === style.id ? "style-btn-active" : "style-btn"}
            >
              <span className="block font-bold">{style.label}</span>
              <span className={`mt-1 block text-xs ${routeStyle === style.id ? "text-white/80" : "text-[#8b7355]"}`}>
                {style.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50/80 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "プランを作成中..." : "プランを作る"}
      </button>
    </form>
  );
}
