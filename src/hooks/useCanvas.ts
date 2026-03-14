import { useState, useRef } from 'react';
import { fabric } from 'fabric';
import { drawStroke, type Point, type DrawOptions } from '../utils/canvas';

export function useCanvas() {
  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingMode, setDrawingMode] = useState(false);
  const points = useRef<Point[]>([]);
  const canvasRef = useRef<fabric.Canvas | null>(null);

  const initializeFootballField = (canvas: fabric.Canvas) => {
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    
    // Set white background
    canvas.backgroundColor = '#FFFFFF';
    
    // Calculate field dimensions
    const yardSpacing = height / 30;
    const losY = 20 * yardSpacing;
    const leftSidelineX = width * 0.05;
    const rightSidelineX = width * 0.95;

    // Add sidelines
    const leftSideline = new fabric.Line([leftSidelineX, 0, leftSidelineX, height], {
      stroke: '#1A1A1A',
      strokeWidth: 3,
      opacity: 0.4,
      selectable: false,
      evented: false,
      name: 'field-line'
    });

    const rightSideline = new fabric.Line([rightSidelineX, 0, rightSidelineX, height], {
      stroke: '#1A1A1A',
      strokeWidth: 3,
      opacity: 0.4,
      selectable: false,
      evented: false,
      name: 'field-line'
    });

    canvas.add(leftSideline, rightSideline);

    // Add line of scrimmage in light blue
    const los = new fabric.Line([leftSidelineX, losY, rightSidelineX, losY], {
      stroke: '#60A5FA',
      strokeWidth: 4,
      opacity: 0.7,
      selectable: false,
      evented: false,
      name: 'field-line'
    });
    canvas.add(los);

    // Add "LOS" text
    const losText = new fabric.Text('LOS', {
      left: leftSidelineX - 35,
      top: losY - 10,
      fontSize: 14,
      fill: '#60A5FA',
      opacity: 0.7,
      selectable: false,
      evented: false,
      name: 'field-line'
    });
    canvas.add(losText);

    // Add yard lines and hash marks
    for (let i = 0; i <= 30; i++) {
      const y = i * yardSpacing;
      const isMajorLine = i % 5 === 0;
      const isLOS = i === 20;

      if (isMajorLine && !isLOS) {
        // Main yard line
        const yardLine = new fabric.Line([leftSidelineX, y, rightSidelineX, y], {
          stroke: '#1A1A1A',
          strokeWidth: 3,
          opacity: 0.4,
          selectable: false,
          evented: false,
          name: 'field-line'
        });
        canvas.add(yardLine);
      }

      // Only add hash marks if this isn't a major yard line
      if (!isMajorLine && !isLOS) {
        // Add hash marks
        const hashWidth = width * 0.05;
        const leftHashX = width * 0.33;
        const rightHashX = width * 0.67;

        const leftHash = new fabric.Line([leftHashX - hashWidth/2, y, leftHashX + hashWidth/2, y], {
          stroke: '#1A1A1A',
          strokeWidth: 2,
          opacity: 0.3,
          selectable: false,
          evented: false,
          name: 'field-line'
        });

        const rightHash = new fabric.Line([rightHashX - hashWidth/2, y, rightHashX + hashWidth/2, y], {
          stroke: '#1A1A1A',
          strokeWidth: 2,
          opacity: 0.3,
          selectable: false,
          evented: false,
          name: 'field-line'
        });

        canvas.add(leftHash, rightHash);
      }
    }

    canvas.renderAll();
  };

  const initializeCanvas = (canvasId: string, width: number, height: number) => {
    const newCanvas = new fabric.Canvas(canvasId, {
      width,
      height,
      backgroundColor: '#FFFFFF',
      selection: true,
      preserveObjectStacking: true,
      isDrawingMode: false
    });

    initializeFootballField(newCanvas);
    setCanvas(newCanvas);
    canvasRef.current = newCanvas;

    // Save initial state to history
    const initialState = JSON.stringify(newCanvas.toJSON(['selectable', 'evented', 'name']));
    setHistory([initialState]);
    setHistoryIndex(0);

    // Add event listener for object modifications
    newCanvas.on('object:modified', saveToHistory);
    newCanvas.on('object:added', saveToHistory);
    newCanvas.on('object:removed', saveToHistory);

    // Set up mouse event listeners for drawing
    newCanvas.on('mouse:down', onMouseDown);
    newCanvas.on('mouse:move', onMouseMove);
    newCanvas.on('mouse:up', onMouseUp);

    return newCanvas;
  };

  const onMouseDown = (event: any) => {
    if (!canvas || !drawingMode) return;
    
    setIsDrawing(true);
    const pointer = canvas.getPointer(event.e);
    points.current = [{ x: pointer.x, y: pointer.y, pressure: event.e.pressure || 0.5 }];
  };

  const onMouseMove = (event: any) => {
    if (!canvas || !drawingMode || !isDrawing) return;
    
    const pointer = canvas.getPointer(event.e);
    points.current.push({ x: pointer.x, y: pointer.y, pressure: event.e.pressure || 0.5 });
    
    // Get canvas context
    const ctx = canvas.getContext();
    if (!ctx) return;

    // Draw the stroke
    const drawOptions: DrawOptions = {
      color: '#000000',
      size: 3,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5
    };

    drawStroke(ctx, points.current, drawOptions);
    canvas.renderAll();
  };

  const onMouseUp = () => {
    if (!canvas || !drawingMode || !isDrawing) return;
    
    // Create a path from the points
    if (points.current.length > 1) {
      const pathData = points.current.map((point, i) => {
        if (i === 0) return `M ${point.x} ${point.y}`;
        return `L ${point.x} ${point.y}`;
      }).join(' ');

      const path = new fabric.Path(pathData, {
        stroke: '#000000',
        strokeWidth: 3,
        fill: 'transparent',
        strokeLineCap: 'round',
        strokeLineJoin: 'round'
      });

      canvas.add(path);
      canvas.renderAll();
      saveToHistory();
    }
    
    setIsDrawing(false);
    points.current = [];
  };

  const toggleDrawingMode = () => {
    if (!canvas) return;
    
    const newMode = !drawingMode;
    setDrawingMode(newMode);
    canvas.selection = !newMode;
    canvas.forEachObject(obj => {
      obj.selectable = !newMode;
      obj.evented = !newMode;
    });
    canvas.renderAll();
  };

  const saveToHistory = () => {
    if (!canvas) return;

    const currentState = JSON.stringify(canvas.toJSON(['selectable', 'evented', 'name']));
    
    // If we're not at the end of the history, remove future states
    if (historyIndex < history.length - 1) {
      setHistory(history.slice(0, historyIndex + 1));
    }
    
    // Add new state to history
    setHistory(prevHistory => [...prevHistory, currentState]);
    setHistoryIndex(prevIndex => prevIndex + 1);
  };

  const undo = () => {
    if (!canvas || historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    
    const previousState = JSON.parse(history[newIndex]);
    canvas.loadFromJSON(previousState, canvas.renderAll.bind(canvas));
  };

  const redo = () => {
    if (!canvas || historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    
    const nextState = JSON.parse(history[newIndex]);
    canvas.loadFromJSON(nextState, canvas.renderAll.bind(canvas));
  };

  const clearCanvas = () => {
    if (!canvas) return;
    
    // Remove all objects except field lines
    const objects = canvas.getObjects().filter(obj => obj.name !== 'field-line');
    objects.forEach(obj => canvas.remove(obj));
    canvas.renderAll();
    
    // Save to history
    saveToHistory();
  };

  return {
    canvas,
    history,
    historyIndex,
    drawingMode,
    toggleDrawingMode,
    undo,
    redo,
    clearCanvas,
    initializeCanvas,
    saveToHistory
  };
}