export interface Population {
  [color: string]: number;
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
