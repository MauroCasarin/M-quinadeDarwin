import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Activity, 
  Settings, 
  Play, 
  Pause, 
  RotateCcw, 
  TrendingUp, 
  Users, 
  Zap, 
  Info,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 
 * UTILS 
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * TYPES
 */
interface Genotype {
  sizeGene: number;      // 0.0 to 1.0
  speedGene: number;     // 0.0 to 1.0
  senseGene: number;     // 0.0 to 1.0
  colorHue: number;      // 0 to 360
  shapeGene: number;     // 0.0 to 1.0
  spikeGene: number;     // 0.0 to 1.0
  tailGene: number;      // 0.0 to 1.0
  hunterTraitGene: number; // 0.0 to 1.0
}

interface Phenotype {
  size: number;      // Derived from sizeGene
  speed: number;     // Derived from speedGene
  senseRange: number; // Derived from senseGene
  color: string;
  sides: number;     // Derived from shapeGene (3 to 8)
  spikes: number;    // Derived from spikeGene (0 to 4)
  tailLength: number; // Derived from tailGene (0 to 15)
  targetPredatorTrait: 'size' | 'speed' | 'spikes' | 'sides';
}

interface Creature {
  id: string;
  x: number;
  y: number;
  energy: number;
  genotype: Genotype;
  phenotype: Phenotype;
  currentSize: number;
  angle: number;
  age: number;
  huntingTarget?: {x: number, y: number};
}

interface Food {
  id: string;
  x: number;
  y: number;
  size: number;
  energyValue: number;
  type: 'grass' | 'bush' | 'tree';
}

interface Predator {
  id: string;
  x: number;
  y: number;
  energy: number;
  angle: number;
  age: number;
  targetTrait: keyof Phenotype;
  size: number;
  currentSize: number;
  speed: number;
  spikes: number;
  sides: number;
  color: string;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
}

interface SpeciesStat {
  colorHue: number;
  population: number;
  avgSize: number;
  avgSpeed: number;
  avgSides: number;
  avgSpikes: number;
  avgTail: number;
  dominantHunterTrait: 'size' | 'speed' | 'spikes' | 'sides';
}

interface SimStats {
  generation: number;
  population: number;
  avgSize: number;
  avgSpeed: number;
  avgSense: number;
  history: any[];
  topSpecies: SpeciesStat[];
  activePredators: Predator[];
}

interface Environment {
  temperature: number; // -1 to 1 (Cold to Hot)
  hazards: number;     // 0 to 1
}

/**
 * CONSTANTS
 */
const WIDTH = 800;
const HEIGHT = 600;
const INITIAL_POP = 20;
const FOOD_ENERGY = 50;
const REPRODUCTION_ENERGY = 150;
const ENERGY_LOSS_BASE = 0.05;
const MUTATION_RATE = 0.1;

const CreatureShape = ({ sides, spikes, colorHue, tailLength, size = 12 }: { sides: number, spikes: number, colorHue: number, tailLength: number, size?: number }) => {
  const scale = 12 / Math.max(size + tailLength, size + 5);
  const s = size * scale;
  const t = tailLength * scale;
  const center = 16;
  
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    points.push(`${center + Math.cos(angle) * s},${center + Math.sin(angle) * s}`);
  }
  
  const spikeElements = [];
  for (let i = 0; i < spikes; i++) {
    const angle = Math.PI + (Math.PI / 1.5) * ((i + 0.5) / spikes - 0.5);
    const px = center + Math.cos(angle) * s * 0.6;
    const py = center + Math.sin(angle) * s * 0.6;
    const x2 = px + Math.cos(angle) * 6 * scale;
    const y2 = py + Math.sin(angle) * 6 * scale;
    spikeElements.push(<line key={i} x1={px} y1={py} x2={x2} y2={y2} stroke={`hsl(${colorHue}, 100%, 50%)`} strokeWidth="2" />);
  }

  return (
    <svg width="32" height="32" className="shrink-0 drop-shadow-md" style={{ transform: 'rotate(0deg)' }}>
      {t > 2 && (
        <line x1={center - s * 0.5} y1={center} x2={center - s * 0.5 - t} y2={center} stroke={`hsl(${colorHue}, 100%, 50%)`} strokeWidth="2" />
      )}
      {spikeElements}
      <polygon points={points.join(' ')} fill={`hsl(${colorHue}, 100%, 50%)`} stroke="white" strokeWidth="1" opacity="0.9" />
      <circle cx={center + s * 0.3} cy={center} r={s * 0.15} fill="white" />
    </svg>
  );
};

const PredatorShape = ({ sides, spikes, size = 15, color = '#ef4444' }: { sides: number, spikes: number, size?: number, color?: string }) => {
  const scale = 12 / Math.max(size + 10, size);
  const s = size * scale;
  const center = 16;
  
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i * 2 * Math.PI) / sides;
    points.push(`${center + Math.cos(angle) * s},${center + Math.sin(angle) * s}`);
    const innerAngle = angle + Math.PI / sides;
    const innerRadius = s * 0.4;
    points.push(`${center + Math.cos(innerAngle) * innerRadius},${center + Math.sin(innerAngle) * innerRadius}`);
  }
  
  const spikeElements = [];
  for (let i = 0; i < spikes; i++) {
    const angle = (i * 2 * Math.PI) / spikes;
    const x1 = center;
    const y1 = center;
    const x2 = center + Math.cos(angle) * (s + 10 * scale);
    const y2 = center + Math.sin(angle) * (s + 10 * scale);
    spikeElements.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="2" />);
  }

  return (
    <svg width="32" height="32" className="shrink-0 drop-shadow-md" style={{ transform: 'rotate(0deg)' }}>
      {spikeElements}
      <polygon points={points.join(' ')} fill={color} stroke="#000" strokeWidth="1" />
      <circle cx={center + s * 0.3} cy={center} r={s * 0.15} fill="#000" />
    </svg>
  );
};

/**
 * MAIN COMPONENT
 */
export default function App() {
  // State
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [food, setFood] = useState<Food[]>([]);
  const [predators, setPredators] = useState<Predator[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null);
  const [stats, setStats] = useState<SimStats>({
    generation: 0,
    population: 0,
    avgSize: 0,
    avgSpeed: 0,
    avgSense: 0,
    history: [],
    topSpecies: [],
    activePredators: []
  });
  
  // Refs for simulation loop to avoid React state lag
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const predatorsRef = useRef<Predator[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Settings
  const [prevStats, setPrevStats] = useState({ population: 0, predators: 0 });
  const [log, setLog] = useState<string[]>([]);
  const [mutationStrength, setMutationStrength] = useState(0.2);

  useEffect(() => {
    if (stats.population === 0 && prevStats.population > 0) {
      setLog(prev => [`${new Date().toLocaleTimeString()} - ¡Los Glidons se han extinguido!`, ...prev]);
    } else if (stats.population > 0 && prevStats.population === 0) {
      setLog(prev => [`${new Date().toLocaleTimeString()} - ¡Nueva especie de Glidons detectada!`, ...prev]);
    }
    if (stats.predators === 0 && prevStats.predators > 0) {
      setLog(prev => [`${new Date().toLocaleTimeString()} - ¡Los Vorax se han extinguido!`, ...prev]);
    } else if (stats.predators > 0 && prevStats.predators === 0) {
      setLog(prev => [`${new Date().toLocaleTimeString()} - ¡Nuevo Vorax detectado!`, ...prev]);
    }
    setPrevStats({ population: stats.population, predators: stats.predators });
  }, [stats.population, stats.predators]);

  const [simSpeed, setSimSpeed] = useState(0.5);
  const [env, setEnv] = useState<Environment>({
    temperature: 0,
    hazards: 0.2
  });

  /**
   * GENETICS HELPERS
   */
  const expressPhenotype = (genotype: Genotype): Phenotype => {
    const predatorTraits: ('size' | 'speed' | 'spikes' | 'sides')[] = ['size', 'speed', 'spikes', 'sides'];
    return {
      size: 8 + genotype.sizeGene * 22,          // 8 to 30
      speed: 1.0 + genotype.speedGene * 4.0,     // 1.0 to 5.0
      senseRange: 40 + genotype.senseGene * 160, // 40 to 200
      color: `hsl(${genotype.colorHue}, 100%, 50%)`, // More vivid colors
      sides: Math.floor(3 + genotype.shapeGene * 5.99), // 3 to 8 sides
      spikes: Math.floor(genotype.spikeGene * 4.99), // 0 to 4 spikes
      tailLength: genotype.tailGene * 15, // 0 to 15px tail
      targetPredatorTrait: predatorTraits[Math.floor(genotype.hunterTraitGene * 3.99)]
    };
  };

  const mutate = (genotype: Genotype): Genotype => {
    const m = mutationStrength * 0.5;
    return {
      sizeGene: Math.max(0, Math.min(1, genotype.sizeGene + (Math.random() - 0.5) * m)),
      speedGene: Math.max(0, Math.min(1, genotype.speedGene + (Math.random() - 0.5) * m)),
      senseGene: Math.max(0, Math.min(1, genotype.senseGene + (Math.random() - 0.5) * m)),
      colorHue: genotype.colorHue, // COLOR STAYS EXACTLY THE SAME TO TRACK LINEAGE
      shapeGene: Math.max(0, Math.min(1, genotype.shapeGene + (Math.random() - 0.5) * m)),
      spikeGene: Math.max(0, Math.min(1, genotype.spikeGene + (Math.random() - 0.5) * m)),
      tailGene: Math.max(0, Math.min(1, genotype.tailGene + (Math.random() - 0.5) * m)),
      hunterTraitGene: Math.max(0, Math.min(1, genotype.hunterTraitGene + (Math.random() - 0.5) * m))
    };
  };

  /**
   * INITIALIZATION
   */
  const init = () => {
    const initialCreatures: Creature[] = [];
    const numSpecies = 3;
    const creaturesPerSpecies = 2;

    for (let s = 0; s < numSpecies; s++) {
      const baseGenotype = {
        sizeGene: Math.random(),
        speedGene: Math.random(),
        senseGene: Math.random(),
        colorHue: Math.random() * 360,
        shapeGene: Math.random(),
        spikeGene: Math.random(),
        tailGene: Math.random(),
        hunterTraitGene: Math.random()
      };

      for (let i = 0; i < creaturesPerSpecies; i++) {
        const genotype = { ...baseGenotype };
        // slight mutation for individuals
        genotype.sizeGene = Math.max(0, Math.min(1, genotype.sizeGene + (Math.random() - 0.5) * 0.1));
        genotype.speedGene = Math.max(0, Math.min(1, genotype.speedGene + (Math.random() - 0.5) * 0.1));

        const phenotype = expressPhenotype(genotype);
        initialCreatures.push({
          id: `c-${Date.now()}-${s}-${i}`,
          x: Math.random() * WIDTH,
          y: Math.random() * HEIGHT,
          energy: 100,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          genotype,
          phenotype,
          currentSize: phenotype.size * 0.53 // 100/300 energy
        });
      }
    }

    const initialFood: Food[] = Array.from({ length: 10 }).map((_, i) => {
      const size = 5 + Math.random() * 10;
      return {
        id: `f-${Date.now()}-${i}`,
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        size: size,
        energyValue: size * 15,
        type: size > 12 ? 'tree' : (size > 8 ? 'bush' : 'grass')
      };
    });

    const traits: (keyof Phenotype)[] = ['size', 'speed', 'spikes', 'tailLength', 'sides'];
    const initialPredators: Predator[] = [];

    creaturesRef.current = initialCreatures;
    foodRef.current = initialFood;
    predatorsRef.current = initialPredators;
    setCreatures(initialCreatures);
    setFood(initialFood);
    setPredators(initialPredators);
    setStats({
      generation: 0,
      population: INITIAL_POP,
      avgSize: 10,
      avgSpeed: 2,
      avgSense: 100,
      history: [],
      topSpecies: [],
      activePredators: initialPredators
    });
  };

  useEffect(() => {
    init();
  }, []);

  /**
   * SIMULATION LOGIC
   */
  const update = (time: number) => {
    if (!isRunning) return;

    // Initialize lastTime on first run to avoid huge dt
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = time;
    }

    let dt = ((time - lastTimeRef.current) / 16.67) * simSpeed; // Normalize to ~60fps and apply speed
    if (dt > 4) dt = 4; // Cap dt to prevent extreme jumps at high speeds
    lastTimeRef.current = time;

    let currentCreatures = [...creaturesRef.current];
    let currentFood = [...foodRef.current];
    let currentPredators = [...predatorsRef.current];

    // 1. Grow existing food (since new food only spawns from corpses, existing food must grow to add energy to the system)
    const newSeeds: Food[] = [];
    currentFood.forEach(f => {
      if (f.size < 25) {
        f.size += 0.02 * dt;
        f.energyValue = f.size * 15;
        f.type = f.size > 15 ? 'tree' : (f.size > 8 ? 'bush' : 'grass');
      }
      // Mature plants drop seeds occasionally
      if (f.size > 15 && Math.random() < 0.0005 * dt && currentFood.length + newSeeds.length < 40) {
        newSeeds.push({
          id: `f-seed-${Date.now()}-${Math.random()}`,
          x: Math.max(0, Math.min(WIDTH, f.x + (Math.random() - 0.5) * 100)),
          y: Math.max(0, Math.min(HEIGHT, f.y + (Math.random() - 0.5) * 100)),
          size: 2,
          energyValue: 30,
          type: 'grass'
        });
      }
    });
    currentFood.push(...newSeeds);

    // Fallback: if absolutely no food exists, spawn a tiny seed to restart the cycle
    if (currentFood.length === 0 && Math.random() < 0.01) {
      currentFood.push({
        id: `f-${Date.now()}`,
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        size: 2,
        energyValue: 30,
        type: 'grass'
      });
    }

    // 2. Update Creatures
    const nextCreatures: Creature[] = [];
    
    currentCreatures.forEach(c => {
      // Update current size based on energy (grows as it eats)
      c.currentSize = c.phenotype.size * Math.min(1, 0.3 + (c.energy / REPRODUCTION_ENERGY) * 0.7);

      // 1. BASE METABOLISM (Genotype expression)
      const baseCost = ENERGY_LOSS_BASE + 
                        (c.currentSize * 0.005) + 
                        (Math.pow(c.phenotype.speed, 2) * 0.05) + 
                        (c.phenotype.senseRange * 0.0005);
      
      // 2. ENVIRONMENTAL PRESSURES (The "Selection" part)
      // Temperature Pressure: 
      // - Cold (temp < 0) favors Large size (Bergmann's Rule)
      // - Hot (temp > 0) favors Small size
      const tempEffect = env.temperature > 0 
        ? (c.currentSize * 0.01 * env.temperature) // Heat stress for big ones
        : (Math.abs(env.temperature) * (20 - c.currentSize) * 0.01); // Cold stress for small ones

      // Hazard Pressure:
      // - High hazards favor Speed (evasion)
      const hazardEffect = env.hazards * (5 - c.phenotype.speed) * 0.05;

      const totalEnergyCost = (baseCost + tempEffect + hazardEffect) * dt;
      
      c.energy -= totalEnergyCost;
      c.age += 0.01 * dt;

      if (c.energy <= 0) {
        if (selectedCreature?.id === c.id) setSelectedCreature(null);
        // Spawn food from corpse
        const foodSize = Math.max(4, c.currentSize * 0.6);
        currentFood.push({
          id: `f-${Date.now()}-${Math.random()}`,
          x: c.x,
          y: c.y,
          size: foodSize,
          energyValue: foodSize * 15,
          type: foodSize > 12 ? 'tree' : (foodSize > 7 ? 'bush' : 'grass')
        });
        return;
      }

      // Find nearest food or prey
      let targetX: number | null = null;
      let targetY: number | null = null;
      let minDist = c.phenotype.senseRange;
      let nearestFoodId: string | null = null;
      let huntingTarget: {x: number, y: number} | undefined = undefined;
      let predatorToFlee: Predator | null = null;
      let minPredatorDist = c.phenotype.senseRange;

      // 1. Look for edible predators first (Active Hunting) or predators to flee from
      let bestPredatorScore = -Infinity;
      currentPredators.forEach(p => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < c.phenotype.senseRange) {
          // Can we eat it? (Creature is significantly larger and has enough spikes)
          if (c.currentSize > p.currentSize * 1.2 && c.phenotype.spikes >= p.spikes) {
            const traitValue = Number(p[c.phenotype.targetPredatorTrait]) || 0;
            const score = -d + (traitValue * 20); // Reward matching preferred trait
            if (score > bestPredatorScore) {
              bestPredatorScore = score;
              targetX = p.x;
              targetY = p.y;
              huntingTarget = {x: p.x, y: p.y};
            }
          } else {
            // Flee!
            if (d < minPredatorDist) {
              minPredatorDist = d;
              predatorToFlee = p;
            }
          }
        }
      });
      c.huntingTarget = huntingTarget;

      // If we need to flee, override hunting/food
      if (predatorToFlee) {
        targetX = c.x + (c.x - predatorToFlee.x);
        targetY = c.y + (c.y - predatorToFlee.y);
        nearestFoodId = null; // Don't eat while fleeing
      }
      // 2. If no predator to hunt or flee from, look for regular food
      else if (targetX === null) {
        currentFood.forEach(f => {
          const d = Math.hypot(c.x - f.x, c.y - f.y);
          if (d < minDist) {
            minDist = d;
            targetX = f.x;
            targetY = f.y;
            nearestFoodId = f.id;
          }
        });
      }

      // Movement logic
      if (targetX !== null && targetY !== null) {
        const targetAngle = Math.atan2(targetY - c.y, targetX - c.x);
        let angleDiff = targetAngle - c.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        c.angle += angleDiff * 0.1 * dt;

        // Eat regular food (Predator eating is handled in the predator loop)
        if (nearestFoodId && minDist < c.currentSize + 5) {
          const eatenFood = currentFood.find(f => f.id === nearestFoodId);
          if (eatenFood) {
            c.energy += eatenFood.energyValue;
            // Reproduction triggered by eating
            if (Math.random() < 0.2 && nextCreatures.length < 150) {
              const childGenotype = mutate(c.genotype);
              const childPhenotype = expressPhenotype(childGenotype);
              const offspring: Creature = {
                id: `c-${Date.now()}-${Math.random()}`,
                x: c.x + (Math.random() - 0.5) * 50,
                y: c.y + (Math.random() - 0.5) * 50,
                energy: 30, // Starts with small energy
                angle: Math.random() * Math.PI * 2,
                age: 0,
                genotype: childGenotype,
                phenotype: childPhenotype,
                currentSize: childPhenotype.size * 0.2 // Starts very small
              };
              nextCreatures.push(offspring);
            }
            currentFood = currentFood.filter(f => f.id !== nearestFoodId);
          }
        }
      } else {
        c.angle += (Math.random() - 0.5) * 0.2 * dt;
      }

      // Move
      const energyFactor = 0.5 + (c.energy / REPRODUCTION_ENERGY) * 0.5; // 50% to 100%+ speed based on energy
      c.x += Math.cos(c.angle) * c.phenotype.speed * energyFactor * dt;
      c.y += Math.sin(c.angle) * c.phenotype.speed * energyFactor * dt;

      // Wrap around screen
      if (c.x < 0) c.x = WIDTH;
      if (c.x > WIDTH) c.x = 0;
      if (c.y < 0) c.y = HEIGHT;
      if (c.y > HEIGHT) c.y = 0;

      // Reproduction
      if (c.energy > REPRODUCTION_ENERGY && nextCreatures.length < 150) {
        c.energy /= 2;
        const childGenotype = mutate(c.genotype);
        const childPhenotype = expressPhenotype(childGenotype);
        const offspring: Creature = {
          id: `c-${Date.now()}-${Math.random()}`,
          x: c.x + (Math.random() - 0.5) * 20,
          y: c.y + (Math.random() - 0.5) * 20,
          energy: c.energy,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          genotype: childGenotype,
          phenotype: childPhenotype,
          currentSize: childPhenotype.size * 0.3 // Starts small
        };
        nextCreatures.push(offspring);
      }

      nextCreatures.push(c);
    });

    // 3. Update Predators
    const nextPredators: Predator[] = [];
    const currentExplosions = [...explosionsRef.current];
    
    currentPredators.forEach(p => {
      // Update current size based on energy
      p.currentSize = p.size * Math.min(1, 0.3 + (p.energy / 800) * 0.7);

      p.energy -= (0.3 + Math.pow(p.speed, 2) * 0.05 + p.currentSize * 0.01) * dt; // Energy loss based on speed and size
      p.age += 0.01 * dt;

      if (p.energy <= 0) {
        // Spawn food from predator corpse
        const foodSize = Math.max(6, p.currentSize * 0.8);
        currentFood.push({
          id: `f-${Date.now()}-${Math.random()}`,
          x: p.x,
          y: p.y,
          size: foodSize,
          energyValue: foodSize * 20,
          type: foodSize > 12 ? 'tree' : 'bush'
        });
        return; // Predator dies
      }

      // 1. Check for dangerous predators
      let predatorToFlee: Predator | null = null;
      let minPredatorDist = 200; // Fleeing range

      currentPredators.forEach(otherP => {
        if (otherP.id === p.id) return;
        const d = Math.hypot(p.x - otherP.x, p.y - otherP.y);
        if (d < minPredatorDist) {
          // Is it a threat? (Other predator is larger)
          if (otherP.currentSize > p.currentSize * 1.2) {
            minPredatorDist = d;
            predatorToFlee = otherP;
          }
        }
      });

      let bestTarget: Creature | null = null;
      let bestScore = -Infinity;
      let predatorEaten = false;

      nextCreatures.forEach(c => {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        
        // CHECK IF CREATURE EATS PREDATOR
        // If creature is large enough and has enough spikes
        if (d < 15 + c.currentSize && c.currentSize > p.currentSize * 1.2 && c.phenotype.spikes >= p.spikes) {
          c.energy += 400; // Creature gets huge energy boost, leading to rapid reproduction
          predatorEaten = true;
          currentExplosions.push({
            x: p.x,
            y: p.y,
            radius: 5,
            maxRadius: 40,
            color: 'rgba(255, 165, 0, 0.8)',
            life: 1.0
          });
        }

        if (!predatorEaten && d < 300 && !predatorToFlee) { // Predator vision range, don't hunt if fleeing
          // Score based on distance and preferred trait
          const traitValue = Number(c.phenotype[p.targetTrait]) || 0;
          const score = -d + (traitValue * 50);
          if (score > bestScore) {
            bestScore = score;
            bestTarget = c;
          }
        }
      });

      if (predatorEaten) return; // Predator was eaten by a creature

      let nearestFood: Food | null = null;
      let minFoodDist = 200;

      if (!bestTarget && !predatorToFlee) {
        currentFood.forEach(f => {
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          if (d < minFoodDist) {
            minFoodDist = d;
            nearestFood = f;
          }
        });
      }

      let targetX: number | null = null;
      let targetY: number | null = null;

      if (predatorToFlee) {
        targetX = p.x + (p.x - predatorToFlee.x);
        targetY = p.y + (p.y - predatorToFlee.y);
      } else if (bestTarget) {
        targetX = bestTarget.x;
        targetY = bestTarget.y;
      } else if (nearestFood) {
        targetX = nearestFood.x;
        targetY = nearestFood.y;
      }

      if (targetX !== null && targetY !== null) {
        const targetAngle = Math.atan2(targetY - p.y, targetX - p.x);
        let angleDiff = targetAngle - p.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        p.angle += angleDiff * 0.1 * dt;
      } else {
        p.angle += (Math.random() - 0.5) * 0.2 * dt;
      }

      // Check for eating
      if (bestTarget) {
        const d = Math.hypot(bestTarget.x - p.x, bestTarget.y - p.y);
        if (d < p.currentSize + bestTarget.currentSize) {
          // Eat creature
          p.energy += 200;
          // Remove creature from nextCreatures
          const index = nextCreatures.findIndex(c => c.id === bestTarget!.id);
          if (index !== -1) nextCreatures.splice(index, 1);
        }
      } else if (nearestFood) {
        const d = Math.hypot(nearestFood!.x - p.x, nearestFood!.y - p.y);
        if (d < p.currentSize + 5) {
          p.energy += nearestFood!.energyValue;
          currentFood = currentFood.filter(f => f.id !== nearestFood!.id);
        }
      }


      const predatorEnergyFactor = 0.5 + (p.energy / 800) * 0.5;
      p.x += Math.cos(p.angle) * p.speed * predatorEnergyFactor * dt;
      p.y += Math.sin(p.angle) * p.speed * predatorEnergyFactor * dt;

      if (p.x < 0) p.x = WIDTH;
      if (p.x > WIDTH) p.x = 0;
      if (p.y < 0) p.y = HEIGHT;
      if (p.y > HEIGHT) p.y = 0;

      // Predator reproduction
      if (p.energy > 800 && nextPredators.length < 3) {
        p.energy /= 2;
        const newSize = Math.max(10, p.size + (Math.random() - 0.5) * 5);
        nextPredators.push({
          ...p,
          id: `p-${Date.now()}-${Math.random()}`,
          x: p.x + (Math.random() - 0.5) * 20,
          y: p.y + (Math.random() - 0.5) * 20,
          energy: p.energy,
          age: 0,
          // Slight mutation in predator
          size: newSize,
          currentSize: newSize * 0.3, // Starts small
          speed: Math.max(1, p.speed + (Math.random() - 0.5) * 1),
          sides: Math.max(3, Math.min(8, p.sides + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 2)))
        });
      }

      nextPredators.push(p);
    });

    // Spawn new predator occasionally if none exist or randomly to add variety
    if ((nextPredators.length === 0 && nextCreatures.length > 15 && Math.random() < 0.01) || (Math.random() < 0.0005 && nextPredators.length < 5)) {
      const traits: (keyof Phenotype)[] = ['size', 'speed', 'spikes', 'tailLength', 'sides'];
      const numToSpawn = Math.floor(1 + Math.random() * 3); // Spawn 1 to 3 predators at once
      
      for (let i = 0; i < numToSpawn; i++) {
        if (nextPredators.length >= 5) break;
        const targetTrait = traits[Math.floor(Math.random() * traits.length)];
        
        let size = 15;
        let speed = 2.5;
        let spikes = 1;
        let sides = 4;
        let color = '#ef4444'; // Red (Default)
        
        if (targetTrait === 'speed') {
          speed = 4;
          size = 12;
          sides = 3;
          color = '#f97316'; // Orange (Fast)
        } else if (targetTrait === 'size') {
          size = 25;
          speed = 1.5;
          sides = 6;
          spikes = 2;
          color = '#8b5cf6'; // Purple (Tank)
        } else if (targetTrait === 'spikes') {
          spikes = 3;
          size = 18;
          speed = 2;
          color = '#ec4899'; // Pink (Spiky)
        } else if (targetTrait === 'sides') {
          sides = 8;
          size = 16;
          color = '#06b6d4'; // Cyan (Complex)
        }

        nextPredators.push({
          id: `p-${Date.now()}-${i}`,
          x: Math.random() * WIDTH,
          y: Math.random() * HEIGHT,
          energy: 400,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          targetTrait,
          size: size + (Math.random() - 0.5) * 4,
          currentSize: size * 0.5, // Start at half size
          speed: speed + (Math.random() - 0.5) * 0.5,
          spikes,
          sides,
          color
        });
      }
    }

    // Update explosions
    const nextExplosions = currentExplosions.map(e => ({
      ...e,
      radius: e.radius + (e.maxRadius - e.radius) * 0.1 * dt,
      life: e.life - 0.05 * dt
    })).filter(e => e.life > 0);

    creaturesRef.current = nextCreatures;
    foodRef.current = currentFood;
    predatorsRef.current = nextPredators;
    explosionsRef.current = nextExplosions;

    // Draw to canvas
    draw();

    requestRef.current = requestAnimationFrame(update);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.fillStyle = '#1a2e1a'; // Natural dark forest green
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw Grid (Subtle)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i < WIDTH; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < HEIGHT; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(WIDTH, i);
      ctx.stroke();
    }

    // Draw Food
    foodRef.current.forEach(f => {
      ctx.save();
      ctx.translate(f.x, f.y);
      
      if (f.type === 'grass') {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, f.size);
        ctx.quadraticCurveTo(-f.size/2, 0, -f.size, -f.size);
        ctx.moveTo(0, f.size);
        ctx.lineTo(0, -f.size * 1.2);
        ctx.moveTo(0, f.size);
        ctx.quadraticCurveTo(f.size/2, 0, f.size, -f.size);
        ctx.stroke();
      } else if (f.type === 'bush') {
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(0, 0, f.size, 0, Math.PI * 2);
        ctx.arc(-f.size*0.5, -f.size*0.5, f.size*0.8, 0, Math.PI * 2);
        ctx.arc(f.size*0.5, -f.size*0.5, f.size*0.8, 0, Math.PI * 2);
        ctx.fill();
      } else if (f.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#78350f';
        ctx.fillRect(-f.size*0.2, 0, f.size*0.4, f.size);
        // Leaves
        ctx.fillStyle = '#15803d';
        ctx.beginPath();
        ctx.arc(0, -f.size*0.5, f.size, 0, Math.PI * 2);
        ctx.arc(-f.size*0.6, -f.size*0.2, f.size*0.8, 0, Math.PI * 2);
        ctx.arc(f.size*0.6, -f.size*0.2, f.size*0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });

    // Draw Hunting Lines
    creaturesRef.current.forEach(c => {
      if (c.huntingTarget) {
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.huntingTarget.x, c.huntingTarget.y);
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw crosshair on target
        ctx.beginPath();
        ctx.arc(c.huntingTarget.x, c.huntingTarget.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Draw Creatures
    creaturesRef.current.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);

      // Selection highlight
      if (selectedCreature?.id === c.id) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, c.currentSize + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body (Polygon based on sides)
      ctx.fillStyle = c.phenotype.color;
      ctx.beginPath();
      ctx.moveTo(c.currentSize, 0); // Nose
      for (let i = 1; i < c.phenotype.sides; i++) {
        const angle = (i * 2 * Math.PI) / c.phenotype.sides;
        // Flatten the back a bit so it looks directional
        const radius = c.currentSize * (i === 0 ? 1 : 0.6);
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      ctx.closePath();
      ctx.fill();

      // Draw Tail
      if (c.phenotype.tailLength > 2) {
        ctx.beginPath();
        ctx.moveTo(-c.currentSize * 0.5, 0);
        const wiggle = Math.sin(c.age * 30) * (c.phenotype.tailLength * 0.5);
        ctx.lineTo(-c.currentSize * 0.5 - c.phenotype.tailLength, wiggle);
        ctx.strokeStyle = c.phenotype.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw Spikes
      if (c.phenotype.spikes > 0) {
        ctx.strokeStyle = c.phenotype.color;
        ctx.lineWidth = 2;
        for (let i = 0; i < c.phenotype.spikes; i++) {
          // Distribute spikes along the back
          const angle = Math.PI + (Math.PI / 1.5) * ((i + 0.5) / c.phenotype.spikes - 0.5);
          const px = Math.cos(angle) * c.currentSize * 0.6;
          const py = Math.sin(angle) * c.currentSize * 0.6;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + Math.cos(angle) * 6, py + Math.sin(angle) * 6);
          ctx.stroke();
        }
      }

      // Energy ring
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, c.currentSize + 2, 0, (Math.PI * 2) * (c.energy / REPRODUCTION_ENERGY));
      ctx.stroke();

      ctx.restore();
    });

    // Draw Predators
    predatorsRef.current.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Draw Predator Body (Variable Shape)
      ctx.fillStyle = p.color || '#ef4444'; // Use predator color
      ctx.beginPath();
      for (let i = 0; i < p.sides; i++) {
        const angle = (i * 2 * Math.PI) / p.sides;
        const radius = p.currentSize;
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        const innerAngle = angle + Math.PI / p.sides;
        const innerRadius = p.currentSize * 0.4;
        ctx.lineTo(Math.cos(innerAngle) * innerRadius, Math.sin(innerAngle) * innerRadius);
      }
      ctx.closePath();
      ctx.fill();

      // Draw Predator Spikes
      if (p.spikes > 0) {
        ctx.strokeStyle = p.color || '#ef4444';
        ctx.lineWidth = 2;
        for (let i = 0; i < p.spikes; i++) {
          const angle = (i * 2 * Math.PI) / p.spikes;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * (p.currentSize + 10), Math.sin(angle) * (p.currentSize + 10));
          ctx.stroke();
        }
      }

      // Draw Eye
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(p.currentSize * 0.3, 0, p.currentSize * 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Energy ring
      ctx.strokeStyle = p.color ? p.color.replace(')', ', 0.5)').replace('rgb', 'rgba') : 'rgba(239, 68, 68, 0.5)';
      if (p.color && p.color.startsWith('#')) {
        ctx.strokeStyle = p.color + '80'; // Add 50% opacity hex
      }
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.currentSize + 4, 0, (Math.PI * 2) * (p.energy / 600));
      ctx.stroke();

      ctx.restore();
    });

    // Draw Explosions
    explosionsRef.current.forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.color.replace('0.8)', `${e.life * 0.8})`);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 0, ${e.life})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) * (WIDTH / rect.width);
    const y = (e.clientY - rect.top) * (HEIGHT / rect.height);

    let found: Creature | null = null;
    let minDist = 30;

    creaturesRef.current.forEach(c => {
      const d = Math.sqrt(Math.pow(c.x - x, 2) + Math.pow(c.y - y, 2));
      if (d < minDist) {
        minDist = d;
        found = c;
      }
    });

    setSelectedCreature(found);
  };

  useEffect(() => {
    if (isRunning) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(update);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      lastTimeRef.current = 0; // Reset for next start
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isRunning]);

  // Update stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) return;
      
      const pop = creaturesRef.current.length;
      if (pop === 0) {
        setIsRunning(false);
        return;
      }

      const avgSize = creaturesRef.current.reduce((acc, c) => acc + c.phenotype.size, 0) / pop;
      const avgSpeed = creaturesRef.current.reduce((acc, c) => acc + c.phenotype.speed, 0) / pop;
      const avgSense = creaturesRef.current.reduce((acc, c) => acc + c.phenotype.senseRange, 0) / pop;

      // Calculate Species Stats
      const speciesMap = new Map<number, Creature[]>();
      creaturesRef.current.forEach(c => {
        const hueGroup = Math.round(c.genotype.colorHue / 10) * 10; // Group by similar hue
        if (!speciesMap.has(hueGroup)) speciesMap.set(hueGroup, []);
        speciesMap.get(hueGroup)!.push(c);
      });

      const topSpecies: SpeciesStat[] = Array.from(speciesMap.entries())
        .map(([hue, group]) => {
          const traitCounts = { size: 0, speed: 0, spikes: 0, sides: 0 };
          group.forEach(c => traitCounts[c.phenotype.targetPredatorTrait]++);
          const dominantTrait = (Object.keys(traitCounts) as ('size' | 'speed' | 'spikes' | 'sides')[]).reduce((a, b) => traitCounts[a] > traitCounts[b] ? a : b);

          return {
            colorHue: hue,
            population: group.length,
            avgSize: group.reduce((acc, c) => acc + c.phenotype.size, 0) / group.length,
            avgSpeed: group.reduce((acc, c) => acc + c.phenotype.speed, 0) / group.length,
            avgSides: group.reduce((acc, c) => acc + c.phenotype.sides, 0) / group.length,
            avgSpikes: group.reduce((acc, c) => acc + c.phenotype.spikes, 0) / group.length,
            avgTail: group.reduce((acc, c) => acc + c.phenotype.tailLength, 0) / group.length,
            dominantHunterTrait: dominantTrait
          };
        })
        .sort((a, b) => b.population - a.population)
        .slice(0, 3); // Top 3 species

      // Update selected creature if it exists
      if (selectedCreature) {
        const updated = creaturesRef.current.find(c => c.id === selectedCreature.id);
        if (updated) setSelectedCreature(updated);
      }

      setStats(prev => {
        const newHistory = [...prev.history, {
          time: prev.history.length,
          pop,
          size: avgSize,
          speed: avgSpeed,
          sense: avgSense / 10 // Scale for chart
        }].slice(-50);

        return {
          generation: prev.generation + 1,
          population: pop,
          avgSize,
          avgSpeed,
          avgSense,
          history: newHistory,
          topSpecies,
          activePredators: [...predatorsRef.current]
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, selectedCreature]);

  // Automatic Environmental Cycle every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRunning) return;

      setEnv(prev => ({
        temperature: Math.max(-1, Math.min(1, prev.temperature + (Math.random() - 0.5) * 0.6)),
        hazards: Math.max(0, Math.min(1, prev.hazards + (Math.random() - 0.5) * 0.4))
      }));
      
      setMutationStrength(prev => Math.max(0.05, Math.min(1, prev + (Math.random() - 0.5) * 0.3)));

      // 40% chance to spawn a completely new species
      if (Math.random() < 0.4 && creaturesRef.current.length < 150) {
        const newGenotype = {
          sizeGene: Math.random(),
          speedGene: Math.random(),
          senseGene: Math.random(),
          colorHue: Math.random() * 360,
          shapeGene: Math.random(),
          spikeGene: Math.random(),
          tailGene: Math.random(),
          hunterTraitGene: Math.random()
        };
        creaturesRef.current.push({
          id: `c-alien-${Date.now()}`,
          x: Math.random() * WIDTH,
          y: Math.random() * HEIGHT,
          energy: REPRODUCTION_ENERGY * 0.8,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          genotype: newGenotype,
          phenotype: expressPhenotype(newGenotype)
        });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white uppercase">Darwin Engine</h1>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Natural Selection Simulator v2.4</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 px-4 py-1.5 bg-white/5 rounded-full border border-white/10">
              <StatItem label="Población" value={stats.population} icon={<Users className="w-3 h-3" />} />
              <div className="w-px h-4 bg-white/10" />
              <StatItem label="Generación" value={stats.generation} icon={<TrendingUp className="w-3 h-3" />} />
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsRunning(!isRunning)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-all",
                  isRunning ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20" : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500"
                )}
              >
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? "Pausar" : "Iniciar"}
              </button>
              <button 
                onClick={init}
                className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-slate-400"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel: Simulation View */}
        <div className="lg:col-span-8 space-y-6">
          <div className="relative aspect-[4/3] bg-[#0a0a0a] rounded-2xl border border-white/5 overflow-hidden shadow-2xl group cursor-crosshair">
            <canvas 
              ref={canvasRef} 
              width={WIDTH} 
              height={HEIGHT} 
              onClick={handleCanvasClick}
              className="w-full h-full object-contain"
            />
            
            {/* Overlay Info */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                RENDER: WEBGL_CONTEXT_2D
              </div>
              <div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono">
                RESOLUTION: {WIDTH}x{HEIGHT}
              </div>
            </div>

            <AnimatePresence>
              {!isRunning && stats.generation === 0 && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                >
                  <div className="text-center max-w-md p-8">
                    <Activity className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-white mb-2">Simulador de Selección Natural</h2>
                    <p className="text-slate-400 text-sm mb-6">
                      Observa cómo la variabilidad genética y la lucha por los recursos moldean la evolución de los Glidons en tiempo real.
                    </p>
                    <button 
                      onClick={() => setIsRunning(true)}
                      className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-105 transition-transform"
                    >
                      Comenzar Evolución
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Trait Evolution Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartCard title="Dinámica de Población" icon={<Users className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.history}>
                  <defs>
                    <linearGradient id="colorPop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Area type="monotone" dataKey="pop" stroke="#6366f1" fillOpacity={1} fill="url(#colorPop)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Evolución de Rasgos" icon={<Zap className="w-4 h-4" />}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                  />
                  <Line type="monotone" dataKey="size" stroke="#f43f5e" dot={false} strokeWidth={2} name="Tamaño" />
                  <Line type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} strokeWidth={2} name="Velocidad" />
                  <Line type="monotone" dataKey="sense" stroke="#eab308" dot={false} strokeWidth={2} name="Percepción" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>

        {/* Right Panel: Controls & Info */}
        <div className="lg:col-span-4 space-y-6">
          {/* Genome Inspector */}
          <AnimatePresence mode="wait">
            {selectedCreature ? (
              <motion.div 
                key="inspector"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Inspector de Genoma
                  </h3>
                  <button onClick={() => setSelectedCreature(null)} className="text-slate-500 hover:text-white">×</button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Genotipo (DNA)</div>
                    <GeneBar label="Gen Tamaño" value={selectedCreature.genotype.sizeGene} color="bg-rose-500" />
                    <GeneBar label="Gen Velocidad" value={selectedCreature.genotype.speedGene} color="bg-blue-500" />
                    <GeneBar label="Gen Percepción" value={selectedCreature.genotype.senseGene} color="bg-yellow-500" />
                    <GeneBar label="Gen Forma" value={selectedCreature.genotype.shapeGene} color="bg-purple-500" />
                    <GeneBar label="Gen Púas" value={selectedCreature.genotype.spikeGene} color="bg-emerald-500" />
                    <GeneBar label="Gen Cola" value={selectedCreature.genotype.tailGene} color="bg-cyan-500" />
                    <GeneBar label="Gen Caza (Depredador)" value={selectedCreature.genotype.hunterTraitGene} color="bg-orange-500" />
                  </div>
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Fenotipo (Físico)</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.size.toFixed(1)} px</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.speed.toFixed(2)} m/s</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.senseRange.toFixed(0)} m</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.sides} Lados</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.spikes} Púas</div>
                    <div className="text-xs text-white font-mono">Cola: {selectedCreature.phenotype.tailLength.toFixed(0)}px</div>
                    <div className="text-xs text-orange-400 font-mono">Caza: {selectedCreature.phenotype.targetPredatorTrait}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase font-bold mb-2">
                    <span>Energía Vital</span>
                    <span>{Math.round(selectedCreature.energy)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300" 
                      style={{ width: `${Math.min(100, (selectedCreature.energy / REPRODUCTION_ENERGY) * 100)}%` }} 
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="placeholder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center space-y-2"
              >
                <Users className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Haz clic en una criatura para inspeccionar su código genético.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Real-time Metrics */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-2">
              <BarChart3 className="w-3 h-3" /> Ecosistema Actual
            </h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] text-slate-400 uppercase font-bold mb-3">Especies Dominantes</h4>
                <div className="space-y-3">
                  {stats.topSpecies.length > 0 ? stats.topSpecies.map((sp, i) => {
                    const traitNames: Record<string, string> = {
                      size: 'Tamaño Grande',
                      speed: 'Alta Velocidad',
                      spikes: 'Púas',
                      tailLength: 'Cola Larga',
                      sides: 'Formas Complejas'
                    };
                    const traitReasons: Record<string, string> = {
                      size: 'su gran tamaño (aporta mucha energía)',
                      speed: 'su alta velocidad (músculos ricos en nutrientes)',
                      spikes: 'sus púas (minerales útiles para defensa)',
                      sides: 'su forma compleja (biomasa densa)'
                    };
                    return (
                    <div key={i} className="bg-black/20 p-3 rounded-lg border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CreatureShape sides={Math.round(sp.avgSides)} spikes={Math.round(sp.avgSpikes)} colorHue={sp.colorHue} tailLength={sp.avgTail} size={sp.avgSize} />
                          <span className="text-xs font-bold text-white">Especie {i + 1}</span>
                        </div>
                        <span className="text-[10px] text-indigo-400 font-mono">{sp.population} ind.</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-400 font-mono">
                        <div>Forma: {sp.avgSides.toFixed(1)} lados</div>
                        <div>Púas: {sp.avgSpikes.toFixed(1)}</div>
                        <div>Cola: {sp.avgTail.toFixed(1)}px</div>
                        <div>Tamaño: {sp.avgSize.toFixed(1)}</div>
                      </div>
                      <div className="mt-2 text-[9px] text-orange-400/80 bg-orange-500/10 p-1.5 rounded border border-orange-500/20">
                        <strong>Caza preferida:</strong> Depredadores con {traitNames[sp.dominantHunterTrait] || sp.dominantHunterTrait} por {traitReasons[sp.dominantHunterTrait] || 'su composición'}.
                      </div>
                    </div>
                  )}) : (
                    <div className="text-xs text-slate-500 italic">Sin Glidons activos</div>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <h4 className="text-[10px] text-slate-400 uppercase font-bold mb-3">Depredadores Activos</h4>
                <div className="space-y-3">
                  {stats.activePredators.length > 0 ? stats.activePredators.map((p, i) => {
                    const traitNames: Record<string, string> = {
                      size: 'Tamaño Grande',
                      speed: 'Alta Velocidad',
                      spikes: 'Púas',
                      tailLength: 'Cola Larga',
                      sides: 'Formas Complejas'
                    };
                    const traitReasons: Record<string, string> = {
                      size: 'su gran tamaño (aporta mucha energía)',
                      speed: 'su alta velocidad (músculos ricos en nutrientes)',
                      spikes: 'sus púas (minerales útiles para defensa)',
                      sides: 'su forma compleja (biomasa densa)'
                    };
                    const hunters = stats.topSpecies.filter(sp => sp.avgSize > p.currentSize * 1.2 && sp.avgSpikes >= p.spikes);

                    return (
                      <div key={p.id} className="bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <PredatorShape sides={p.sides} spikes={p.spikes} size={p.size} color={p.color} />
                            <span className="text-xs font-bold text-red-400">Cazador {i + 1}</span>
                          </div>
                          <span className="text-[10px] text-red-300 font-mono">Vel: {p.speed.toFixed(1)}</span>
                        </div>
                        <div className="text-[10px] text-slate-300">
                          <strong>Atraído por:</strong> <span className="text-white">{traitNames[p.targetTrait] || p.targetTrait}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          Forma: {p.sides} lados | Tamaño: {p.size.toFixed(1)} | Púas: {p.spikes}
                        </div>
                        {hunters.length > 0 && (
                          <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                            <div className="text-[10px] text-yellow-500 font-bold mb-0.5">¡Cazado por Especie {stats.topSpecies.indexOf(hunters[0]) + 1}!</div>
                            <div className="text-[9px] text-yellow-400/80 leading-tight">
                              La población lo caza porque les atrae {traitReasons[hunters[0].dominantHunterTrait] || 'su composición'} para alimentarse y vivir.
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="text-xs text-slate-500 italic">Ningún depredador en la zona</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Simulation Controls */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
            <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-2">
              <Settings className="w-3 h-3" /> Parámetros de Entorno
            </h3>

            <div className="space-y-6">
              <ControlSlider 
                label="Velocidad de Simulación" 
                value={simSpeed} 
                onChange={setSimSpeed} 
                min={0.1} 
                max={3} 
                step={0.1}
              />
              <div className="pt-4 border-t border-white/5">
                <ControlSlider 
                  label="Temperatura (Frío ↔ Calor)" 
                  value={env.temperature} 
                  onChange={(v) => setEnv(prev => ({ ...prev, temperature: v }))} 
                  min={-1} 
                  max={1} 
                  step={0.1}
                />
              </div>
              <ControlSlider 
                label="Peligros Ambientales" 
                value={env.hazards} 
                onChange={(v) => setEnv(prev => ({ ...prev, hazards: v }))} 
                min={0} 
                max={1} 
                step={0.1}
              />
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Fuerza de Mutación</span>
                  <span className="text-[10px] text-indigo-400 font-mono">Auto-Ciclo</span>
                </div>
                <ControlSlider 
                  label="" 
                  value={mutationStrength} 
                  onChange={setMutationStrength} 
                  min={0.05} 
                  max={1} 
                  step={0.05}
                />
              </div>
            </div>
          </div>

          {/* Educational Info */}
          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-6 space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-indigo-600 rounded-lg shrink-0">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-white">El Individuo vs La Población</h4>
                
                <div className="space-y-3">
                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-white font-bold mb-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> El Individuo
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                      Ser único e independiente. Tiene un ADN fijo que no cambia durante su vida.
                      <br/><strong className="text-indigo-300">Rol en la evolución:</strong> El individuo no evoluciona; simplemente vive o muere. Si sus rasgos son buenos, sobrevive; si son malos, desaparece.
                    </p>
                    <p className="text-[9px] text-slate-500 italic border-l-2 border-slate-600 pl-2">
                      En Darwin: "La lucha por la existencia ocurre a nivel individual."
                    </p>
                  </div>

                  <div className="bg-black/20 rounded-lg p-3 border border-white/5">
                    <div className="text-xs text-white font-bold mb-1 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> La Población
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                      Conjunto de individuos de los Glidons en el mismo lugar. Es dinámica, cambia con el tiempo y tiene una "media".
                      <br/><strong className="text-emerald-300">Rol en la evolución:</strong> La población es la que evoluciona. A medida que los menos aptos mueren y los más aptos dejan hijos, la población entera empieza a verse diferente tras muchas generaciones.
                    </p>
                    <p className="text-[9px] text-slate-500 italic border-l-2 border-slate-600 pl-2">
                      En Darwin: "La evolución es el cambio en las proporciones de rasgos dentro de una población."
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <h4 className="text-sm font-bold text-white">Presión de Selección</h4>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <strong className="text-blue-400">Frío:</strong> Perjudica a los pequeños. Favorece a los grandes.
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <strong className="text-orange-400">Calor:</strong> Perjudica a los grandes. Favorece a los pequeños.
                </p>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  <strong className="text-red-400">Peligros:</strong> Perjudican a los lentos. Solo los rápidos sobreviven.
                </p>
              </div>
            </div>
          </div>

          {/* Log */}
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-[10px] space-y-1">
            <div className="text-slate-500 mb-2 uppercase tracking-tighter">System Console</div>
            <div className="text-green-500/70"> {'>'} Darwin Engine Initialized...</div>
            <div className="text-slate-400"> {'>'} Waiting for user input...</div>
            {stats.history.length > 0 && (
              <div className="text-indigo-400"> {'>'} Generation {stats.generation} in progress...</div>
            )}
            {log.map((entry, i) => (
              <div key={i} className="text-slate-300">{entry}</div>
            ))}
            {stats.population === 0 && stats.generation > 0 && (
              <div className="text-red-500 animate-pulse"> {'>'} CRITICAL: Extinction event detected.</div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 mt-12">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">
            Inspirado en los principios de Charles Darwin • 1859
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Documentación</a>
            <a href="#" className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Algoritmo</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * SUB-COMPONENTS
 */

function StatItem({ label, value, icon }: { label: string, value: number | string, icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-indigo-500">{icon}</div>
      <div className="flex flex-col">
        <span className="text-[9px] text-slate-500 uppercase leading-none mb-0.5">{label}</span>
        <span className="text-xs font-bold text-white leading-none">{value}</span>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500 flex items-center gap-2">
          {icon} {title}
        </h3>
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="w-1 h-1 rounded-full bg-slate-700" />
          <div className="w-1 h-1 rounded-full bg-slate-700" />
        </div>
      </div>
      {children}
    </div>
  );
}

function MetricRow({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className={cn("w-1.5 h-1.5 rounded-full", color)} />
        <span className="text-xs text-slate-400 group-hover:text-white transition-colors">{label}</span>
      </div>
      <span className="text-xs font-mono font-bold text-white">{value}</span>
    </div>
  );
}

function GeneBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[8px] text-slate-500 uppercase">{label}</div>
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-500", color)} 
          style={{ width: `${value * 100}%` }} 
        />
      </div>
    </div>
  );
}

function ControlSlider({ label, value, onChange, min, max, step }: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void,
  min: number,
  max: number,
  step: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-mono font-bold text-indigo-400">{value}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  );
}
