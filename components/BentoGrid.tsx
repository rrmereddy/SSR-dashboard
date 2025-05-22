"use client";

import { useState, useRef, useEffect } from 'react';
import { Position, Size, BentoGridItemProps, GridItemType } from '@/types/bentoGridTypes';



// Grid item component with resize and drag functionality
const BentoGridItem: React.FC<BentoGridItemProps> = ({ id, children, initialPosition, initialSize, onDrag, onResize }) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartSize = useRef<{ width: number; height: number; x: number; y: number }>({ width: 0, height: 0, x: 0, y: 0 });
  
  // Handle drag start
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering drag event
    setIsResizing(true);
    resizeStartSize.current = {
      width: size.width,
      height: size.height,
      x: e.clientX,
      y: e.clientY
    };
  };

  // Handle drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStartPos.current.x;
        const newY = e.clientY - dragStartPos.current.y;
        setPosition({ x: newX, y: newY });
        if (onDrag) {
          onDrag(id, { x: newX, y: newY });
        }
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartSize.current.x;
        const deltaY = e.clientY - resizeStartSize.current.y;
        const newWidth = Math.max(100, resizeStartSize.current.width + deltaX);
        const newHeight = Math.max(100, resizeStartSize.current.height + deltaY);
        setSize({ width: newWidth, height: newHeight });
        if (onResize) {
          onResize(id, { width: newWidth, height: newHeight });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, id, onDrag, onResize, position.x, position.y, size.width, size.height]); // Added dependencies that were missing

  return (
    <div
      ref={itemRef}
      className={`absolute rounded-xl bg-white shadow-lg overflow-hidden transition-shadow ${isDragging ? 'cursor-grabbing shadow-xl' : 'cursor-grab shadow-md'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: isDragging || isResizing ? 10 : 1
      }}
      onMouseDown={handleDragStart}
    >
      <div className="p-4 h-full">
        {children}
      </div>
      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg width="16" height="16" viewBox="0 0 16 16">
          <path
            fill="currentColor"
            d="M11.5 16a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm8-4a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm12-4a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5zm-4 0a.5.5 0 01-.5-.5v-3a.5.5 0 011 0v3a.5.5 0 01-.5.5z"
          />
        </svg>
      </div>
    </div>
  );
};

// Main Component
export default function BentoGrid() {
  const [gridItems, setGridItems] = useState<GridItemType[]>([
    {
      id: 'analytics',
      title: 'Analytics',
      position: { x: 24, y: 80 },
      size: { width: 300, height: 240 },
      color: 'bg-blue-50',
      content: (
        <div className="h-full flex flex-col">
          <h3 className="font-semibold text-lg text-blue-800 mb-2">Analytics Overview</h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full h-32 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="text-blue-500 text-center">
                <div className="text-2xl font-bold">85%</div>
                <div className="text-sm mt-1">Weekly Growth</div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tasks',
      title: 'Tasks',
      position: { x: 348, y: 80 },
      size: { width: 300, height: 240 },
      color: 'bg-amber-50',
      content: (
        <div className="h-full flex flex-col">
          <h3 className="font-semibold text-lg text-amber-800 mb-2">Today&apos;s Tasks</h3>
          <div className="flex-1 overflow-y-auto">
            <ul className="space-y-2">
              <li className="flex items-center p-2 bg-amber-100 rounded-md">
                <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                <span className="text-amber-700">Review quarterly report</span>
              </li>
              <li className="flex items-center p-2 bg-amber-100 rounded-md">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                <span className="text-amber-700">Team meeting at 2PM</span>
              </li>
              <li className="flex items-center p-2 bg-amber-100 rounded-md">
                <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                <span className="text-amber-700">Update project timeline</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'calendar',
      title: 'Calendar',
      position: { x: 24, y: 340 },
      size: { width: 300, height: 240 },
      color: 'bg-emerald-50',
      content: (
        <div className="h-full flex flex-col">
          <h3 className="font-semibold text-lg text-emerald-800 mb-2">Calendar</h3>
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full bg-emerald-100 rounded-lg p-3">
              <div className="text-center mb-2 text-emerald-700 font-medium">May 2025</div>
              <div className="grid grid-cols-7 gap-1 text-xs text-emerald-700">
                <div className="text-center font-medium">Mo</div>
                <div className="text-center font-medium">Tu</div>
                <div className="text-center font-medium">We</div>
                <div className="text-center font-medium">Th</div>
                <div className="text-center font-medium">Fr</div>
                <div className="text-center font-medium">Sa</div>
                <div className="text-center font-medium">Su</div>
                
                {[...Array(31)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`text-center p-1 rounded-full ${i === 20 ? 'bg-emerald-500 text-white' : ''}`}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'notes',
      title: 'Notes',
      position: { x: 348, y: 340 },
      size: { width: 300, height: 240 },
      color: 'bg-purple-50',
      content: (
        <div className="h-full flex flex-col">
          <h3 className="font-semibold text-lg text-purple-800 mb-2">Quick Notes</h3>
          <div className="flex-1 bg-purple-100 rounded-lg p-3 text-purple-700 text-sm">
            <p>Remember to follow up with the marketing team about the new campaign launch scheduled for next month.</p>
            <p className="mt-2">Need to revise budget projections for Q3 before the board meeting.</p>
          </div>
        </div>
      )
    }
  ]);

  // Handle item drag
  const handleItemDrag = (id: string, newPosition: Position) => {
    setGridItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, position: newPosition } : item
      )
    );
  };

  // Handle item resize
  const handleItemResize = (id: string, newSize: Size) => {
    setGridItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, size: newSize } : item
      )
    );
  };

  return (
    <div className="flex flex-col">
      {/* Main Content Area - Bento Grid */}
      <main className="flex-1 relative">
        {gridItems.map(item => (
          <BentoGridItem
            key={item.id}
            id={item.id}
            initialPosition={item.position}
            initialSize={item.size}
            onDrag={handleItemDrag}
            onResize={handleItemResize}
          >
            <div className={`h-full ${item.color} rounded-lg p-3`}>
              {item.content}
            </div>
          </BentoGridItem>
        ))}
      </main>
      
    </div>
  );
}