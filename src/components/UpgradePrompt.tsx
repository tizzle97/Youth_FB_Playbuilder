import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, X } from 'lucide-react';

interface UpgradePromptProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  description: string;
}

/** Preventive Pro gate shown when a free user tries a Pro-only export. */
export function UpgradePrompt({ isOpen, onClose, feature, description }: UpgradePromptProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 text-center">
        <div className="fixed inset-0 bg-black bg-opacity-75" onClick={onClose} />
        <div className="inline-block w-full max-w-sm overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl border border-primary/40">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary shrink-0" />
              <h3 className="text-lg font-bold text-chalk">{feature} is a Pro feature</h3>
            </div>
            <button onClick={onClose} className="text-chalk/70 hover:text-chalk transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <p className="text-sm text-chalk/70">{description}</p>
          </div>
          <div className="px-6 py-4 border-t border-chalk/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
            >
              Maybe later
            </button>
            <button
              onClick={() => { onClose(); navigate('/'); }}
              className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90"
            >
              See Pro Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
