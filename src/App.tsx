/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { 
  Dna, 
  Plus, 
  Trash2, 
  Play, 
  RefreshCcw, 
  TrendingUp, 
  Info, 
  ChevronRight,
  Save,
  Activity
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Population, GenerationData, SimulationState } from './types';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = [
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

const INITIAL_COLORS = ['Rojo (grande)', 'Verde (mediana)', 'Azul (pequeña)'];

export default function App() {
  const [state, setState] = useState<SimulationState>({
    generations: [],
    currentColorOptions: INITIAL_COLORS,
  });
  
  const [setupMode, setSetupMode] = useState(true);
  const [initialPop, setInitialPop] = useState<Population>({
    'Rojo (grande)': 10,
    'Verde (mediana)': 10,
    'Azul (pequeña)': 10,
  });
  
  const [survivorsInput, setSurvivorsInput] = useState<Population>({});
  const [currentModule, setCurrentModule] = useState('');
  const [currentMutation, setCurrentMutation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }), []);

  // Calculate allele frequencies for a population
  const calculateFrequencies = (pop: Population) => {
    const total = Object.values(pop).reduce((a, b) => a + b, 0);
    const freqs: { [color: string]: number } = {};
    if (total === 0) return freqs;
    Object.keys(pop).forEach(color => {
      freqs[color] = (pop[color] / total) * 100;
    });
    return freqs;
  };

  const startSimulation = () => {
    const firstGen: GenerationData = {
      generation: 0,
      population: { ...initialPop },
      frequencies: calculateFrequencies(initialPop),
    };
    setState({
      ...state,
      generations: [firstGen],
    });
    setSetupMode(false);
    // Initialize survivors input with current population
    setSurvivorsInput({ ...initialPop });
  };

  const analyzeGeneration = async (
    prevGen: GenerationData, 
    survivors: Population, 
    nextGenPop: Population,
    moduleName: string,
    mutationInfo: string
  ) => {
    setIsAnalyzing(true);
    try {
      const prompt = `
        Actúa como un Bio-Estadístico experto en Simulación Evolutiva.
        Analiza los datos de la "Máquina de Darwin".
        
        Generación Anterior: ${JSON.stringify(prevGen.population)}
        Módulo de Presión Ambiental: ${moduleName || "No especificado"}
        Mutación Detectada: ${mutationInfo || "Ninguna"}
        Sobrevivientes: ${JSON.stringify(survivors)}
        Siguiente Generación (Reproducción Diferencial x2): ${JSON.stringify(nextGenPop)}
        
        REGLAS:
        1. Explica qué presión ambiental pudo haber causado los cambios observados.
        2. Identifica qué especie está dominando el ecosistema y por qué.
        3. Si hay una mutación, explica su posible impacto adaptativo futuro.
        4. Usa un tono científico pero accesible (criollo argento).
        5. Sé breve y directo.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      return result.text || "Análisis no disponible.";
    } catch (err) {
      console.error(err);
      return "Error al conectar con el Bio-Estadístico.";
    } finally {
      setIsAnalyzing(false);
    }
  };

  const nextGeneration = async () => {
    const lastGen = state.generations[state.generations.length - 1];
    
    // Reproduction: survivors * 2
    const nextGenPop: Population = {};
    Object.keys(survivorsInput).forEach(color => {
      nextGenPop[color] = (survivorsInput[color] || 0) * 2;
    });

    const analysis = await analyzeGeneration(lastGen, survivorsInput, nextGenPop, currentModule, currentMutation);

    const newGen: GenerationData = {
      generation: lastGen.generation + 1,
      population: nextGenPop,
      survivors: { ...survivorsInput },
      module: currentModule,
      mutation: currentMutation,
      analysis,
      frequencies: calculateFrequencies(nextGenPop),
    };

    setState(prev => ({
      ...prev,
      generations: [...prev.generations, newGen],
    }));

    // Reset inputs for next round
    setSurvivorsInput({ ...nextGenPop });
    setCurrentModule('');
    setCurrentMutation('');
  };

  const resetSimulation = () => {
    if (window.confirm('¿Estás seguro de que querés reiniciar la simulación? Se perderán todos los datos.')) {
      setState({
        generations: [],
        currentColorOptions: INITIAL_COLORS,
      });
      setSetupMode(true);
    }
  };

  // Prepare data for charts
  const chartData = state.generations.map(gen => ({
    name: `G${gen.generation}`,
    ...gen.population
  }));

  const currentGen = state.generations[state.generations.length - 1];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Dna className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tighter uppercase italic font-serif">Máquina de Darwin</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50">Simulador de Selección Natural v1.0</p>
          </div>
        </div>
        {!setupMode && (
          <button 
            onClick={resetSimulation}
            className="flex items-center gap-2 px-4 py-2 border border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors text-xs uppercase font-bold tracking-widest"
          >
            <RefreshCcw className="w-4 h-4" />
            Reiniciar
          </button>
        )}
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Input */}
        <div className="lg:col-span-4 space-y-8">
          {setupMode ? (
            <section className="bg-white/50 border border-[#141414] p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-[#141414] pb-2">
                <Plus className="w-4 h-4" />
                <h2 className="text-xs uppercase font-bold tracking-widest">Población Inicial</h2>
              </div>
              
              <div className="space-y-4">
                {state.currentColorOptions.map((color, idx) => (
                  <div key={color} className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="flex-1 font-mono text-sm">{color}</span>
                    <input 
                      type="number"
                      min="0"
                      value={initialPop[color] || 0}
                      onChange={(e) => setInitialPop({ ...initialPop, [color]: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-transparent border-b border-[#141414] text-right font-mono focus:outline-none"
                    />
                    <button 
                      onClick={() => {
                        const newOptions = state.currentColorOptions.filter(c => c !== color);
                        const newPop = { ...initialPop };
                        delete newPop[color];
                        setState({ ...state, currentColorOptions: newOptions });
                        setInitialPop(newPop);
                      }}
                      className="opacity-30 hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <div className="pt-4 flex gap-2">
                  <input 
                    id="new-color"
                    placeholder="Nueva especie/color..."
                    className="flex-1 bg-transparent border-b border-[#141414] text-sm focus:outline-none italic"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val && !state.currentColorOptions.includes(val)) {
                          setState({ ...state, currentColorOptions: [...state.currentColorOptions, val] });
                          setInitialPop({ ...initialPop, [val]: 10 });
                          (e.target as HTMLInputElement).value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>

              <button 
                onClick={startSimulation}
                className="w-full py-4 bg-[#141414] text-[#E4E3E0] flex items-center justify-center gap-3 hover:bg-[#333] transition-colors uppercase font-bold tracking-[0.2em]"
              >
                <Play className="w-5 h-5" />
                Iniciar Simulación
              </button>
            </section>
          ) : (
            <section className="bg-white/50 border border-[#141414] p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-[#141414] pb-2">
                <div className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  <h2 className="text-xs uppercase font-bold tracking-widest">Reportar Supervivientes</h2>
                </div>
                <span className="font-mono text-[10px] opacity-50">GEN {currentGen.generation}</span>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-[10px] uppercase opacity-50 font-bold">Especie</div>
                  <div className="text-[10px] uppercase opacity-50 font-bold text-right">Sobrevivieron</div>
                </div>
                {state.currentColorOptions.map((color, idx) => (
                  <div key={color} className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="flex-1 font-mono text-sm">{color}</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        max={currentGen.population[color]}
                        value={survivorsInput[color] || 0}
                        onChange={(e) => setSurvivorsInput({ ...survivorsInput, [color]: parseInt(e.target.value) || 0 })}
                        className="w-20 bg-transparent border-b border-[#141414] text-right font-mono focus:outline-none"
                      />
                      <span className="text-[10px] opacity-40 font-mono">/ {currentGen.population[color]}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Módulo / Presión Ambiental</label>
                <input 
                  placeholder="Ej: Criba por tamaño, Viento, Depredación..."
                  value={currentModule}
                  onChange={(e) => setCurrentModule(e.target.value)}
                  className="w-full bg-transparent border-b border-[#141414] py-2 text-sm focus:outline-none italic"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-50">Mutación Aleatoria (Opcional)</label>
                <input 
                  placeholder="Ej: Mutación en peso de azules..."
                  value={currentMutation}
                  onChange={(e) => setCurrentMutation(e.target.value)}
                  className="w-full bg-transparent border-b border-[#141414] py-2 text-sm focus:outline-none italic"
                />
              </div>

              <button 
                onClick={nextGeneration}
                disabled={isAnalyzing}
                className={cn(
                  "w-full py-4 bg-[#141414] text-[#E4E3E0] flex items-center justify-center gap-3 transition-all uppercase font-bold tracking-[0.2em]",
                  isAnalyzing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isAnalyzing ? <Activity className="w-5 h-5 animate-pulse" /> : <ChevronRight className="w-5 h-5" />}
                {isAnalyzing ? "Analizando..." : "Siguiente Generación"}
              </button>
            </section>
          )}

          {/* Stats Summary */}
          {!setupMode && currentGen && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/30 border border-[#141414] p-4">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Población Total</p>
                <p className="text-2xl font-serif italic">
                  {(Object.values(currentGen.population) as number[]).reduce((a, b) => a + b, 0)}
                </p>
              </div>
              <div className="bg-white/30 border border-[#141414] p-4">
                <p className="text-[10px] uppercase opacity-50 font-bold mb-1">Especies Activas</p>
                <p className="text-2xl font-serif italic">
                  {(Object.values(currentGen.population) as number[]).filter(v => v > 0).length}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Analysis & Charts */}
        <div className="lg:col-span-8 space-y-8">
          {setupMode ? (
            <div className="h-full flex flex-col items-center justify-center border border-[#141414] border-dashed p-12 text-center space-y-6">
              <div className="w-20 h-20 rounded-full border border-[#141414] flex items-center justify-center opacity-20">
                <TrendingUp className="w-10 h-10" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-serif italic mb-2">Esperando datos iniciales</h3>
                <p className="text-sm opacity-60 leading-relaxed">
                  Configurá la población de partida de tu ecosistema. Una vez que inicies, podrás reportar sobrevivientes después de cada evento de selección natural.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Analysis Card */}
              <section className="bg-[#141414] text-[#E4E3E0] p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Info className="w-24 h-24" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                    <Activity className="w-4 h-4" />
                    <h2 className="text-xs uppercase font-bold tracking-widest">Análisis del Bio-Estadístico</h2>
                  </div>
                  <div className="font-serif text-lg leading-relaxed italic">
                    {currentGen.analysis || "Iniciando simulación. Esperando el primer evento de selección para analizar las presiones adaptativas."}
                  </div>
                </div>
              </section>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Population Trend */}
                <div className="bg-white/50 border border-[#141414] p-6 space-y-4">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest opacity-50">Evolución de Población</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={false} />
                        <XAxis dataKey="name" stroke="#141414" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#141414" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontSize: '10px' }}
                          itemStyle={{ color: '#E4E3E0' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                        {state.currentColorOptions.map((color, idx) => (
                          <Line 
                            key={color} 
                            type="monotone" 
                            dataKey={color} 
                            stroke={COLORS[idx % COLORS.length]} 
                            strokeWidth={2}
                            dot={{ r: 3, fill: COLORS[idx % COLORS.length] }}
                            activeDot={{ r: 5 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Allele Frequency */}
                <div className="bg-white/50 border border-[#141414] p-6 space-y-4">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest opacity-50">Frecuencia Alélica (%)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(currentGen.frequencies).map(([name, value]) => ({ name, value }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ccc" vertical={false} />
                        <XAxis dataKey="name" stroke="#141414" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#141414" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                        <Tooltip 
                          cursor={{ fill: 'rgba(20,20,20,0.05)' }}
                          contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontSize: '10px' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {Object.entries(currentGen.frequencies).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[state.currentColorOptions.indexOf(entry[0]) % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <section className="bg-white/50 border border-[#141414] overflow-hidden">
                <div className="p-4 border-b border-[#141414] bg-[#141414] text-[#E4E3E0]">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest">Registro Histórico</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#141414]">
                        <th className="p-4 text-[10px] uppercase font-bold opacity-50">Gen</th>
                        <th className="p-4 text-[10px] uppercase font-bold opacity-50">Módulo / Mutación</th>
                        <th className="p-4 text-[10px] uppercase font-bold opacity-50">Población</th>
                        <th className="p-4 text-[10px] uppercase font-bold opacity-50">Frecuencias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.generations.slice().reverse().map((gen) => (
                        <tr key={gen.generation} className="border-b border-[#141414] hover:bg-white/40 transition-colors">
                          <td className="p-4 font-mono text-xs">#{gen.generation}</td>
                          <td className="p-4 text-xs italic">
                            <div>{gen.module || "Inicio"}</div>
                            {gen.mutation && <div className="text-[9px] text-purple-600 font-bold mt-1">MUT: {gen.mutation}</div>}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {(Object.entries(gen.population) as [string, number][]).map(([color, count]) => (
                                <span key={color} className="text-[10px] font-mono bg-white/50 px-2 py-1 border border-[#141414]/10">
                                  {color}: {count}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {(Object.entries(gen.frequencies) as [string, number][]).map(([color, freq]) => (
                                <span key={color} className="text-[10px] font-mono opacity-60">
                                  {color}: {freq.toFixed(1)}%
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* Footer / Info */}
      <footer className="mt-12 border-t border-[#141414] p-8 text-center bg-white/20">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-40">Enfoque STEAM - Biología Evolutiva</p>
          <p className="text-xs leading-relaxed opacity-60 italic">
            "No es la más fuerte de las especies la que sobrevive, ni la más inteligente, sino la que mejor responde al cambio." — Charles Darwin
          </p>
        </div>
      </footer>
    </div>
  );
}
