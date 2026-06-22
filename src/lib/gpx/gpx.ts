export function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export type GpxWaypoint = {
  name: string;
  latitude: number;
  longitude: number;
  note?: string;
};

export type GpxRouteLeg = {
  from: GpxWaypoint;
  to: GpxWaypoint;
};

export function buildPassageRouteGpx(name: string, waypoints: GpxWaypoint[], legs: GpxRouteLeg[]): string {
  const wptXml = waypoints
    .map(
      (wp) =>
        `<wpt lat="${wp.latitude.toFixed(6)}" lon="${wp.longitude.toFixed(6)}"><name>${escapeXml(wp.name)}</name>${wp.note ? `<desc>${escapeXml(wp.note)}</desc>` : ''}</wpt>`,
    )
    .join('');
  const rtepts = waypoints
    .map((wp) => `<rtept lat="${wp.latitude.toFixed(6)}" lon="${wp.longitude.toFixed(6)}"><name>${escapeXml(wp.name)}</name></rtept>`)
    .join('');
  const trksegs = legs
    .map(
      (leg) =>
        `<trkseg><trkpt lat="${leg.from.latitude.toFixed(6)}" lon="${leg.from.longitude.toFixed(6)}"></trkpt><trkpt lat="${leg.to.latitude.toFixed(6)}" lon="${leg.to.longitude.toFixed(6)}"></trkpt></trkseg>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="SeaCheck" xmlns="http://www.topografix.com/GPX/1/1">${wptXml}<rte><name>${escapeXml(name)}</name>${rtepts}</rte><trk><name>${escapeXml(name)}</name>${trksegs}</trk></gpx>`;
}

export function buildPassageSummaryText(
  name: string,
  legs: { fromName: string; toName: string; bearingDeg: number; distanceNm: number; cumulativeNm: number; sogKn: number; durationHours: number; etaUtc: string | null; note: string }[],
  totalNm: number,
  totalHours: number,
): string {
  const lines = [`${name}`, ''];
  for (const leg of legs) {
    const eta = leg.etaUtc ? leg.etaUtc.slice(11, 16) + ' UTC' : '—';
    lines.push(
      `${leg.fromName} → ${leg.toName}: ${Math.round(leg.bearingDeg)}° · ${leg.distanceNm.toFixed(1)} NM · SOG ${leg.sogKn.toFixed(1)} kn · ${leg.durationHours.toFixed(1)} h · ETA ${eta}${leg.note ? ` · ${leg.note}` : ''}`,
    );
  }
  lines.push('', `Total: ${totalNm.toFixed(1)} NM · ${totalHours.toFixed(1)} h at planned SOG`);
  return lines.join('\n');
}
