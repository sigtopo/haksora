
export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Report {
  id: string;
  location: GeoLocation;
  timestamp: number;
  nom_douar: string;
  imageUrl?: string;
  type_risk: string;
}

export type MapMode = 'VIEW' | 'PICK_LOCATION';

export const RISK_TYPES = [
  "فيضانات",
  "انهيار أتربة",
  "تشققات مباني",
  "انقطاع طريق",
  "أخرى"
];
