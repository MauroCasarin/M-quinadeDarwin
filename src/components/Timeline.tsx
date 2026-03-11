import React from 'react';
import { GenerationData } from '../types';
import { Zap, Clock } from 'lucide-react';

export default function Timeline({ generations }: { generations: GenerationData[] }) {
  return (
    <div className="space-y-6">
      {generations.slice().reverse().map((gen) => (
        <div key={gen.generation} className="relative pl-8 pb-6 border-l-2 border-indigo-200 last:border-0 last:pb-0">
          <div className="absolute -left-[9px] top-0 w-4 h-4 bg-indigo-600 rounded-full border-4 border-white shadow-sm" />
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-indigo-600 text-sm">Generación #{gen.generation}</h4>
              {gen.module && (
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md uppercase">
                  {gen.module}
                </span>
              )}
            </div>
            
            <div className="text-xs text-slate-600 mb-3">
              Población total: {Object.values(gen.population).reduce((a, b) => a + b, 0)}
            </div>

            {gen.mutation && (
              <div className="flex items-center gap-2 text-[10px] text-purple-600 font-bold uppercase bg-purple-50 p-2 rounded-lg">
                <Zap className="w-3 h-3" />
                Mutación: {gen.mutation}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
