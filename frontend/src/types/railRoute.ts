export interface RailRoute {
  code: string;
  name: string;
  network: string;
  operator: string;
  color: string;
  headwayMin: number;
  platforms: string[];
  numbers: string[];
  stations: string[];
  notes?: string;
}
