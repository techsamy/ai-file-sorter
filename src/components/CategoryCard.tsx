import React from 'react';
import { CardState, ScannedItem } from '../types';
import { Folder, Copy, Film, Image as ImageIcon, FileText } from 'lucide-react';

interface CategoryCardProps {
  card: CardState;
  itemsMap: Map<string, ScannedItem>;
  onClick: () => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ card, itemsMap, onClick }) => {
  const isDupe = card.section === 'dupes';
  const isVideo = card.section === 'videos';
  const isPhoto = card.section === 'photos';

  const getIcon = () => {
    if (isDupe) return <Copy className="w-4 h-4 text-rose-400" />;
    if (isVideo) return <Film className="w-4 h-4 text-pink-400" />;
    if (isPhoto) return <ImageIcon className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  const isFlashing = card.flash && performance.now() - card.flash < 600;

  return (
    <div
      data-card={card.key}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border p-3 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/40 ${
        isFlashing
          ? 'border-brand-400 bg-brand-950/40 ring-1 ring-brand-400'
          : 'border-surface-border bg-surface-card/70 hover:border-zinc-600 hover:bg-surface-hover'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="p-1.5 rounded-lg border border-surface-border/80 flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${card.color}15` }}
          >
            {getIcon()}
          </div>
          <span className="text-xs sm:text-sm font-semibold text-zinc-200 truncate">
            {card.label}
          </span>
        </div>

        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 border"
          style={{
            backgroundColor: `${card.color}20`,
            color: card.color,
            borderColor: `${card.color}40`,
          }}
        >
          {card.landed ? card.landed.length : 0}
        </span>
      </div>

      {/* Preview Slots Strip */}
      <div className="grid grid-cols-6 gap-1.5 pt-1">
        {card.slots.map((itemId, idx) => {
          const item = itemId ? itemsMap.get(itemId) : null;
          return (
            <div
              key={idx}
              data-slot={idx}
              className={`aspect-square rounded-md overflow-hidden border flex items-center justify-center relative transition-all duration-200 ${
                item
                  ? 'border-surface-border/80 bg-zinc-900'
                  : 'border-dashed border-zinc-800 bg-zinc-950/40'
              }`}
            >
              {item ? (
                item.thumbUrl ? (
                  <img
                    src={item.thumbUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: card.color }}
                  >
                    {item.ext.slice(0, 3)}
                  </div>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

