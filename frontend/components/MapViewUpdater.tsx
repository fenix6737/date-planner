"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

interface MapViewUpdaterProps {
  lat: number;
  lng: number;
  zoom?: number;
}

export default function MapViewUpdater({ lat, lng, zoom = 14 }: MapViewUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    if (!lat && !lng) return;
    map.flyTo([lat, lng], zoom, { duration: 0.6 });
  }, [map, lat, lng, zoom]);

  return null;
}
