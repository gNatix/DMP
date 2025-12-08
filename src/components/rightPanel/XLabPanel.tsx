import { Beaker, Zap, TestTube } from 'lucide-react';
import { TerrainShapeMode } from '../../types';

interface XLabPanelProps {
  xlabShapeMode: TerrainShapeMode;
  onXlabShapeModeChange: (mode: TerrainShapeMode) => void;
}

export default function XLabPanel({ xlabShapeMode, onXlabShapeModeChange }: XLabPanelProps) {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
        <Beaker className="text-purple-500" size={24} />
        <div>
          <h2 className="text-lg font-semibold text-white">X-Lab</h2>
          <p className="text-xs text-gray-400">Experimental Features</p>
        </div>
      </div>

      {/* Welcome Message */}
      <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TestTube className="text-purple-400 mt-1 flex-shrink-0" size={20} />
          <div>
            <h3 className="text-sm font-semibold text-purple-300 mb-1">Welcome to X-Lab</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              This is an experimental area for testing new features before they're added to the main toolset.
              Features here may be unstable or incomplete.
            </p>
          </div>
        </div>
      </div>

      {/* Experiment Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Zap size={16} />
          <h3 className="text-sm font-semibold">Active Experiments</h3>
        </div>

        {/* Terrain Shape Tool Experiment */}
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <h4 className="text-sm font-semibold text-white mb-2">Terrain Shape Fill</h4>
          <p className="text-xs text-gray-400 mb-3">
            Draw terrain shapes and fill them instantly with brush textures.
          </p>
          
          <div className="space-y-3">
            <div className="text-xs text-gray-500">
              <span className="font-semibold text-gray-400">Status:</span> Active Experiment
            </div>
            
            {/* Shape Mode Picker - Icon based like room tools */}
            <div>
              <label className="block text-xs text-gray-400 mb-2">Shape Mode</label>
              <div className="flex gap-2">
                {/* Freehand Brush */}
                <button
                  onClick={() => onXlabShapeModeChange(null)}
                  className={`w-12 h-12 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    xlabShapeMode === null
                      ? 'border-purple-500 ring-2 ring-purple-500/50'
                      : 'border-gray-600 hover:border-purple-400'
                  }`}
                  title="Freehand Brush"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {/* Rectangle */}
                <button
                  onClick={() => onXlabShapeModeChange('rectangle')}
                  className={`w-12 h-12 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    xlabShapeMode === 'rectangle'
                      ? 'border-purple-500 ring-2 ring-purple-500/50'
                      : 'border-gray-600 hover:border-purple-400'
                  }`}
                  title="Rectangle Fill"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="4" y="6" width="16" height="12"/>
                  </svg>
                </button>

                {/* Circle */}
                <button
                  onClick={() => onXlabShapeModeChange('circle')}
                  className={`w-12 h-12 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    xlabShapeMode === 'circle'
                      ? 'border-purple-500 ring-2 ring-purple-500/50'
                      : 'border-gray-600 hover:border-purple-400'
                  }`}
                  title="Circle Fill"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>
                </button>

                {/* Polygon */}
                <button
                  onClick={() => onXlabShapeModeChange('polygon')}
                  className={`w-12 h-12 rounded border-2 transition-all bg-dm-dark flex items-center justify-center ${
                    xlabShapeMode === 'polygon'
                      ? 'border-purple-500 ring-2 ring-purple-500/50'
                      : 'border-gray-600 hover:border-purple-400'
                  }`}
                  title="Polygon Fill"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path d="M12 3 L20 8 L18 18 L6 18 L4 8 Z"/>
                  </svg>
                </button>
              </div>
            </div>

            <div className="text-xs text-gray-500 bg-gray-900/50 rounded p-2">
              <span className="font-semibold text-gray-400">How to use:</span>
              <ol className="mt-1 ml-4 list-decimal space-y-1">
                <li>Enable Rectangle mode above</li>
                <li>Select a terrain texture from Draw tab</li>
                <li>Click and drag to draw shape</li>
                <li>Release to fill with texture</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Placeholder for future experiments */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 border-dashed">
          <p className="text-xs text-gray-500 text-center italic">
            More experiments coming soon...
          </p>
        </div>
      </div>

      {/* Info Footer */}
      <div className="pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-semibold text-gray-400">Tip:</span> Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">X</kbd> to toggle X-Lab on/off
        </p>
      </div>
    </div>
  );
}
