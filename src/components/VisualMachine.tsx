import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Population, SpeciesTraits } from '../types';

interface VisualMachineProps {
  population: Population;
  module: string;
  onSimulationComplete: () => void;
}

interface Token {
  id: number;
  color: string;
  traits: SpeciesTraits;
}

export default function VisualMachine({ population, module, onSimulationComplete }: VisualMachineProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    // Expand population into individual tokens
    const newTokens: Token[] = [];
    Object.entries(population).forEach(([color, species], idx) => {
      for (let i = 0; i < species.count; i++) {
        newTokens.push({
          id: idx * 1000 + i,
          color: color,
          traits: species.traits,
        });
      }
    });
    setTokens(newTokens);
  }, [population]);

  const runSimulation = async () => {
    setIsSimulating(true);
    // Simulate movement based on module
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsSimulating(false);
    onSimulationComplete();
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">Máquina Visual: {module}</h2>
        <button 
          onClick={runSimulation}
          disabled={isSimulating || tokens.length === 0}
          className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSimulating ? 'Simulando...' : 'Ver Física'}
        </button>
      </div>
      
      <div className="relative h-64 bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
        <AnimatePresence>
          {tokens.map((token, i) => (
            <motion.div
              key={token.id}
              className="absolute w-4 h-4 rounded-full"
              style={{ backgroundColor: token.color === 'Rojo (grande)' ? '#ef4444' : token.color === 'Verde (mediana)' ? '#22c55e' : '#3b82f6' }}
              initial={{ x: Math.random() * 200, y: -20 }}
              animate={isSimulating ? {
                x: module === 'Viento' ? (token.traits.weight < 5 ? 300 : 50) : Math.random() * 200,
                y: module === 'Criba' ? (token.traits.size > 5 ? 200 : 50) : Math.random() * 200,
                opacity: module === 'Magnético' && token.traits.magneticSusceptibility > 5 ? 1 : 0.5,
              } : { x: Math.random() * 200, y: Math.random() * 200 }}
              transition={{ duration: 1.5 }}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
