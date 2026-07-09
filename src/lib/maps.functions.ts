import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const gm = process.env.GOOGLE_MAPS_API_KEY;
  if (!lov || !gm) throw new Error("Google Maps connector not configured");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gm,
    "Content-Type": "application/json",
  } as Record<string, string>;
}

export const placesAutocomplete = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ input: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/places/v1/places:autocomplete`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        input: data.input,
        regionCode: "ZA",
      }),
    });
    if (!res.ok) throw new Error(`Places autocomplete failed [${res.status}]: ${await res.text()}`);
    const j = (await res.json()) as {
      suggestions?: Array<{ placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }>;
    };
    return (j.suggestions ?? [])
      .filter((s) => s.placePrediction)
      .map((s) => ({
        placeId: s.placePrediction!.placeId,
        text: s.placePrediction!.text?.text ?? "",
        main: s.placePrediction!.structuredFormat?.mainText?.text ?? "",
        secondary: s.placePrediction!.structuredFormat?.secondaryText?.text ?? "",
      }));
  });

export const placeDetails = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ placeId: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(`${GATEWAY}/places/v1/places/${encodeURIComponent(data.placeId)}`, {
      method: "GET",
      headers: {
        ...headers(),
        "X-Goog-FieldMask": "id,formattedAddress,location,displayName",
      },
    });
    if (!res.ok) throw new Error(`Place details failed [${res.status}]: ${await res.text()}`);
    const j = (await res.json()) as {
      formattedAddress?: string;
      location?: { latitude: number; longitude: number };
      displayName?: { text: string };
    };
    return {
      address: j.formattedAddress ?? "",
      lat: j.location?.latitude ?? null,
      lng: j.location?.longitude ?? null,
      name: j.displayName?.text ?? "",
    };
  });

const point = z.object({
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const routeDistance = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ from: point, to: point }).parse(d))
  .handler(async ({ data }) => {
    const waypoint = (p: { address?: string; lat?: number; lng?: number }) =>
      p.lat != null && p.lng != null
        ? { location: { latLng: { latitude: p.lat, longitude: p.lng } } }
        : { address: p.address ?? "" };

    const res = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      headers: {
        ...headers(),
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
      body: JSON.stringify({
        origin: waypoint(data.from),
        destination: waypoint(data.to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      }),
    });
    if (!res.ok) throw new Error(`Route failed [${res.status}]: ${await res.text()}`);
    const j = (await res.json()) as { routes?: Array<{ distanceMeters?: number; duration?: string }> };
    const r = j.routes?.[0];
    return {
      meters: r?.distanceMeters ?? 0,
      km: r?.distanceMeters ? Math.round(r.distanceMeters / 100) / 10 : 0,
      duration: r?.duration ?? "",
    };
  });
