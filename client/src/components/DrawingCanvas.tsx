import { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

interface DrawingCanvasProps {
  // Mode: 'draw' for drawer, 'view' for others
  mode: 'draw' | 'view';
  // Callback when a stroke is completed (draw mode)
  onStroke?: (stroke: Stroke) => void;
  // Callback when canvas is cleared (draw mode)
  onClear?: () => void;
  // Incoming strokes to render (view mode or initial state)
  strokes?: Stroke[];
  // Real-time stroke data streaming
  onStrokePoint?: (point: Point, color: string, width: number, isNewStroke: boolean) => void;
  // Width and height
  width?: number;
  height?: number;
  // Class name
  className?: string;
}

const COLORS = [
  '#000000', // Black
  '#FFFFFF', // White
  '#EF4444', // Red
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#22C55E', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
];

const BRUSH_SIZES = [4, 8, 16];

export default function DrawingCanvas({
  mode,
  onStroke,
  onClear,
  strokes = [],
  onStrokePoint,
  width = 800,
  height = 600,
  className = '',
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentWidth, setCurrentWidth] = useState(8);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [localStrokes, setLocalStrokes] = useState<Stroke[]>([]);
  const [isEraser, setIsEraser] = useState(false);
  
  // Redraw all strokes on canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw all strokes
    const allStrokes = mode === 'view' ? strokes : localStrokes;
    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    
    // Draw current stroke if drawing
    if (isDrawing && currentStroke.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = isEraser ? '#FFFFFF' : currentColor;
      ctx.lineWidth = isEraser ? 24 : currentWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, localStrokes, mode, isDrawing, currentStroke, currentColor, currentWidth, isEraser]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);
  
  // Handle incoming strokes in view mode
  useEffect(() => {
    if (mode === 'view') {
      redrawCanvas();
    }
  }, [strokes, mode, redrawCanvas]);
  
  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };
  
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentStroke([point]);
    
    // Stream the first point
    if (onStrokePoint) {
      onStrokePoint(point, isEraser ? '#FFFFFF' : currentColor, isEraser ? 24 : currentWidth, true);
    }
  };
  
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'draw' || !isDrawing) return;
    e.preventDefault();
    
    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);
    
    // Stream the point
    if (onStrokePoint) {
      onStrokePoint(point, isEraser ? '#FFFFFF' : currentColor, isEraser ? 24 : currentWidth, false);
    }
    
    // Draw immediately for smooth experience
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const prevPoint = currentStroke[currentStroke.length - 1];
    if (prevPoint) {
      ctx.beginPath();
      ctx.strokeStyle = isEraser ? '#FFFFFF' : currentColor;
      ctx.lineWidth = isEraser ? 24 : currentWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(prevPoint.x, prevPoint.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };
  
  const endDrawing = () => {
    if (mode !== 'draw' || !isDrawing) return;
    
    if (currentStroke.length > 1) {
      const stroke: Stroke = {
        points: currentStroke,
        color: isEraser ? '#FFFFFF' : currentColor,
        width: isEraser ? 24 : currentWidth,
      };
      
      setLocalStrokes(prev => [...prev, stroke]);
      
      if (onStroke) {
        onStroke(stroke);
      }
    }
    
    setIsDrawing(false);
    setCurrentStroke([]);
  };
  
  const handleClear = () => {
    setLocalStrokes([]);
    if (onClear) {
      onClear();
    }
    redrawCanvas();
  };
  
  const handleUndo = () => {
    if (localStrokes.length > 0) {
      setLocalStrokes(prev => prev.slice(0, -1));
    }
  };
  
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border-4 border-stone-600 rounded-lg cursor-crosshair touch-none bg-white"
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={endDrawing}
      />
      
      {mode === 'draw' && (
        <div className="flex flex-wrap gap-2 items-center justify-center bg-stone-800 p-2 rounded-lg">
          {/* Colors */}
          <div className="flex gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                onClick={() => { setCurrentColor(color); setIsEraser(false); }}
                className={`w-8 h-8 rounded-full border-2 transition-transform ${
                  currentColor === color && !isEraser ? 'border-yellow-400 scale-110' : 'border-stone-600'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-stone-600" />
          
          {/* Brush sizes */}
          <div className="flex gap-1 items-center">
            {BRUSH_SIZES.map(size => (
              <button
                key={size}
                onClick={() => { setCurrentWidth(size); setIsEraser(false); }}
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform ${
                  currentWidth === size && !isEraser ? 'border-yellow-400 scale-110' : 'border-stone-600'
                } bg-stone-700`}
              >
                <div
                  className="rounded-full bg-white"
                  style={{ width: size, height: size }}
                />
              </button>
            ))}
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-stone-600" />
          
          {/* Eraser */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${
              isEraser ? 'bg-yellow-500 text-black' : 'bg-stone-700 text-white'
            }`}
          >
            🧽 Eraser
          </button>
          
          {/* Undo */}
          <button
            onClick={handleUndo}
            className="px-3 py-1 rounded text-sm font-bold bg-stone-700 text-white hover:bg-stone-600"
            disabled={localStrokes.length === 0}
          >
            ↩ Undo
          </button>
          
          {/* Clear */}
          <button
            onClick={handleClear}
            className="px-3 py-1 rounded text-sm font-bold bg-red-600 text-white hover:bg-red-500"
          >
            🗑 Clear
          </button>
        </div>
      )}
    </div>
  );
}

// Export a hook for receiving real-time stroke updates
export function useStrokeReceiver() {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  
  const addCompleteStroke = useCallback((stroke: Stroke) => {
    setStrokes(prev => [...prev, stroke]);
  }, []);
  
  const clearStrokes = useCallback(() => {
    setStrokes([]);
  }, []);
  
  const setAllStrokes = useCallback((newStrokes: Stroke[]) => {
    setStrokes(newStrokes);
  }, []);
  
  return { strokes, addCompleteStroke, clearStrokes, setAllStrokes };
}
