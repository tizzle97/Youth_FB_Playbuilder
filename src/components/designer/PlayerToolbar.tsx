import React from 'react';

interface PlayerIconProps {
  letter: string;
  color: string;
  isSquare?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

const PlayerIcon: React.FC<PlayerIconProps> = ({ letter, color, isSquare, isSelected, onClick, onDragStart }) => {
  const buttonClasses = `p-2 rounded-md transition-colors ${
    isSelected ? 'bg-primary/20' : 'hover:bg-board-light'
  }`;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ letter, color, isSquare }));
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.className = 'fixed top-0 left-0 -translate-x-full';
    dragImage.style.width = '36px';
    dragImage.style.height = '36px';
    dragImage.style.backgroundColor = color;
    dragImage.style.borderRadius = isSquare ? '0' : '50%';
    dragImage.style.display = 'flex';
    dragImage.style.alignItems = 'center';
    dragImage.style.justifyContent = 'center';
    dragImage.style.color = '#FFFFFF';
    dragImage.style.fontWeight = 'bold';
    dragImage.style.fontSize = '24px';
    dragImage.style.fontFamily = 'Inter, sans-serif';
    dragImage.textContent = letter;
    
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 18, 18);
    
    // Clean up the drag image after it's no longer needed
    setTimeout(() => document.body.removeChild(dragImage), 0);
    
    onDragStart?.(e);
  };

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      className={buttonClasses}
      title={`Player ${letter}`}
    >
      <div
        className={`w-8 h-8 ${!isSquare ? 'rounded-full' : ''} flex items-center justify-center text-white font-bold cursor-move ${letter.length > 1 ? 'text-[10px]' : ''}`}
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>
    </button>
  );
};

export const players = [
  { letter: 'Q', color: '#3B82F6' }, // Blue
  { letter: 'R', color: '#10B981' }, // Green
  { letter: 'A', color: '#F59E0B' }, // Yellow
  { letter: 'B', color: '#EF4444' }, // Red
  { letter: 'C', color: '#000000', isSquare: true }, // Black
  { letter: 'X', color: '#8B5CF6' }, // Purple
  { letter: 'Y', color: '#EC4899' }, // Pink
  { letter: 'Z', color: '#6366F1' }, // Indigo
];

// Defensive roster: Defensive Line, Linebacker, Cornerback, Safety.
// "CB" (not "C") since "C" is already the offensive Center above.
export const defensivePlayers = [
  { letter: 'D', color: '#F97316' },  // Orange
  { letter: 'LB', color: '#14B8A6' }, // Teal
  { letter: 'CB', color: '#84CC16' }, // Lime
  { letter: 'S', color: '#E11D48' },  // Rose
];

interface PlayerToolbarProps {
  selectedPlayer: string | null;
  onSelectPlayer: (player: { letter: string; color: string; isSquare?: boolean } | null) => void;
  roster?: typeof players;
}

export function PlayerToolbar({ selectedPlayer, onSelectPlayer, roster = players }: PlayerToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <div className="h-6 w-px bg-chalk/10 mx-1"></div>
      {roster.map((player) => (
        <PlayerIcon
          key={player.letter}
          letter={player.letter}
          color={player.color}
          isSquare={player.isSquare}
          isSelected={selectedPlayer === player.letter}
          onClick={() => {
            try {
              if (selectedPlayer === player.letter) {
                onSelectPlayer(null);
              } else {
                onSelectPlayer({
                  letter: player.letter,
                  color: player.color,
                  isSquare: player.isSquare
                });
              }
            } catch (error) {
              console.error('Error in PlayerToolbar onClick:', error);
            }
          }}
        />
      ))}
    </div>
  );
}