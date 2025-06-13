export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: number[] | number[][]; // Depends on geometry type (e.g., Point, LineString, etc.)
  };
  properties: any;
}

export enum InteractionTypes {
  DRAW = 'draw',
  MODIFY = 'modify',
  DELETE = 'delete',
}

export enum Projections {
  EPSG_3857 = 'EPSG:3857',
}

export enum OlEvents {
  DRAW_END = 'drawend',
  MODIFY_END = 'modifyend',
}
