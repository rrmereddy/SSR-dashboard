import { ReactNode } from 'react';

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface BentoGridItemProps {
  id: string;
  children: ReactNode;
  initialPosition: Position;
  initialSize: Size;
  onDrag?: (id: string, position: Position) => void;
  onResize?: (id: string, size: Size) => void;
}

export interface GridItemType {
  id: string;
  title: string;
  position: Position;
  size: Size;
  color: string;
  content: ReactNode;
}