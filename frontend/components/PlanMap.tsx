"use client";

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PlanSpotItem } from "@/lib/api";
import { MAP_ATTRIBUTION, MAP_TILE_URL } from "@/lib/mapConfig";

const MapFitBounds = dynamic(() => import("./MapFitBounds"), { ssr: false });

interface PlanMapProps {
  startLat: number;
  startLng: number;
  items: PlanSpotItem[];
  totalTime?: string;
  totalDistance?: string;
  totalPrice?: number;
  compact?: boolean;
}

const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function PlanMap({
  startLat,
  startLng,
  items,
  totalTime,
  totalDistance,
  totalPrice,
  compact = false,
}: PlanMapProps) {
  useEffect(() => {
    delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const positions = useMemo(
    () => [[startLat, startLng] as [number, number], ...items.map((i) => [i.lat, i.lng] as [number, number])],
    [startLat, startLng, items]
  );

  const center = positions[0] || [36.2, 138.25];

  return (
    <div className="overflow-hidden rounded-xl border border-[#8b5e3c]/20">
      <div className="grid grid-cols-3 gap-2 border-b border-white/50 bg-[#f5ebe0] p-3 text-center text-sm">
        <div>
          <p className="font-medium text-[#8b7355]">時間</p>
          <p className="text-[#5c4030]">{totalTime || "—"}</p>
        </div>
        <div>
          <p className="font-medium text-[#8b7355]">距離</p>
          <p className="text-[#5c4030]">{totalDistance || "—"}</p>
        </div>
        <div>
          <p className="font-medium text-[#8b7355]">料金目安</p>
          <p className="font-semibold text-[#5c4030]">{(totalPrice || 0).toLocaleString()}円</p>
        </div>
      </div>
      <div className={compact ? "h-[480px]" : "h-[400px]"}>
        <MapContainer center={center} zoom={14} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution={MAP_ATTRIBUTION} url={MAP_TILE_URL} />
          <MapFitBounds positions={positions} />
          <Polyline positions={positions} color="#8b5e3c" weight={4} opacity={0.85} />
          <Marker position={[startLat, startLng]} icon={defaultIcon}>
            <Popup>出発地</Popup>
          </Marker>
          {items.map((item, idx) => (
            <Marker key={`${item.name}-${idx}`} position={[item.lat, item.lng]} icon={defaultIcon}>
              <Popup>
                <strong>{item.name}</strong>
                <br />
                {item.time}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
