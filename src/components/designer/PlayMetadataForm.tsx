import React from 'react';
import { PlayMetadata } from '../../types/play';

interface PlayMetadataFormProps {
  metadata: PlayMetadata;
  onChange: (metadata: PlayMetadata) => void;
}

export function PlayMetadataForm({ metadata, onChange }: PlayMetadataFormProps) {
  const handleChange = (field: keyof PlayMetadata, value: any) => {
    onChange({
      ...metadata,
      [field]: value
    });
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !metadata.tags.includes(tag.trim())) {
      handleChange('tags', [...metadata.tags, tag.trim()]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleChange('tags', metadata.tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-chalk mb-2">
            Game Type
          </label>
          <select
            value={metadata.gameType}
            onChange={(e) => handleChange('gameType', e.target.value)}
            className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="5v5">5v5 Flag Football</option>
            <option value="6v6">6v6 Flag Football</option>
            <option value="7v7">7v7 Flag Football</option>
            <option value="11v11">11v11 Traditional</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-chalk mb-2">
            Play Type
          </label>
          <select
            value={metadata.playType}
            onChange={(e) => handleChange('playType', e.target.value)}
            className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="pass">Pass</option>
            <option value="run">Run</option>
            <option value="option">Option</option>
            <option value="reverse">Reverse</option>
            <option value="screen">Screen</option>
            <option value="trick">Trick Play</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-chalk mb-2">
            Formation
          </label>
          <input
            type="text"
            value={metadata.formation}
            onChange={(e) => handleChange('formation', e.target.value)}
            placeholder="e.g., I-Formation, Spread, etc."
            className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-chalk mb-2">
            Difficulty
          </label>
          <select
            value={metadata.difficulty}
            onChange={(e) => handleChange('difficulty', e.target.value)}
            className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-chalk mb-2">
          Tags
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {metadata.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-1 bg-primary/20 text-primary text-sm rounded-md"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-1 text-primary/70 hover:text-primary"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Add tags (press Enter)"
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(e.currentTarget.value);
              e.currentTarget.value = '';
            }
          }}
          className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-chalk mb-2">
          Description
        </label>
        <textarea
          value={metadata.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Describe the play strategy, timing, and execution..."
          rows={3}
          className="w-full px-3 py-2 bg-board border border-chalk/20 rounded-lg text-chalk focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        />
      </div>
    </div>
  );
}