import React from 'react';
import { FileText } from 'lucide-react';

interface PlayDetailsFormProps {
  playName: string;
  setPlayName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  playType: 'offense' | 'defense';
  setPlayType: (type: 'offense' | 'defense') => void;
}

export function PlayDetailsForm({
  playName,
  setPlayName,
  description,
  setDescription,
  playType,
  setPlayType
}: PlayDetailsFormProps) {
  return (
    <div className="bg-board rounded-lg border border-chalk/10 p-4">
      <h2 className="text-lg font-semibold text-chalk flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        Play Details
      </h2>

      <div className="space-y-4">
        <div>
          <label htmlFor="play-name" className="block text-sm font-medium text-chalk mb-1">
            Play Name
          </label>
          <input
            type="text"
            id="play-name"
            value={playName}
            onChange={(e) => setPlayName(e.target.value)}
            className="w-full px-3 py-2 bg-board-light border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter play name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-chalk mb-1">
            Play Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['offense', 'defense'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setPlayType(type)}
                className={`px-3 py-2 text-sm rounded-md capitalize ${
                  playType === type
                    ? 'bg-primary text-white'
                    : 'bg-board-light text-chalk/70 hover:text-chalk border border-chalk/20'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-chalk mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-board-light border border-chalk/20 rounded-md text-chalk placeholder-chalk/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Describe the play and its execution..."
          />
        </div>
      </div>
    </div>
  );
}