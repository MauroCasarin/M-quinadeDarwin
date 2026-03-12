export interface SpeciesTraits {
  size: number; // 1-10
  weight: number; // 1-10
  hasLegs: boolean;
  canSwim: boolean;
  speed: number; // 1-10
}

export interface SpeciesData {
  count: number;
  traits: SpeciesTraits;
}

export interface Population {
  [color: string]: SpeciesData;
}

export interface GenerationData {
  generation: number;
  population: Population;
  survivors?: Population;
  module?: string;
  mutation?: string;
  analysis?: string;
  frequencies: { [color: string]: number };
}

export interface SimulationState {
  generations: GenerationData[];
  currentColorOptions: string[];
}
