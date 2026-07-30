import { useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";

export interface PlannerMapJob {
  id: string;
  date: string; // yyyy-mm-dd
  color: string; // hex
  category: string;
  customer: string;
  number?: string;
  fromAddress?: string;
  toAddress?: string;
  fromCoords?: { lat: number; lng: number };
  toCoords?: { lat: number; lng: number };
  stopCoords?: Array<{ lat: number; lng: number }>;
}

declare global {
  interface Window {
    google?: any;
    __plannerMapInit?: () => void;
    __plannerMapLoading?: Promise<void>;
  }
}

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps) return Promise.resolve();
  if (window.__plannerMapLoading) return window.__plannerMapLoading;
  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  if (!key) return Promise.reject(new Error("Google Maps key missing"));
  window.__plannerMapLoading = new Promise<void>((resolve, reject) => {
    window.__plannerMapInit = () => resolve();
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__plannerMapInit`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
  return window.__plannerMapLoading;
}

function pinIcon(google: any, color: string, label?: string, hollow = false) {
  // Teardrop SVG; fill=color for pickup, white fill w/ colored stroke for drop-off.
  const fill = hollow ? "#ffffff" : color;
  const stroke = color;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="46" viewBox="0 0 34 46">
    <path d="M17 1C8.7 1 2 7.7 2 16c0 11 15 29 15 29s15-18 15-29c0-8.3-6.7-15-15-15z"
      fill="${fill}" stroke="${stroke}" stroke-width="2"/>
    <circle cx="17" cy="16" r="6" fill="${hollow ? color : "#ffffff"}"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(34, 46),
    anchor: new google.maps.Point(17, 44),
    labelOrigin: new google.maps.Point(17, 58),
  };
}

export function PlannerMap({ jobs, onOpen }: { jobs: PlannerMapJob[]; onOpen?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const infoRef = useRef<any>(null);
  const withCoords = jobs.filter((j) => j.fromCoords);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !ref.current) return;
        const google = window.google;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(ref.current, {
            center: { lat: -34.37, lng: 21.42 }, // Stilbaai default
            zoom: 9,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          infoRef.current = new google.maps.InfoWindow();
        }
        // clear previous overlays
        overlaysRef.current.forEach((o) => o.setMap(null));
        overlaysRef.current = [];

        const bounds = new google.maps.LatLngBounds();

        withCoords.forEach((j) => {
          const dateLabel = format(parseISO(j.date), "EEE d");
          const pickup = new google.maps.Marker({
            position: j.fromCoords!,
            map: mapRef.current,
            icon: pinIcon(google, j.color),
            label: { text: dateLabel, fontSize: "11px", fontWeight: "600", color: "#111" },
            title: `${j.customer} — ${dateLabel}`,
          });
          bounds.extend(j.fromCoords!);
          overlaysRef.current.push(pickup);

          const openInfo = (marker: any, kind: "Pickup" | "Drop-off", addr?: string) => {
            const html = `
              <div style="font-family:system-ui,sans-serif;max-width:220px">
                <div style="font-weight:600;font-size:13px">${escapeHtml(j.customer)}</div>
                <div style="font-size:11px;color:#555">${j.number ? escapeHtml(j.number) + " · " : ""}${escapeHtml(dateLabel)} · ${j.category}</div>
                <div style="font-size:11px;margin-top:4px"><b>${kind}:</b> ${escapeHtml(addr || "")}</div>
                <button id="pm-open-${j.id}" style="margin-top:6px;font-size:11px;padding:4px 8px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer">Open job</button>
              </div>`;
            infoRef.current.setContent(html);
            infoRef.current.open({ map: mapRef.current, anchor: marker });
            setTimeout(() => {
              const btn = document.getElementById(`pm-open-${j.id}`);
              if (btn && onOpen) btn.onclick = () => onOpen(j.id);
            }, 0);
          };

          pickup.addListener("click", () => openInfo(pickup, "Pickup", j.fromAddress));

          if (j.toCoords) {
            const mids = (j.stopCoords ?? []).filter((c) => c && c.lat != null && c.lng != null);
            const drop = new google.maps.Marker({
              position: j.toCoords,
              map: mapRef.current,
              icon: pinIcon(google, j.color, undefined, true),
              title: `${j.customer} — drop-off`,
            });
            drop.addListener("click", () => openInfo(drop, "Drop-off", j.toAddress));
            overlaysRef.current.push(drop);
            bounds.extend(j.toCoords);

            mids.forEach((c, idx) => {
              const stopMarker = new google.maps.Marker({
                position: c,
                map: mapRef.current,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 6,
                  fillColor: j.color,
                  fillOpacity: 1,
                  strokeColor: "#fff",
                  strokeWeight: 2,
                },
                title: `${j.customer} — stop ${idx + 1}`,
              });
              overlaysRef.current.push(stopMarker);
              bounds.extend(c);
            });

            const line = new google.maps.Polyline({
              path: [j.fromCoords!, ...mids, j.toCoords],
              map: mapRef.current,
              strokeColor: j.color,
              strokeOpacity: 0.85,
              strokeWeight: 3,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: j.color },
                offset: "60%",
              }],
            });
            overlaysRef.current.push(line);
          }
        });

        if (withCoords.length > 0) {
          mapRef.current.fitBounds(bounds, 48);
          if (withCoords.length === 1) {
            const listener = google.maps.event.addListenerOnce(mapRef.current, "idle", () => {
              if (mapRef.current.getZoom() > 13) mapRef.current.setZoom(13);
            });
            overlaysRef.current.push({ setMap: () => google.maps.event.removeListener(listener) });
          }
        }
      })
      .catch((e) => console.error("[PlannerMap]", e));
    return () => { cancelled = true; };
  }, [JSON.stringify(withCoords.map((j) => [j.id, j.date, j.color, j.fromCoords, j.toCoords, j.stopCoords]))]);

  return (
    <div className="rounded-lg border overflow-hidden bg-muted">
      <div ref={ref} className="w-full h-[280px] sm:h-[380px]" />
      <div className="px-3 py-2 text-[11px] text-muted-foreground border-t bg-background">
        {withCoords.length} of {jobs.length} job{jobs.length === 1 ? "" : "s"} shown on map
        {jobs.length - withCoords.length > 0 && ` — ${jobs.length - withCoords.length} missing pickup coordinates`}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}