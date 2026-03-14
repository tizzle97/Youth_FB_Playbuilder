import React from 'react';
import { Edit, Trash2, Plus, User } from 'lucide-react';
import { Play } from '../../types/play';

interface PlayCardProps {
  play: Play;
  onSelect?: (play: Play) => void;
  onEdit?: (play: Play) => void;
  onDelete?: (play: Play) => void;
  onAddToPlaybook?: (play: Play) => void;
  showActions?: boolean;
  isOwner?: boolean;
  currentUser?: any;
}

export function PlayCard({ 
  play, 
  onSelect, 
  onEdit, 
  onDelete, 
  onAddToPlaybook,
  showActions = true, 
  isOwner = false,
  currentUser 
}: PlayCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'text-green-500 bg-green-500/10';
      case 'intermediate': return 'text-yellow-500 bg-yellow-500/10';
      case 'advanced': return 'text-red-500 bg-red-500/10';
      default: return 'text-chalk/70 bg-chalk/10';
    }
  };

  const getPlayTypeIcon = (playType: string) => {
    switch (playType) {
      case 'pass': return '🏈';
      case 'run': return '🏃';
      case 'option': return '🔄';
      case 'reverse': return '↩️';
      case 'screen': return '🛡️';
      case 'trick': return '🎩';
      default: return '🏈';
    }
  };

  return (
    <div className="bg-board rounded-lg border border-chalk/10 overflow-hidden hover:border-primary/30 transition-colors group">
      {/* Thumbnail */}
      <div 
        className="aspect-video bg-white cursor-pointer relative"
        onClick={() => onSelect?.(play)}
      >
        {play.thumbnail ? (
          <img
            src={play.thumbnail}
            alt={play.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-chalk/30">
            No Preview
          </div>
        )}
        
        {/* Overlay with action buttons */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(play);
            }}
            className="px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            View Play
          </button>
          
          {!isOwner && currentUser && onAddToPlaybook && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToPlaybook(play);
              }}
              className="px-3 py-2 bg-secondary text-white rounded-lg text-sm font-medium hover:bg-secondary-dark transition-colors flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Playbook</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-chalk group-hover:text-primary transition-colors line-clamp-1">
            {play.name}
          </h3>
          {showActions && isOwner && (
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  onClick={() => onEdit(play)}
                  className="p-1 text-chalk/70 hover:text-primary transition-colors"
                  title="Edit Play"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(play)}
                  className="p-1 text-chalk/70 hover:text-red-500 transition-colors"
                  title="Delete Play"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Creator info for public plays */}
        {!isOwner && play.profiles && (
          <div className="flex items-center space-x-2 mb-3 text-sm text-chalk/70">
            <User className="w-4 h-4" />
            <span>by {play.profiles.username || 'Anonymous'}</span>
          </div>
        )}

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="inline-flex items-center px-2 py-1 bg-primary/20 text-primary text-xs rounded-md">
            {play.metadata.gameType}
          </span>
          <span className="inline-flex items-center px-2 py-1 bg-secondary/20 text-secondary text-xs rounded-md">
            {getPlayTypeIcon(play.metadata.playType)} {play.metadata.playType}
          </span>
          <span className={`inline-flex items-center px-2 py-1 text-xs rounded-md ${getDifficultyColor(play.metadata.difficulty)}`}>
            {play.metadata.difficulty}
          </span>
        </div>

        {/* Formation and description */}
        {play.metadata.formation && (
          <p className="text-sm text-chalk/70 mb-2">
            <strong>Formation:</strong> {play.metadata.formation}
          </p>
        )}
        
        {play.metadata.description && (
          <p className="text-sm text-chalk/70 line-clamp-2 mb-3">
            {play.metadata.description}
          </p>
        )}

        {/* Tags */}
        {play.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {play.metadata.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block px-2 py-1 bg-chalk/10 text-chalk/70 text-xs rounded"
              >
                #{tag}
              </span>
            ))}
            {play.metadata.tags.length > 3 && (
              <span className="inline-block px-2 py-1 bg-chalk/10 text-chalk/70 text-xs rounded">
                +{play.metadata.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}