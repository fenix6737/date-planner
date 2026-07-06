"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/mapConfig";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const MapClickHandler = dynamic(() => import("./MapClickHandler"), { ssr: false });
const MapViewUpdater = dynamic(() => import("./MapViewUpdater"), { ssr: false });

interface DepartureMapProps {
  lat: number;
  lng: number;
  label?: string;
  onLocationPick?: (lat: number, lng: number) => void;
}

const JAPAN_CENTER: [number, number] = [36.2, 138.25];

function markerZoom(label?: string): number {
  if (!label) return 14;
  if (label.includes("区") || label.includes("市")) return 13;
  return 15;
}

export default function DepartureMap({ lat, lng, label, onLocationPick }: DepartureMapProps) {
  const [ready, setReady] = useState(false);
  const hasMarker = lat !== 0 || lng !== 0;

  useEffect(() => {
    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      setReady(true);
    });
  }, []);

  if (!ready) {
    return <div className="h-80 animate-pulse rounded-xl bg-[#d4c4b0]/40" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#8b5e3c]/20 shadow-sm">
      <p className="bg-[#5c4030] px-4 py-2 text-sm text-white">
        {label || (hasMarker ? "出発地の位置" : "日本地図 — タップして出発地を選べます")}
      </p>
      <div className="h-80">
        <MapContainer
          center={hasMarker ? [lat, lng] : JAPAN_CENTER}
          zoom={hasMarker ? markerZoom(label) : 5}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
          {hasMarker && (
            <>
              <Marker position={[lat, lng]} />
              <MapViewUpdater lat={lat} lng={lng} zoom={markerZoom(label)} />
            </>
          )}
          {onLocationPick && <MapClickHandler onPick={onLocationPick} />}
        </MapContainer>
      </div>
    </div>
  );
}
