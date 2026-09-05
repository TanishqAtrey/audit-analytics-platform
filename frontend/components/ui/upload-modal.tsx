'use client';
import React, { useState, useRef } from 'react';
import { Modal } from './modal';
import { LoadButton } from './load-button';
import { UploadCloud, File as FileIcon } from 'lucide-react';
import { showSuccess, showError } from './toast';
import { cn } from '@/lib/utils';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  accept?: string;
  onUpload: (file: File) => Promise<void>;
}

export function UploadModal({ open, onClose, title, description, accept = '.csv', onUpload }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragging(true);
    else if (e.type === 'dragleave') setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      await onUpload(file);
      showSuccess('File uploaded successfully');
      setFile(null);
      onClose();
    } catch (error) {
      showError('Failed to upload file');
      throw error;
    }
  };

  return (
    <Modal open={open} onClose={() => { setFile(null); onClose(); }} title={title} description={description}>
      <div className="mt-4 flex flex-col space-y-4">
        <div
          className={cn(
            'flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-xl cursor-pointer transition-colors',
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            type="file"
            accept={accept}
            className="hidden"
            ref={inputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
            }}
          />
          <UploadCloud className={cn("w-10 h-10 mb-2", isDragging ? "text-blue-500" : "text-gray-400")} />
          <p className="text-sm text-gray-600 text-center px-4">
            <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop<br/>
            {accept}
          </p>
        </div>

        {file && (
          <div className="flex items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
            <FileIcon className="w-5 h-5 text-blue-500 mr-2" />
            <span className="text-sm text-blue-900 font-medium truncate flex-1">{file.name}</span>
            <span className="text-xs text-blue-600 mr-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            <button onClick={() => setFile(null)} className="text-blue-400 hover:text-blue-600 text-sm font-medium">Remove</button>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <LoadButton onClick={handleUpload} disabled={!file} className="w-full sm:w-auto">
            Upload File
          </LoadButton>
        </div>
      </div>
    </Modal>
  );
}
