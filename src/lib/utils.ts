import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function categoryColor(category: string): {
  bg: string;
  text: string;
  border: string;
} {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (category.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  }
  const hue = Math.abs(hash % 360);
  return {
    bg: `oklch(0.9 0.07 ${hue})`,
    text: `oklch(0.35 0.14 ${hue})`,
    border: `oklch(0.6 0.16 ${hue})`,
  };
}
