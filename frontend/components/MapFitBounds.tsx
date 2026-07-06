"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function MapFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length < 2) return;
    const lats = positions.map((p) => p[0]);
    const lngs = positions.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [40, 40] }
    );
  }, [map, positions]);

  return null;
}
