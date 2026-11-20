/**
 * Géographie simplifiée (sans dépendance ni fichier externe) pour le globe et les cartes.
 * Contours de continents volontairement grossiers : rendu « en points », pas une carte précise.
 */
export const LAND: [number, number][][] = [
  [[-17,21],[-16,28],[-6,36],[10,37],[20,32],[32,31],[35,28],[43,12],[51,12],[42,-1],[40,-11],[35,-24],[20,-35],[18,-30],[12,-17],[9,-1],[9,4],[-8,4],[-17,14]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[2,51],[5,53],[8,57],[5,62],[15,69],[28,71],[40,67],[45,60],[40,45],[30,41],[26,37],[20,40],[12,37],[8,44],[3,42],[-5,36]],
  [[40,45],[45,60],[60,70],[80,73],[110,77],[140,72],[170,70],[180,65],[160,58],[140,52],[135,43],[121,31],[110,20],[106,10],[100,1],[98,8],[92,20],[80,8],[73,17],[66,25],[57,25],[50,30],[44,13],[35,30],[36,36]],
  [[-165,65],[-160,71],[-130,70],[-95,72],[-80,73],[-62,60],[-55,50],[-66,44],[-75,35],[-81,25],[-97,26],[-97,19],[-88,15],[-83,9],[-79,9],[-87,13],[-105,20],[-117,32],[-124,40],[-125,49],[-135,58],[-150,60]],
  [[-55,60],[-45,60],[-20,70],[-20,80],[-60,82],[-70,77]],
  [[-79,9],[-60,11],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-55],[-72,-50],[-73,-37],[-71,-18],[-81,-5],[-78,2]],
  [[114,-22],[122,-18],[131,-12],[137,-12],[142,-11],[146,-19],[153,-28],[150,-37],[140,-38],[132,-32],[115,-34]],
  [[-5,50],[2,51],[0,54],[-3,58],[-6,56]], [[44,-25],[50,-15],[49,-12],[44,-17]], [[130,31],[141,36],[142,44],[139,40]],
  [[95,5],[105,-6],[120,-9],[118,0],[109,2],[100,6]],
];

function inPoly(x: number, y: number, poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

let cache: [number, number][] | null = null;
/** Points [lon, lat] situés sur les terres, espacés de ~2.3°. */
export function landDots(): [number, number][] {
  if (cache) return cache;
  const out: [number, number][] = [];
  for (let lat = -58; lat <= 80; lat += 2.3) {
    const step = 2.3 / Math.max(0.25, Math.cos((lat * Math.PI) / 180));
    for (let lon = -180; lon < 180; lon += step) if (LAND.some((p) => inPoly(lon, lat, p))) out.push([lon, lat]);
  }
  return (cache = out);
}

/** Projection équirectangulaire utilisée par les cartes plates (latitudes 80°N → 58°S). */
export const MAP_W = 1000;
export const MAP_H = 470;
export const mapX = (lon: number) => ((lon + 180) / 360) * MAP_W;
export const mapY = (lat: number) => ((80 - lat) / 138) * MAP_H;

/** Arc quadratique entre deux points de carte (pour les « connexions »). */
export function mapArc(lon1: number, lat1: number, lon2: number, lat2: number) {
  const x1 = mapX(lon1), y1 = mapY(lat1), x2 = mapX(lon2), y2 = mapY(lat2);
  const lift = Math.min(160, Math.hypot(x2 - x1, y2 - y1) * 0.35);
  return `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - lift} ${x2} ${y2}`;
}

export type GeoDestination = {
  slug: string;
  name: string;
  city?: string;
  lon: number;
  lat: number;
  opportunities: string[];
  experts: number;
};
