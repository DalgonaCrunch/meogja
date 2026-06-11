export function normalizePlaceName(name: string): string {
  return name.replace(/\s/g, "").replace(/(본점|지점|분점|직영점|[가-힣]{1,4}점)$/, "").toLowerCase();
}

export function trackPlaceClick(placeName: string) {
  if (!placeName) return;
  fetch("/api/place-clicks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_name: placeName }),
  }).catch(() => {});
}

export async function fetchPlaceClickStats(names: string[]): Promise<Record<string, number>> {
  if (!names.length) return {};
  try {
    const normalized = names.map(normalizePlaceName).join(",");
    const res = await fetch(`/api/place-clicks?names=${encodeURIComponent(normalized)}`);
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export function getClickCount(placeName: string, stats: Record<string, number>): number {
  return stats[normalizePlaceName(placeName)] || 0;
}
