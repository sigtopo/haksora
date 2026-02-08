
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
}

export type MapMode = 'VIEW' | 'PICK_LOCATION';
