import React, { useRef } from 'react';
import { Icon } from './Icon';

interface FileUploaderProps {
  accept: string;
  label: string;
  onFileSelect: (file: File) => void;
  icon: keyof typeof import('./Icon').Icons;
  disabled?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ accept, label, onFileSelect, icon, disabled }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
      // Reset value so same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-600 
        cursor-pointer transition-all hover:bg-gray-800 hover:border-blue-500
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input 
        type="file" 
        accept={accept} 
        ref={inputRef} 
        className="hidden" 
        onChange={handleChange}
        disabled={disabled}
      />
      <Icon icon={icon} size={18} className="text-gray-400" />
      <span className="text-sm font-medium text-gray-300">{label}</span>
    </div>
  );
};
