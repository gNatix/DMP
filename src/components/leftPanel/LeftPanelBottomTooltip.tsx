const LeftPanelBottomTooltip = () => {
  return (
    <div className="p-4 border-t border-dm-border bg-dm-dark/50">
      <p className="text-xs text-gray-400">
        <strong className="text-gray-300">Click elements</strong> on the map to view and edit their properties
      </p>
      <p className="text-xs text-gray-400">
        <strong className="text-gray-300">Add widgets</strong> to rooms to display stat blocks, encounter tables, and notes
      </p>
      <p className="text-xs text-gray-400 mt-1">
        <strong className="text-gray-300">Drag and drop</strong> widgets to reorder them within a room
      </p>
    </div>
  );
};

export default LeftPanelBottomTooltip;
