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
}

interface Phenotype {
  size: number;      // Derived from sizeGene
  speed: number;     // Derived from speedGene
  senseRange: number; // Derived from senseGene
  color: string;
}

interface Creature {
  id: string;
  x: number;
  y: number;
  energy: number;
  genotype: Genotype;
  phenotype: Phenotype;
  angle: number;
  age: number;
}

interface Food {
  id: string;
  x: number;
  y: number;
}

interface SimStats {
  generation: number;
  population: number;
  avgSize: number;
  avgSpeed: number;
  avgSense: number;
  history: any[];
}

interface Environment {
  temperature: number; // -1 to 1 (Cold to Hot)
  hazards: number;     // 0 to 1
  foodAbundance: number;
}

/**
 * CONSTANTS
 */
const WIDTH = 800;
const HEIGHT = 600;
const INITIAL_POP = 10;
const FOOD_ENERGY = 50;
const REPRODUCTION_ENERGY = 150;
const ENERGY_LOSS_BASE = 0.1;
const MUTATION_RATE = 0.1;

/**
 * MAIN COMPONENT
 */
export default function App() {
  // State
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [food, setFood] = useState<Food[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null);
  const [stats, setStats] = useState<SimStats>({
    generation: 0,
    population: 0,
    avgSize: 0,
    avgSpeed: 0,
    avgSense: 0,
    history: []
  });
  
  // Refs for simulation loop to avoid React state lag
  const creaturesRef = useRef<Creature[]>([]);
  const foodRef = useRef<Food[]>([]);
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Settings
  const [foodSpawnRate, setFoodSpawnRate] = useState(2);
  const [mutationStrength, setMutationStrength] = useState(0.2);
  const [simSpeed, setSimSpeed] = useState(1);
  const [env, setEnv] = useState<Environment>({
    temperature: 0,
    hazards: 0.2,
    foodAbundance: 2
  });

  /**
   * GENETICS HELPERS
   */
  const expressPhenotype = (genotype: Genotype): Phenotype => {
    return {
      size: 6 + genotype.sizeGene * 14,          // 6 to 20
      speed: 1.0 + genotype.speedGene * 4.0,     // 1.0 to 5.0
      senseRange: 40 + genotype.senseGene * 160, // 40 to 200
      color: `hsl(${genotype.colorHue}, 100%, 50%)` // More vivid colors
    };
  };

  const mutate = (genotype: Genotype): Genotype => {
    const m = mutationStrength * 0.5;
    return {
      sizeGene: Math.max(0, Math.min(1, genotype.sizeGene + (Math.random() - 0.5) * m)),
      speedGene: Math.max(0, Math.min(1, genotype.speedGene + (Math.random() - 0.5) * m)),
      senseGene: Math.max(0, Math.min(1, genotype.senseGene + (Math.random() - 0.5) * m)),
      colorHue: (genotype.colorHue + (Math.random() - 0.5) * 20 + 360) % 360
    };
  };

  /**
   * INITIALIZATION
   */
  const init = () => {
    const initialCreatures: Creature[] = Array.from({ length: INITIAL_POP }).map((_, i) => {
      const genotype = {
        sizeGene: Math.random(),
        speedGene: Math.random(),
        senseGene: Math.random(),
        colorHue: Math.random() * 360
      };
      return {
        id: `c-${Date.now()}-${i}`,
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        energy: 100,
        angle: Math.random() * Math.PI * 2,
        age: 0,
        genotype,
        phenotype: expressPhenotype(genotype)
      };
    });

    const initialFood: Food[] = Array.from({ length: 30 }).map((_, i) => ({
      id: `f-${Date.now()}-${i}`,
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT
    }));

    creaturesRef.current = initialCreatures;
    foodRef.current = initialFood;
    setCreatures(initialCreatures);
    setFood(initialFood);
    setStats({
      generation: 0,
      population: INITIAL_POP,
      avgSize: 10,
      avgSpeed: 2,
      avgSense: 100,
      history: []
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

    // 1. Spawn Food
    if (Math.random() < foodSpawnRate * 0.05) {
      currentFood.push({
        id: `f-${Date.now()}-${Math.random()}`,
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT
      });
    }

    // 2. Update Creatures
    const nextCreatures: Creature[] = [];
    
    currentCreatures.forEach(c => {
      // 1. BASE METABOLISM (Genotype expression)
      const baseCost = ENERGY_LOSS_BASE + 
                        (c.phenotype.size * 0.005) + 
                        (Math.pow(c.phenotype.speed, 2) * 0.01) + 
                        (c.phenotype.senseRange * 0.0005);
      
      // 2. ENVIRONMENTAL PRESSURES (The "Selection" part)
      // Temperature Pressure: 
      // - Cold (temp < 0) favors Large size (Bergmann's Rule)
      // - Hot (temp > 0) favors Small size
      const tempEffect = env.temperature > 0 
        ? (c.phenotype.size * 0.01 * env.temperature) // Heat stress for big ones
        : (Math.abs(env.temperature) * (20 - c.phenotype.size) * 0.01); // Cold stress for small ones

      // Hazard Pressure:
      // - High hazards favor Speed (evasion)
      const hazardEffect = env.hazards * (5 - c.phenotype.speed) * 0.05;

      const totalEnergyCost = (baseCost + tempEffect + hazardEffect) * dt;
      
      c.energy -= totalEnergyCost;
      c.age += 0.01 * dt;

      if (c.energy <= 0) {
        if (selectedCreature?.id === c.id) setSelectedCreature(null);
        return;
      }

      // Find nearest food
      let nearestFood: Food | null = null;
      let minDist = c.phenotype.senseRange;

      currentFood.forEach(f => {
        const d = Math.sqrt(Math.pow(c.x - f.x, 2) + Math.pow(c.y - f.y, 2));
        if (d < minDist) {
          minDist = d;
          nearestFood = f;
        }
      });

      // Movement logic
      if (nearestFood) {
        const targetAngle = Math.atan2(nearestFood.y - c.y, nearestFood.x - c.x);
        let angleDiff = targetAngle - c.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        c.angle += angleDiff * 0.1 * dt;

        // Eat food
        if (minDist < c.phenotype.size) {
          c.energy += FOOD_ENERGY;
          currentFood = currentFood.filter(f => f.id !== nearestFood!.id);
        }
      } else {
        c.angle += (Math.random() - 0.5) * 0.2 * dt;
      }

      // Move
      c.x += Math.cos(c.angle) * c.phenotype.speed * dt;
      c.y += Math.sin(c.angle) * c.phenotype.speed * dt;

      // Wrap around screen
      if (c.x < 0) c.x = WIDTH;
      if (c.x > WIDTH) c.x = 0;
      if (c.y < 0) c.y = HEIGHT;
      if (c.y > HEIGHT) c.y = 0;

      // Reproduction
      if (c.energy > REPRODUCTION_ENERGY && nextCreatures.length < 200) {
        c.energy /= 2;
        const childGenotype = mutate(c.genotype);
        const offspring: Creature = {
          id: `c-${Date.now()}-${Math.random()}`,
          x: c.x + (Math.random() - 0.5) * 20,
          y: c.y + (Math.random() - 0.5) * 20,
          energy: c.energy,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          genotype: childGenotype,
          phenotype: expressPhenotype(childGenotype)
        };
        nextCreatures.push(offspring);
      }

      nextCreatures.push(c);
    });

    creaturesRef.current = nextCreatures;
    foodRef.current = currentFood;

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
    ctx.fillStyle = '#0a0a0a';
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
    ctx.fillStyle = '#4ade80';
    foodRef.current.forEach(f => {
      ctx.beginPath();
      ctx.arc(f.x, f.y, 2, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.shadowBlur = 5;
      ctx.shadowColor = '#4ade80';
      ctx.fill();
      ctx.shadowBlur = 0;
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
        ctx.arc(0, 0, c.phenotype.size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body
      ctx.fillStyle = c.phenotype.color;
      ctx.beginPath();
      ctx.moveTo(c.phenotype.size, 0);
      ctx.lineTo(-c.phenotype.size / 2, -c.phenotype.size / 2);
      ctx.lineTo(-c.phenotype.size / 2, c.phenotype.size / 2);
      ctx.closePath();
      ctx.fill();

      // Energy ring
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, c.phenotype.size + 2, 0, (Math.PI * 2) * (c.energy / REPRODUCTION_ENERGY));
      ctx.stroke();

      // Sense range (very faint)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.arc(0, 0, c.phenotype.senseRange, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
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
          history: newHistory
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
        hazards: Math.max(0, Math.min(1, prev.hazards + (Math.random() - 0.5) * 0.4)),
        foodAbundance: Math.max(0.5, Math.min(5, prev.foodAbundance + (Math.random() - 0.5) * 1.5))
      }));
      
      setFoodSpawnRate(prev => Math.max(0.5, Math.min(5, prev + (Math.random() - 0.5) * 1.5)));
      setMutationStrength(prev => Math.max(0.05, Math.min(1, prev + (Math.random() - 0.5) * 0.3)));
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
                      Observa cómo la variabilidad genética y la lucha por los recursos moldean la evolución de una especie en tiempo real.
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
                  </div>
                  <div className="space-y-4">
                    <div className="text-[10px] uppercase font-bold text-slate-500">Fenotipo (Físico)</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.size.toFixed(1)} px</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.speed.toFixed(2)} m/s</div>
                    <div className="text-xs text-white font-mono">{selectedCreature.phenotype.senseRange.toFixed(0)} m</div>
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
              <BarChart3 className="w-3 h-3" /> Métricas Promedio
            </h3>
            
            <div className="space-y-4">
              <MetricRow label="Tamaño" value={stats.avgSize.toFixed(1)} color="bg-rose-500" />
              <MetricRow label="Velocidad" value={stats.avgSpeed.toFixed(2)} color="bg-blue-500" />
              <MetricRow label="Percepción" value={stats.avgSense.toFixed(0)} color="bg-yellow-500" />
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
                  label="Abundancia de Alimento" 
                  value={foodSpawnRate} 
                  onChange={setFoodSpawnRate} 
                  min={0.5} 
                  max={5} 
                  step={0.5}
                />
              </div>
              <ControlSlider 
                label="Temperatura (Frío ↔ Calor)" 
                value={env.temperature} 
                onChange={(v) => setEnv(prev => ({ ...prev, temperature: v }))} 
                min={-1} 
                max={1} 
                step={0.1}
              />
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
              <div className="p-2 bg-indigo-600 rounded-lg">
                <Info className="w-5 h-5 text-white" />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-white">Genotipo vs Fenotipo</h4>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    <strong className="text-indigo-400">Genotipo:</strong> El código interno (DNA). Aquí es donde ocurren las <span className="text-white">mutaciones</span> aleatorias.
                  </p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    <strong className="text-indigo-400">Fenotipo:</strong> La expresión física (tamaño, velocidad). La <span className="text-white">Selección Natural</span> actúa sobre el fenotipo: si el físico no es apto, los genes no se pasan.
                  </p>
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
