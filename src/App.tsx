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
  Activity,
  Clock
} from 'lucide-react';
import Timeline from './components/Timeline';
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
  const [systemLog, setSystemLog] = useState<string[]>(['Sistema listo para simulación física...']);

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' }), []);

  const addLog = (msg: string) => {
    setSystemLog(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 50));
  };

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
      generation: 1,
      population: { ...initialPop },
      frequencies: calculateFrequencies(initialPop),
    };
    setState({
      ...state,
      generations: [firstGen],
    });
    setSetupMode(false);
    setSurvivorsInput({ ...initialPop });
    addLog('Simulación iniciada. Generación 1 cargada.');
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
        Actúa como el motor lógico de "Evolución IA", una aplicación de simulación de selección natural.
        
        CONTEXTO:
        El usuario tiene una máquina física con tres módulos: 
        1. Criba (Tamaño)
        2. Viento (Peso)
        3. Magnético (Rasgo oculto)
        
        DATOS ACTUALES:
        Generación Anterior: ${JSON.stringify(prevGen.population)}
        Módulo Usado: ${moduleName || "No especificado"}
        Mutación: ${mutationInfo || "Ninguna"}
        Sobrevivientes: ${JSON.stringify(survivors)}
        Siguiente Generación (Reproducción x2): ${JSON.stringify(nextGenPop)}
        
        TUS TAREAS:
        1. Genera un análisis breve en "criollo" (español de Argentina) sobre por qué esa especie sobrevivió según el módulo usado.
        2. Si hay una mutación, explica su posible impacto adaptativo futuro.
        
        REQUISITO TÉCNICO:
        Responde ÚNICAMENTE con el texto del análisis para los alumnos. No incluyas JSON ni etiquetas adicionales, ya que tu respuesta se mostrará directamente en la interfaz.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: prompt,
      });

      return result.text || "Análisis no disponible.";
    } catch (err) {
      console.error(err);
      return "Error al conectar con el motor lógico.";
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

    addLog(`Procesando Generación ${lastGen.generation + 1}...`);
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

    addLog(`Generación ${newGen.generation} completada.`);
    setSurvivorsInput({ ...nextGenPop });
    setCurrentModule('');
    setCurrentMutation('');
  };

  const resetSimulation = () => {
    if (window.confirm('¿Estás seguro de que querés reiniciar la simulación?')) {
      setState({
        generations: [],
        currentColorOptions: INITIAL_COLORS,
      });
      setSetupMode(true);
      setSystemLog(['Sistema reiniciado.']);
    }
  };

  // Prepare data for charts
  const chartData = state.generations.map(gen => ({
    name: `G${gen.generation}`,
    ...gen.population
  }));

  const currentGen = state.generations[state.generations.length - 1];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-600 selection:text-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-6 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-xl">
            <Dna className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-600">Máquina de Darwin</h1>
            <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Simulador de Selección Natural v1.0</p>
          </div>
        </div>
        {!setupMode && (
          <button 
            onClick={resetSimulation}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all text-xs font-bold uppercase tracking-wider"
          >
            <RefreshCcw className="w-4 h-4" />
            Reiniciar
          </button>
        )}
      </header>

      <main className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls & Input */}
        <div className="lg:col-span-4 space-y-6">
          {setupMode ? (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus className="w-5 h-5 text-indigo-500" />
                <h2 className="text-sm uppercase font-bold tracking-widest text-slate-600">Población Inicial</h2>
              </div>
              
              <div className="space-y-4">
                {state.currentColorOptions.map((color, idx) => (
                  <div key={color} className="flex items-center gap-4 group">
                    <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="flex-1 font-medium text-slate-700">{color}</span>
                    <input 
                      type="number"
                      min="0"
                      value={initialPop[color] || 0}
                      onChange={(e) => setInitialPop({ ...initialPop, [color]: parseInt(e.target.value) || 0 })}
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center font-mono focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                    />
                    <button 
                      onClick={() => {
                        const newOptions = state.currentColorOptions.filter(c => c !== color);
                        const newPop = { ...initialPop };
                        delete newPop[color];
                        setState({ ...state, currentColorOptions: newOptions });
                        setInitialPop(newPop);
                      }}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                
                <div className="pt-4">
                  <input 
                    id="new-color"
                    placeholder="+ Agregar nueva especie..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none italic transition-all"
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
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200 uppercase font-bold tracking-widest"
              >
                <Play className="w-5 h-5" />
                Iniciar Simulación
              </button>
            </section>
          ) : (
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Save className="w-5 h-5 text-indigo-500" />
                  <h2 className="text-sm uppercase font-bold tracking-widest text-slate-600">Reportar Supervivientes</h2>
                </div>
                <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full font-bold text-[10px] uppercase">GEN {currentGen.generation}</span>
              </div>

              <div className="space-y-4">
                {state.currentColorOptions.map((color, idx) => (
                  <div key={color} className="flex items-center gap-4">
                    <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="flex-1 font-medium text-slate-700">{color}</span>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="0"
                        max={currentGen.population[color]}
                        value={survivorsInput[color] || 0}
                        onChange={(e) => setSurvivorsInput({ ...survivorsInput, [color]: parseInt(e.target.value) || 0 })}
                        className="w-20 bg-slate-50 border border-slate-200 rounded-lg p-2 text-center font-mono focus:ring-2 focus:ring-indigo-400 outline-none transition-all"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">/ {currentGen.population[color]}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Módulo de Selección</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Criba', 'Viento', 'Magnético'].map(m => (
                    <button 
                      key={m}
                      onClick={() => setCurrentModule(m)}
                      className={cn(
                        "py-2 text-[10px] font-bold rounded-lg border transition-all",
                        currentModule === m ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:border-indigo-400"
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input 
                  placeholder="Otro módulo..."
                  value={currentModule}
                  onChange={(e) => setCurrentModule(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none italic transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Mutación Aleatoria</label>
                <input 
                  placeholder="Ej: Mayor peso en azules..."
                  value={currentMutation}
                  onChange={(e) => setCurrentMutation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none italic transition-all"
                />
              </div>

              <button 
                onClick={nextGeneration}
                disabled={isAnalyzing}
                className={cn(
                  "w-full py-4 bg-indigo-600 text-white rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200 uppercase font-bold tracking-widest",
                  isAnalyzing && "opacity-50 cursor-not-allowed"
                )}
              >
                {isAnalyzing ? <Activity className="w-5 h-5 animate-pulse" /> : <ChevronRight className="w-5 h-5" />}
                {isAnalyzing ? "Procesando..." : "Simular Reproducción"}
              </button>
            </section>
          )}

          {/* System Log */}
          <section className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800">
            <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h2 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">System Log</h2>
            </div>
            <div className="h-40 overflow-y-auto space-y-2 font-mono text-[10px]">
              {systemLog.map((log, i) => (
                <p key={i} className={cn(i === 0 ? "text-indigo-300" : "text-slate-500")}>
                  <span className="opacity-50 mr-2">{'>'}</span>
                  {log}
                </p>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Analysis & Charts */}
        <div className="lg:col-span-8 space-y-6">
          {!setupMode && (
            <>
              {/* Analysis Card */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <TrendingUp className="w-32 h-32 text-indigo-600" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Info className="w-5 h-5" />
                    <h2 className="text-xs uppercase font-bold tracking-widest">Análisis Evolutivo</h2>
                  </div>
                  <div className="text-slate-700 text-lg leading-relaxed font-medium">
                    {currentGen.analysis || "Sistema listo. Esperando el primer evento de selección física para analizar la adaptación de las especies."}
                  </div>
                </div>
              </section>

              {/* Timeline Section */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <div className="flex items-center gap-2 text-indigo-600 mb-6">
                  <Clock className="w-5 h-5" />
                  <h2 className="text-xs uppercase font-bold tracking-widest">Línea de Tiempo Evolutiva</h2>
                </div>
                <Timeline generations={state.generations} />
              </section>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-6">Tendencia Poblacional</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc', fontSize: '10px' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                        {state.currentColorOptions.map((color, idx) => (
                          <Line 
                            key={color} 
                            type="monotone" 
                            dataKey={color} 
                            stroke={COLORS[idx % COLORS.length]} 
                            strokeWidth={3}
                            dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-6">Dominio del Ecosistema (%)</h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Object.entries(currentGen.frequencies).map(([name, value]) => ({ name, value }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} unit="%" />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc', fontSize: '10px' }}
                        />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
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
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200">
                  <h3 className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Registro de Generaciones</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="p-4 text-[10px] uppercase font-bold text-slate-400">Gen</th>
                        <th className="p-4 text-[10px] uppercase font-bold text-slate-400">Módulo / Mutación</th>
                        <th className="p-4 text-[10px] uppercase font-bold text-slate-400">Población</th>
                        <th className="p-4 text-[10px] uppercase font-bold text-slate-400">Dominio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.generations.slice().reverse().map((gen) => (
                        <tr key={gen.generation} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-bold text-indigo-600">#{gen.generation}</td>
                          <td className="p-4">
                            <div className="text-xs font-semibold text-slate-700">{gen.module || "Inicio"}</div>
                            {gen.mutation && <div className="text-[9px] text-purple-500 font-bold mt-1 uppercase tracking-tighter">Mutación: {gen.mutation}</div>}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {(Object.entries(gen.population) as [string, number][]).map(([color, count]) => (
                                <span key={color} className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                                  {color}: {count}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-2">
                              {(Object.entries(gen.frequencies) as [string, number][]).map(([color, freq]) => (
                                <span key={color} className="text-[9px] font-bold text-slate-400">
                                  {color}: {freq.toFixed(0)}%
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

      {/* Footer */}
      <footer className="mt-12 border-t border-slate-200 p-12 text-center bg-white">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex justify-center gap-4 opacity-20">
            <Dna className="w-6 h-6" />
            <Activity className="w-6 h-6" />
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-xs leading-relaxed text-slate-400 italic font-medium">
            "La selección natural actúa solamente mediante la conservación y acumulación de pequeñas modificaciones heredadas."
          </p>
        </div>
      </footer>
    </div>
  );
}
