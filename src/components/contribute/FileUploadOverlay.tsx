import React, { useState, useCallback } from 'react';

interface FileUploadOverlayProps {
  onFileParsed: (data: { fileName: string; fileType: string; size: number; content: string }) => void;
  onCancel: () => void;
}

export const FileUploadOverlay: React.FC<FileUploadOverlayProps> = ({ onFileParsed, onCancel }) => {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      onFileParsed({
        fileName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'unknown',
        size: file.size,
        content: reader.result as string,
      });
    };
    reader.readAsText(file);
  }, [onFileParsed]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      onFileParsed({
        fileName: file.name,
        fileType: file.type || file.name.split('.').pop() || 'unknown',
        size: file.size,
        content: reader.result as string,
      });
    };
    reader.readAsText(file);
  }, [onFileParsed]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`absolute inset-0 z-[9999] flex items-center justify-center ${
        dragging ? 'bg-[#7A4BC8]/20' : 'bg-black/5'
      }`}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-[20px] p-6 shadow-2xl text-center max-w-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">📁</div>
        <p className="text-[14px] font-poppins font-semibold text-gray-800 mb-2">
          Drop GPX/GeoJSON/KML file
        </p>
        <p className="text-[11px] text-gray-500 mb-4">or</p>
        <label className="inline-block px-4 py-2 bg-[#7A4BC8] text-white rounded-[10px] text-[12px] font-poppins cursor-pointer">
          Browse Files
          <input
            type="file"
            accept=".gpx,.geojson,.json,.kml"
            className="hidden"
            onChange={handleFileSelect}
          />
        </label>
        <button
          onClick={onCancel}
          className="block w-full mt-3 text-[11px] text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
