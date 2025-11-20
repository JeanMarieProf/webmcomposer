
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoSource {
  id: string;
  url: string;
  file: File;
  duration: number;
}

export interface VideoClip extends VideoSource {
  trimStart: number;
  trimEnd: number;
  // We can add per-clip transformations later if needed
}

export interface AudioSource {
  id: string;
  url: string;
  file: File;
}

export enum EditorMode {
  IDLE,
  PLAYING,
  RECORDING,
}
