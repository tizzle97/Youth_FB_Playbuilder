import React, { useState, useRef, useCallback } from 'react';
import { X } from 'lucide-react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  onCropComplete: (croppedBlob: Blob) => void;
}

export function ImageCropModal({ isOpen, onClose, imageUrl, onCropComplete }: ImageCropModalProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%' as const,
    width: 100,
    height: 100,
    x: 0,
    y: 0
  } as Crop);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const [completedCrop, setCompletedCrop] = useState<Crop | null>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerAspectCrop(width, height, 1);
    setCrop(crop);
  }, []);

  function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    _aspect: number,
  ) {
    const size = Math.min(mediaWidth, mediaHeight);
    return {
      unit: '%' as const,
      width: (size * 100) / mediaWidth,
      height: (size * 100) / mediaHeight,
      x: ((mediaWidth - size) * 100) / (2 * mediaWidth),
      y: ((mediaHeight - size) * 100) / (2 * mediaHeight)
    } as Crop;
  }

  const handleCropComplete = useCallback(async () => {
    if (!imgRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
        onClose();
      }
    }, 'image/jpeg', 0.95);
  }, [completedCrop, onCropComplete, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-75" onClick={onClose} />

        <div className="inline-block w-full max-w-2xl overflow-hidden text-left align-middle transition-all transform bg-board-light rounded-lg shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-chalk/10">
            <h3 className="text-2xl font-bold text-chalk">Crop Image</h3>
            <button
              onClick={onClose}
              className="text-chalk/70 hover:text-chalk transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  src={imageUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-w-full"
                />
              </ReactCrop>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-chalk bg-board border border-chalk/20 rounded-md hover:bg-board-light"
              >
                Cancel
              </button>
              <button
                onClick={handleCropComplete}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-dark rounded-md"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
