import { User, LogOut, Mail, Lock, Monitor, UserCircle, FlaskConical, ChevronDown, ChevronRight, Keyboard, Settings2 } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { TOOLBAR_PRESETS, detectMatchingPreset, getPresetById, ToolbarPresetId } from '../../config/toolbarPresets';

interface SettingsTabProps {
  hiddenToolbarButtons?: Set<string>;
  onHiddenToolbarButtonsChange?: (buttons: Set<string>) => void;
  customKeybinds?: Record<string, string>;
  onCustomKeybindsChange?: (keybinds: Record<string, string>) => void;
}

type SettingsSubTab = 'system' | 'account' | 'beta';

// ========== LOCKED KEYBINDS (CANNOT BE CUSTOMIZED) ==========
// These are core functions that should maintain standard keybinds
const LOCKED_BUTTONS = new Set([
  'undo',        // Ctrl+Z - Universal undo
  'redo',        // Ctrl+Y/Ctrl+Shift+Z - Universal redo
  'delete',      // Delete/Backspace - Universal delete
  'duplicate',   // Ctrl+D - Common duplicate
]);

// ========== TOOLBAR KEYBIND DEFINITIONS ==========
// Organized by category matching Toolbox.tsx categories
interface KeybindItem {
  id: string;
  label: string;
  keybind: string;
  canToggle: boolean; // Whether this button can be shown/hidden in toolbar
  locked?: boolean; // Whether this keybind can be customized
  tip?: string; // Optional tip for alternative usage
}

interface KeybindCategory {
  id: string;
  label: string;
  items: KeybindItem[];
}

const KEYBIND_CATEGORIES: KeybindCategory[] = [
  {
    id: 'selection',
    label: 'Selection',
    items: [
      { id: 'pointer', label: 'Pointer Tool', keybind: 'V', canToggle: false },
    ],
  },
  {
    id: 'drawing',
    label: 'Drawing Tools',
    items: [
      { id: 'token', label: 'Token Tool', keybind: 'Q', canToggle: false, tip: 'Press Q again or scroll on button to cycle tokens' },
      { id: 'terrain', label: 'Terrain Brush', keybind: 'E', canToggle: false, tip: 'Press E again or scroll on button to cycle brushes' },
      // LEGACY TOOLS - Archived (replaced by Modular Rooms)
      // { id: 'room', label: 'Room Builder', keybind: 'R', canToggle: false },
      { id: 'modularRoom', label: 'Modular Room', keybind: 'M', canToggle: false },
      // { id: 'wall', label: 'Wall Tool', keybind: 'W', canToggle: false, tip: 'Press W again or scroll on button to cycle textures' },
      // { id: 'wallCutterTool', label: 'Wall Cutter', keybind: 'A', canToggle: true },
      { id: 'doorTool', label: 'Door Tool', keybind: 'D', canToggle: true },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation',
    items: [
      { id: 'pan', label: 'Pan Tool', keybind: 'H', canToggle: true, tip: 'Middle-click + drag to pan anytime' },
      { id: 'zoom', label: 'Zoom Tool', keybind: 'Z', canToggle: true, tip: 'Scroll anywhere to zoom in/out' },
    ],
  },
  {
    id: 'history',
    label: 'History',
    items: [
      { id: 'undo', label: 'Undo', keybind: 'Ctrl+Z', canToggle: false, locked: true },
      { id: 'redo', label: 'Redo', keybind: 'Ctrl+Y', canToggle: false, locked: true },
    ],
  },
  {
    id: 'layers',
    label: 'Layer Tools',
    items: [
      { id: 'duplicate', label: 'Duplicate', keybind: 'Ctrl+D', canToggle: false, locked: true },
      { id: 'delete', label: 'Delete', keybind: 'Del', canToggle: false, locked: true },
      { id: 'layer-up', label: 'Layer Up', keybind: 'Ctrl+↑', canToggle: true },
      { id: 'layer-down', label: 'Layer Down', keybind: 'Ctrl+↓', canToggle: true },
    ],
  },
  {
    id: 'toggle',
    label: 'Toggles',
    items: [
      { id: 'grid', label: 'Toggle Grid', keybind: 'G', canToggle: true, tip: 'Scroll on button to resize grid' },
      { id: 'fit-to-view', label: 'Fit to View', keybind: 'F', canToggle: true },
      { id: 'info', label: 'Info Panel', keybind: 'I', canToggle: true },
      { id: 'lock', label: 'Lock Element', keybind: 'L', canToggle: false },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { id: 'color-picker', label: 'Color Picker', keybind: 'C', canToggle: true, tip: 'Press C again or scroll on button to cycle colors' },
      { id: 'badge-toggle', label: 'Name Badges', keybind: 'N', canToggle: true, tip: 'Toggle name badges on all tokens globally' },
    ],
  },
];

const SettingsTab = ({ 
  hiddenToolbarButtons = new Set(), 
  onHiddenToolbarButtonsChange = () => {},
  customKeybinds = {},
  onCustomKeybindsChange = () => {}
}: SettingsTabProps) => {
  const { user, loading, signIn, signUp, signInWithGoogle, signInWithDiscord, signOut } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>('system');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Toolbar settings state
  const [isToolbarSectionOpen, setIsToolbarSectionOpen] = useState(true);
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set()); // Start collapsed
  
  // Keybind editing state - dialog instead of inline editing
  const [editingKeybind, setEditingKeybind] = useState<{buttonId: string, buttonLabel: string, defaultKeybind: string} | null>(null);
  const [capturedKey, setCapturedKey] = useState<string>('');
  const [conflictingButton, setConflictingButton] = useState<{id: string, label: string, currentKeybind: string} | null>(null);
  
  // Detect which preset matches current settings
  const activePreset = useMemo<ToolbarPresetId>(() => {
    return detectMatchingPreset(hiddenToolbarButtons);
  }, [hiddenToolbarButtons]);
  
  // Apply a preset
  const applyPreset = (presetId: ToolbarPresetId) => {
    if (presetId === 'custom') return; // Can't manually select custom
    
    const preset = getPresetById(presetId);
    if (preset) {
      onHiddenToolbarButtonsChange(new Set(preset.hiddenButtons));
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };
  
  const toggleButtonVisibility = (buttonId: string) => {
    const next = new Set(hiddenToolbarButtons);
    if (next.has(buttonId)) {
      next.delete(buttonId);
    } else {
      next.add(buttonId);
    }
    onHiddenToolbarButtonsChange(next);
  };
  
  // Keybind editing functions
  const startEditingKeybind = (buttonId: string, buttonLabel: string, defaultKeybind: string, isLocked: boolean) => {
    // Don't allow editing locked keybinds
    if (isLocked) {
      return;
    }
    
    setEditingKeybind({ buttonId, buttonLabel, defaultKeybind });
    setCapturedKey('');
    setConflictingButton(null);
  };
  
  // Check if a keybind is already in use
  const checkKeybindConflict = (key: string, currentButtonId: string): {id: string, label: string, currentKeybind: string} | null => {
    const normalizedKey = key.toUpperCase();
    
    // Check all categories and items
    for (const category of KEYBIND_CATEGORIES) {
      for (const item of category.items) {
        if (item.id === currentButtonId) continue; // Skip the button we're editing
        
        // Check if this button uses the key (custom or default)
        const buttonKeybind = (customKeybinds[item.id] || item.keybind).toUpperCase();
        if (buttonKeybind === normalizedKey) {
          // Get what this button's keybind will be if we swap
          const currentButtonKeybind = customKeybinds[currentButtonId] || 
            KEYBIND_CATEGORIES.flatMap(c => c.items)
              .find(i => i.id === currentButtonId)?.keybind || '';
          
          return { 
            id: item.id, 
            label: item.label,
            currentKeybind: currentButtonKeybind
          };
        }
      }
    }
    
    return null;
  };
  
  const saveKeybind = (key: string, swapWithConflict: boolean = false) => {
    if (!editingKeybind || !key.trim()) {
      setEditingKeybind(null);
      setCapturedKey('');
      setConflictingButton(null);
      return;
    }
    
    const normalizedKey = key.toUpperCase();
    
    // Check for conflicts if not swapping
    if (!swapWithConflict) {
      const conflict = checkKeybindConflict(normalizedKey, editingKeybind.buttonId);
      if (conflict) {
        setConflictingButton(conflict);
        return; // Don't save yet, wait for user decision
      }
    }
    
    // Prepare the new keybinds object
    const newKeybinds = { ...customKeybinds };
    
    // If swapping, we need to swap the keybinds
    if (swapWithConflict && conflictingButton) {
      // Get the current keybind of the button we're editing
      const currentButtonKeybind = customKeybinds[editingKeybind.buttonId] || editingKeybind.defaultKeybind;
      
      // Set the new keybind for the button we're editing
      newKeybinds[editingKeybind.buttonId] = normalizedKey;
      
      // Set the old keybind for the conflicting button
      newKeybinds[conflictingButton.id] = currentButtonKeybind.toUpperCase();
    } else {
      // Just set the new keybind
      newKeybinds[editingKeybind.buttonId] = normalizedKey;
    }
    
    // Save the keybinds
    onCustomKeybindsChange(newKeybinds);
    
    setEditingKeybind(null);
    setCapturedKey('');
    setConflictingButton(null);
  };
  
  const cancelEditingKeybind = () => {
    setEditingKeybind(null);
    setCapturedKey('');
    setConflictingButton(null);
  };
  
  const swapKeybinds = () => {
    if (capturedKey) {
      saveKeybind(capturedKey, true); // Swap keybinds
    }
  };
  
  const resetAllKeybinds = () => {
    onCustomKeybindsChange({});
  };
  
  const getDisplayKeybind = (buttonId: string, defaultKeybind: string): string => {
    return customKeybinds[buttonId] || defaultKeybind;
  };
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setSuccessMessage('Account created! Check your email to confirm.');
          setEmail('');
          setPassword('');
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          setSuccessMessage('Successfully logged in!');
          setEmail('');
          setPassword('');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setSuccessMessage('Successfully logged out');
    } catch (err) {
      setError('Failed to log out');
      console.error(err);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { error: googleError } = await signInWithGoogle();
      if (googleError) {
        setError(googleError.message);
        setIsSubmitting(false);
      }
      // Don't set isSubmitting false on success - user will be redirected
    } catch (err) {
      setError('Failed to sign in with Google');
      setIsSubmitting(false);
      console.error(err);
    }
  };

  const handleDiscordSignIn = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const { error: discordError } = await signInWithDiscord();
      if (discordError) {
        setError(discordError.message);
        setIsSubmitting(false);
      }
      // Don't set isSubmitting false on success - user will be redirected
    } catch (err) {
      setError('Failed to sign in with Discord');
      setIsSubmitting(false);
      console.error(err);
    }
  };

  // Show loading only during initial auth check
  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // ========== SYSTEM TAB CONTENT ==========
  const renderSystemTab = () => (
    <div className="p-4 space-y-4">
      {/* Toolbar Settings Section */}
      <div className="bg-dm-dark rounded-lg overflow-hidden">
        {/* Section Header - Collapsible */}
        <button
          onClick={() => setIsToolbarSectionOpen(!isToolbarSectionOpen)}
          className="w-full flex items-center justify-between p-3 hover:bg-dm-panel/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-dm-highlight" />
            <span className="text-sm font-medium text-gray-200">Toolbar Settings</span>
          </div>
          {isToolbarSectionOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        {/* Section Content */}
        {isToolbarSectionOpen && (
          <div className="border-t border-dm-border">
            {/* Preset Selector */}
            <div className="px-3 py-3 space-y-2">
              <p className="text-xs text-gray-500 mb-2">
                Choose a toolbar preset or customize individual buttons below.
              </p>
              
              {/* Preset Toggles */}
              <div className="space-y-1.5">
                {TOOLBAR_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id as ToolbarPresetId)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                      activePreset === preset.id
                        ? 'bg-dm-highlight/20 border border-dm-highlight/40'
                        : 'bg-dm-panel/30 border border-transparent hover:bg-dm-panel/50'
                    }`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-medium ${
                        activePreset === preset.id ? 'text-dm-highlight' : 'text-gray-300'
                      }`}>
                        {preset.name}
                      </span>
                      <span className="text-[10px] text-gray-500">{preset.description}</span>
                    </div>
                    {/* Toggle Indicator */}
                    <div className={`w-8 h-4 rounded-full transition-colors ${
                      activePreset === preset.id ? 'bg-dm-highlight' : 'bg-gray-600'
                    }`}>
                      <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5 ${
                        activePreset === preset.id ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                  </button>
                ))}
                
                {/* Custom Indicator (read-only) */}
                <div className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  activePreset === 'custom'
                    ? 'bg-amber-500/20 border border-amber-500/40'
                    : 'bg-dm-panel/20 border border-transparent opacity-50'
                }`}>
                  <div className="flex flex-col items-start">
                    <span className={`text-sm font-medium ${
                      activePreset === 'custom' ? 'text-amber-400' : 'text-gray-500'
                    }`}>
                      Custom
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {activePreset === 'custom' ? 'You have custom settings' : 'Modify settings below to customize'}
                    </span>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors ${
                    activePreset === 'custom' ? 'bg-amber-500' : 'bg-gray-700'
                  }`}>
                    <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform mt-0.5 ${
                      activePreset === 'custom' ? 'translate-x-4' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Advanced Settings Toggle */}
            <button
              onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 border-t border-dm-border hover:bg-dm-panel/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-400">Advanced Settings</span>
              </div>
              {isAdvancedSettingsOpen ? (
                <ChevronDown className="w-3 h-3 text-gray-500" />
              ) : (
                <ChevronRight className="w-3 h-3 text-gray-500" />
              )}
            </button>
            
            {/* Advanced Settings Content - Individual Button Toggles */}
            {isAdvancedSettingsOpen && (
              <div className="border-t border-dm-border/50">
                <p className="text-[10px] text-gray-500 px-3 py-2 bg-dm-panel/10 border-b border-dm-border/30">
                  Toggle individual buttons. Changes will switch to &quot;Custom&quot; mode if they don&apos;t match a preset.
                </p>
                
                {/* Reset All Keybinds Button */}
                {Object.keys(customKeybinds).length > 0 && (
                  <div className="px-3 py-2 bg-dm-panel/10 border-b border-dm-border/30">
                    <button
                      onClick={resetAllKeybinds}
                      className="w-full px-3 py-2 bg-red-900/20 hover:bg-red-900/30 border border-red-700/50 rounded text-xs text-red-400 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Reset All Keybinds to Default
                    </button>
                  </div>
                )}
                
                {/* Keybind Categories */}
                <div className="divide-y divide-dm-border/30">
                  {KEYBIND_CATEGORIES.map(category => (
                    <div key={category.id}>
                      {/* Category Header */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-dm-panel/30 transition-colors"
                      >
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                          {category.label}
                        </span>
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="w-3 h-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-3 h-3 text-gray-500" />
                        )}
                      </button>
                      
                      {/* Category Items */}
                      {expandedCategories.has(category.id) && (
                        <div className="bg-dm-panel/20">
                          {category.items.map(item => {
                            const displayKeybind = getDisplayKeybind(item.id, item.keybind);
                            const isCustom = customKeybinds[item.id] !== undefined;
                            const isLocked = item.locked || LOCKED_BUTTONS.has(item.id);
                            
                            return (
                            <div
                              key={item.id}
                              className="px-4 py-1.5 hover:bg-dm-panel/30"
                            >
                              <div className="flex items-center justify-between">
                                {/* Label and Keybind */}
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-300">{item.label}</span>
                                  
                                  {/* Keybind button */}
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => startEditingKeybind(item.id, item.label, item.keybind, isLocked)}
                                      disabled={isLocked}
                                      className={`px-1.5 py-0.5 bg-dm-dark rounded text-[10px] font-mono border transition-colors ${
                                        isLocked
                                          ? 'text-gray-600 border-gray-700 cursor-not-allowed opacity-50'
                                          : isCustom
                                          ? 'text-blue-400 border-blue-500/50 hover:border-blue-500 cursor-pointer'
                                          : 'text-gray-500 border-dm-border/50 hover:border-gray-400 cursor-pointer'
                                      }`}
                                      title={isLocked ? 'This keybind cannot be customized' : 'Click to customize keybind'}
                                    >
                                      {displayKeybind}
                                    </button>
                                    {isLocked && (
                                      <span className="text-[9px] text-gray-600" title="Protected keybind">
                                        🔒
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Toggle Switch */}
                                {item.canToggle ? (
                                  <button
                                    onClick={() => toggleButtonVisibility(item.id)}
                                    className={`relative w-8 h-4 rounded-full transition-colors ${
                                      !hiddenToolbarButtons.has(item.id)
                                        ? 'bg-green-500'
                                        : 'bg-gray-600'
                                    }`}
                                  >
                                    <div
                                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                        !hiddenToolbarButtons.has(item.id)
                                          ? 'translate-x-4'
                                          : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-gray-600 italic">Required</span>
                                )}
                              </div>
                              {/* Tip */}
                              {item.tip && (
                                <p className="text-[10px] text-gray-500 mt-0.5 italic pl-0.5">
                                  💡 {item.tip}
                                </p>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* App Info */}
      <div className="border-t border-dm-border pt-4">
        <div className="text-xs text-gray-500 space-y-1">
          <p>DM Planner v1.0.0</p>
          <p>© 2025 All rights reserved</p>
        </div>
      </div>
    </div>
  );

  // ========== ACCOUNT TAB CONTENT ==========
  const renderAccountTab = () => (
    <div className="p-4 space-y-6">
      {/* Account Section */}
      <div className="space-y-4">
        {/* Avatar & User Info */}
        <div className="bg-dm-dark rounded-lg p-4 space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-dm-panel flex items-center justify-center border-2 border-dm-border">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
            <div>
              {user ? (
                <>
                  <p className="text-sm font-medium text-gray-200">
                    {user.displayName || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-400">Not logged in</p>
                  <p className="text-xs text-gray-500 mt-1">Sign in to sync your data</p>
                </>
              )}
            </div>
          </div>

          {/* Auth Form or Logout */}
          {user ? (
            <button
              onClick={handleSignOut}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email Input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full bg-dm-panel border border-dm-border rounded py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-dm-panel border border-dm-border rounded py-2 pl-10 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-dm-highlight"
                  />
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded p-2">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="text-xs text-green-400 bg-green-900/20 border border-green-800 rounded p-2">
                  {successMessage}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-dm-highlight hover:bg-dm-highlight/80 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors"
              >
                {isSubmitting ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Sign In'}
              </button>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dm-border"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-dm-dark text-gray-500">OR</span>
                </div>
              </div>

              {/* Google Sign In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isSubmitting ? 'Redirecting...' : `Continue with Google`}
              </button>

              {/* Discord Sign In Button */}
              <button
                type="button"
                onClick={handleDiscordSignIn}
                disabled={isSubmitting}
                className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-2 px-4 rounded transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
                </svg>
                {isSubmitting ? 'Redirecting...' : `Continue with Discord`}
              </button>

              {/* Toggle Sign Up / Sign In */}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="w-full text-xs text-dm-highlight hover:text-dm-highlight/80 transition-colors"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </form>
          )}
        </div>

        {/* Account Settings (only show when logged in) */}
        {user && (
          <div className="bg-dm-dark rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Account Options
            </h4>
            <div className="space-y-2">
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Profile Settings
              </button>
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Privacy
              </button>
              <button className="w-full text-left text-sm text-gray-400 hover:text-gray-200 py-2 px-3 rounded hover:bg-dm-panel transition-colors">
                Data & Storage
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ========== BETA TAB CONTENT ==========
  const renderBetaTab = () => (
    <div className="p-4 space-y-6">
      {/* Placeholder for beta settings */}
      <div className="text-center text-gray-500 py-8">
        <FlaskConical className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Beta features coming soon</p>
        <p className="text-xs mt-2 text-gray-600">Experimental options will appear here</p>
      </div>
    </div>
  );

  // ========== KEYBIND CAPTURE DIALOG ==========
  useEffect(() => {
    if (!editingKeybind) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Cancel on ESC
      if (e.key === 'Escape') {
        cancelEditingKeybind();
        return;
      }
      
      // Ignore modifier-only keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }
      
      // Capture the key
      const key = e.key.toUpperCase();
      setCapturedKey(key);
      
      // Auto-save after short delay
      setTimeout(() => {
        saveKeybind(key);
      }, 300);
    };
    
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [editingKeybind]);

  return (
    <div className="h-full flex flex-col bg-dm-panel overflow-hidden">
      {/* Keybind Dialog */}
      {editingKeybind && (
        <div 
          className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center"
          onClick={cancelEditingKeybind}
        >
          <div 
            className="bg-dm-panel border-2 border-dm-highlight rounded-lg p-6 shadow-2xl w-96"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={cancelEditingKeybind}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-300 transition-colors"
              title="Cancel (ESC)"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* Dialog content */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-white mb-2">
                Set Keybind
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                for <span className="text-dm-highlight font-medium">{editingKeybind.buttonLabel}</span>
              </p>
              
              {/* Key display */}
              <div className="mb-4">
                <div className="bg-dm-dark border-2 border-dm-highlight/30 rounded-lg p-6 min-h-[80px] flex items-center justify-center">
                  {capturedKey ? (
                    <span className="text-4xl font-bold text-dm-highlight font-mono">
                      {capturedKey}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-sm">
                      Press any key...
                    </span>
                  )}
                </div>
              </div>
              
              {/* Conflict warning */}
              {conflictingButton && (
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                  <p className="text-xs text-yellow-400 mb-3">
                    ⚠️ <span className="font-semibold">{capturedKey}</span> is already used by <span className="font-semibold">{conflictingButton.label}</span>
                  </p>
                  <div className="text-xs text-gray-400 mb-3 p-2 bg-dm-dark/50 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span>{editingKeybind.buttonLabel}:</span>
                      <span className="font-mono">
                        <span className="text-gray-600 line-through">{editingKeybind.defaultKeybind}</span>
                        {' → '}
                        <span className="text-dm-highlight">{capturedKey}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{conflictingButton.label}:</span>
                      <span className="font-mono">
                        <span className="text-gray-600 line-through">{capturedKey}</span>
                        {' → '}
                        <span className="text-blue-400">{conflictingButton.currentKeybind}</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelEditingKeybind}
                      className="flex-1 px-3 py-2 bg-dm-dark hover:bg-dm-border text-gray-300 rounded transition-colors text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={swapKeybinds}
                      className="flex-1 px-3 py-2 bg-dm-highlight hover:bg-dm-highlight/80 text-white rounded transition-colors text-xs font-medium"
                    >
                      Swap Keybinds
                    </button>
                  </div>
                </div>
              )}
              
              {/* Instructions */}
              {!conflictingButton && (
                <p className="text-xs text-gray-500 mb-4">
                  Press <span className="text-gray-400 font-mono">ESC</span> to cancel
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Sub-tab Navigation */}
      <div className="flex gap-1 p-2 border-b border-dm-border">
        <button
          onClick={() => setActiveSubTab('system')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
            activeSubTab === 'system'
              ? 'bg-dm-highlight/20 text-dm-highlight border border-dm-highlight/30'
              : 'bg-dm-dark/30 text-gray-400 hover:text-gray-300 border border-transparent'
          }`}
        >
          <Monitor className="w-3 h-3 inline-block mr-1" />
          System
        </button>
        <button
          onClick={() => setActiveSubTab('account')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
            activeSubTab === 'account'
              ? 'bg-dm-highlight/20 text-dm-highlight border border-dm-highlight/30'
              : 'bg-dm-dark/30 text-gray-400 hover:text-gray-300 border border-transparent'
          }`}
        >
          <UserCircle className="w-3 h-3 inline-block mr-1" />
          Account
        </button>
        <button
          onClick={() => setActiveSubTab('beta')}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-all ${
            activeSubTab === 'beta'
              ? 'bg-dm-highlight/20 text-dm-highlight border border-dm-highlight/30'
              : 'bg-dm-dark/30 text-gray-400 hover:text-gray-300 border border-transparent'
          }`}
        >
          <FlaskConical className="w-3 h-3 inline-block mr-1" />
          Beta
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSubTab === 'system' && renderSystemTab()}
        {activeSubTab === 'account' && renderAccountTab()}
        {activeSubTab === 'beta' && renderBetaTab()}
      </div>
    </div>
  );
};

export default SettingsTab;
