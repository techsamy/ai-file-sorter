import React from 'react';
import { CardState } from '../types';
import { X, ExternalLink, HardDrive } from 'lucide-react';

interface FileDetailsModalProps {
  card: CardState | null;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const FileDetailsModal: React.FC<FileDetailsModalProps> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface-card border border-surface-border rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border bg-surface/50">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: card.color }}
              />
              <h3 className="text-lg font-bold text-zinc-100">{card.label}</h3>
              <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-mono">
                {card.items.length} files
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 font-mono">
              <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
              Destination: Sorted/{card.dest.join('/')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal File List */}
        <div className="p-5 overflow-y-auto space-y-2.5 divide-y divide-surface-border/40">
          {card.items.map((item) => (
            <div
              key={item.id}
              className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.name}
                    className="w-11 h-11 rounded-lg object-cover border border-surface-border/80 shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-lg border border-surface-border/80 flex items-center justify-center shrink-0 font-bold text-xs"
                    style={{ backgroundColor: `${card.color}15`, color: card.color }}
                  >
                    {item.ext.toUpperCase().slice(0, 4)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-zinc-200 truncate group-hover:text-brand-300 transition-colors">
                    {item.name}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center gap-2">
                    <span>{formatBytes(item.size)}</span>
                    {item.confidence && (
                      <span className="text-[10px] bg-brand-950 text-brand-300 border border-brand-800/60 px-1.5 py-0.2 rounded font-mono">
                        AI {(item.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {item.isDuplicate && (
                      <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded">
                        Duplicate
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {item.thumbUrl && (
                <a
                  href={item.thumbUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-zinc-200 transition-opacity"
                  title="View full size"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

