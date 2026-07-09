import { useRef } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Compress an image file to a JPEG data URL (max dimension, quality).
export async function compressImage(file: File, maxDim = 1600, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

export function ReceiptCapture({
  onCapture,
  disabled,
}: {
  onCapture: (dataUrl: string) => void;
  disabled?: boolean;
}) {
  const camRef = useRef<HTMLInputElement>(null);
  const libRef = useRef<HTMLInputElement>(null);

  const handle = async (f: File | undefined | null) => {
    if (!f) return;
    const url = await compressImage(f);
    onCapture(url);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <input
        ref={libRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <Button
        type="button"
        size="lg"
        className="h-16"
        disabled={disabled}
        onClick={() => camRef.current?.click()}
      >
        <Camera className="h-5 w-5 mr-2" /> Camera
      </Button>
      <Button
        type="button"
        size="lg"
        variant="secondary"
        className="h-16"
        disabled={disabled}
        onClick={() => libRef.current?.click()}
      >
        <ImagePlus className="h-5 w-5 mr-2" /> Library
      </Button>
    </div>
  );
}