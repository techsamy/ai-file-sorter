import React from 'react';

interface StatsBarProps {
  looseFiles: number;
  photos: number;
  foldersCreated: number;
  duplicatesFound: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  looseFiles,
  photos,
  foldersCreated,
  duplicatesFound,
}) => {
  const stats = [
    { label: 'Loose files', value: looseFiles, dotColor: '#3b82f6' },
    { label: 'Photos & Videos', value: photos, dotColor: '#8b5cf6' },
    { label: 'Folders to create', value: foldersCreated, dotColor: '#10b981' },
    { label: 'Duplicates detected', value: duplicatesFound, dotColor: '#f43f5e' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 py-3 px-4 bg-surface-card/60 backdrop-blur-md border border-surface-border rounded-2xl max-w-4xl mx-auto shadow-lg shadow-black/20">
      {stats.map((s, idx) => (
        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/80 border border-surface-border/50 text-xs sm:text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block animate-pulse"
            style={{ backgroundColor: s.dotColor }}
          />
          <span className="text-zinc-400 font-medium">{s.label}:</span>
          <span className="text-zinc-100 font-bold tracking-tight">{s.value}</span>
        </div>
      ))}
    </div>
  );
};

