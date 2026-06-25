import { onMount, onCleanup, createEffect } from "solid-js";

interface MinimapProps {
  content: string;
  viewportTop: number; // percentage
  viewportHeight: number; // percentage
  onScrollTo: (percent: number) => void;
}

export default function Minimap(props: MinimapProps) {
  let canvasRef: HTMLCanvasElement | undefined;

  const drawMinimap = () => {
    if (!canvasRef) return;
    const ctx = canvasRef.getContext("2d");
    if (!ctx) return;

    const width = canvasRef.width;
    const height = canvasRef.height;
    ctx.clearRect(0, 0, width, height);

    const lines = props.content.split("\n");
    const lineCount = lines.length;
    
    // Scale drawings to fit canvas
    const lineSpacing = Math.max(1, height / Math.max(100, lineCount));
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] || "";
      const leadingSpaces = line.search(/\S/);
      if (leadingSpaces === -1) continue; // Skip blank lines

      const lineTextLength = line.trim().length;
      const x = leadingSpaces * 0.8;
      const y = i * lineSpacing;
      const w = Math.min(width - x, lineTextLength * 1.5);
      
      // Draw simulated code line
      ctx.fillRect(x, y, w, Math.max(0.8, lineSpacing - 0.5));
    }
  };

  createEffect(() => {
    drawMinimap();
  });

  const handleMinimapClick = (e: MouseEvent) => {
    if (!canvasRef) return;
    const rect = canvasRef.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const percent = clickY / rect.height;
    props.onScrollTo(percent);
  };

  return (
    <div 
      class="hd-minimap"
      onClick={handleMinimapClick}
      style="width: 80px; height: 100%; position: relative; background: var(--bg-base); cursor: pointer;"
    >
      <canvas 
        ref={canvasRef} 
        width="80" 
        height="600" 
        style="width: 100%; height: 100%; display: block;"
      ></canvas>
      
      {/* Scroll Viewport Overlay */}
      <div 
        class="hd-minimap-viewport"
        style={{
          top: `${props.viewportTop}%`,
          height: `${props.viewportHeight}%`
        }}
      ></div>
    </div>
  );
}
