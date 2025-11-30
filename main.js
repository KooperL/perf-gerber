const app = {
  gridSize: 20,
  gridWidth: 20,
  gridHeight: 20,
  spacing: 2.54,
  padRadius: 0.8,
  trackWidth: 0.5,
  layerCount: 1, // 1 or 2
  tool: 'topTrack', // 'bottomTrack', 'topTrack', 'drill', 'pan'
  toolMode: 'add', // 'add' or 'remove'
  showBottomLayer: true,
  showTopLayer: true,
  bottomTracks: [],
  topTracks: [],
  drills: new Set(), // Store drill positions as "row,col" strings
  startPad: null,
  canvas: null,
  ctx: null,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isPanning: false,
  lastPanX: 0,
  lastPanY: 0,

  init() {
    this.canvas = document.getElementById('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.setupEvents();
    this.updateGrid();
    const layers = document.querySelector('input[name="layerCount"]:checked').value;
    this.setLayerCount(+layers);
    
    // Disable context menu globally
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  applyGrid() {
    const layers = document.querySelector('input[name="layerCount"]:checked').value;
    this.setLayerCount(+layers);
    this.clearAll();
    this.updateGrid();
    console.log('layers')
  },

  updateGrid() {
    this.gridWidth = parseInt(document.getElementById('gridWidth').value);
    this.gridHeight = parseInt(document.getElementById('gridHeight').value);
    this.spacing = parseFloat(document.getElementById('spacing').value);
    
    const padding = 40;
    const availableWidth = this.canvas.parentElement.clientWidth - padding * 2;
    const availableHeight = this.canvas.parentElement.clientHeight - padding * 2;
    
    // Ensure minimum dimensions
    if (availableWidth <= 0 || availableHeight <= 0) {
      return;
    }
    
    const boardWidthMM = (this.gridWidth - 1) * this.spacing;
    const boardHeightMM = (this.gridHeight - 1) * this.spacing;
    
    const scaleX = availableWidth / boardWidthMM;
    const scaleY = availableHeight / boardHeightMM;
    this.scale = Math.min(scaleX, scaleY);
    
    // Ensure minimum scale
    if (this.scale <= 0) {
      this.scale = 1;
    }
    
    this.canvas.width = boardWidthMM * this.scale + padding * 2;
    this.canvas.height = boardHeightMM * this.scale + padding * 2;
    
    this.offsetX = padding;
    this.offsetY = padding;
    this.updateStats();
    this.render();
  },

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.updateGrid());
  },

  handleMouseDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isRightClick = e.button === 2;
    
    if (this.tool === 'pan') {
      this.isPanning = true;
      this.lastPanX = x;
      this.lastPanY = y;
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    const pad = this.getPadAtPosition(x, y);
    if (!pad) return;

    if (this.tool === 'bottomTrack' || this.tool === 'topTrack') {
      const layer = this.tool === 'bottomTrack' ? 'bottom' : 'top';
      if (isRightClick) {
        // Right click = erase from layer
        this.removeTracksAtPad(pad, layer);
        this.render();
        this.updateStats();
      } else {
        // Left click = draw on layer
        this.startPad = pad;
      }
    } else if (this.tool === 'drill') {
      if (isRightClick) {
        // Right click = remove drill
        this.removeDrill(pad);
      } else {
        // Left click = toggle/add drill
        this.toggleDrill(pad);
      }
      this.render();
      this.updateStats();
    }
  },

  handleMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (this.isPanning && this.tool === 'pan') {
      const dx = x - this.lastPanX;
      const dy = y - this.lastPanY;
      this.offsetX += dx;
      this.offsetY += dy;
      this.lastPanX = x;
      this.lastPanY = y;
      this.render();
      return;
    }

    const pad = this.getPadAtPosition(x, y);
    if (pad) {
      document.getElementById('mousePos').textContent = `${pad.col}, ${pad.row}`;
    }

    if (this.startPad && (this.tool === 'bottomTrack' || this.tool === 'topTrack')) {
      this.render();
      if (pad && (pad.row !== this.startPad.row || pad.col !== this.startPad.col)) {
        this.drawPreviewTrack(this.startPad, pad);
      }
    }
  },

  handleMouseUp(e) {
    if (this.tool === 'pan') {
      this.isPanning = false;
      this.canvas.style.cursor = 'crosshair';
      return;
    }

    if (!this.startPad || (this.tool !== 'bottomTrack' && this.tool !== 'topTrack')) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const endPad = this.getPadAtPosition(x, y);

    if (endPad && (endPad.row !== this.startPad.row || endPad.col !== this.startPad.col)) {
      const layer = this.tool === 'bottomTrack' ? 'bottom' : 'top';
      this.addTrack(this.startPad, endPad, layer);
      this.updateStats();
    }

    this.startPad = null;
    this.render();
  },

  getPadAtPosition(x, y) {
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const px = this.offsetX + col * this.spacing * this.scale;
        const py = this.offsetY + row * this.spacing * this.scale;
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < this.padRadius * this.scale * 1.5) {
          return { row, col };
        }
      }
    }
    return null;
  },

  addTrack(pad1, pad2, layer) {
    const tracks = layer === 'bottom' ? this.bottomTracks : this.topTracks;
    const exists = tracks.some(t =>
      (t.start.row === pad1.row && t.start.col === pad1.col &&
       t.end.row === pad2.row && t.end.col === pad2.col) ||
      (t.start.row === pad2.row && t.start.col === pad2.col &&
       t.end.row === pad1.row && t.end.col === pad1.col)
    );
    
    if (!exists) {
      tracks.push({ start: pad1, end: pad2 });
    }
  },

  removeTracksAtPad(pad, layer) {
    if (layer === 'bottom') {
      this.bottomTracks = this.bottomTracks.filter(t =>
        !(t.start.row === pad.row && t.start.col === pad.col) &&
        !(t.end.row === pad.row && t.end.col === pad.col)
      );
    } else {
      this.topTracks = this.topTracks.filter(t =>
        !(t.start.row === pad.row && t.start.col === pad.col) &&
        !(t.end.row === pad.row && t.end.col === pad.col)
      );
    }
  },

  toggleDrill(pad) {
    const key = `${pad.row},${pad.col}`;
    if (this.drills.has(key)) {
      this.drills.delete(key);
    } else {
      this.drills.add(key);
    }
  },

  removeDrill(pad) {
    const key = `${pad.row},${pad.col}`;
    this.drills.delete(key);
  },

  render() {
    const ctx = this.ctx;
    
    // Safety check for canvas dimensions
    if (this.canvas.width <= 0 || this.canvas.height <= 0 || this.scale <= 0) {
      return;
    }
    
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#1a2332';
    ctx.lineWidth = 1;
    for (let i = 0; i < this.gridWidth; i++) {
      const pos = this.offsetX + i * this.spacing * this.scale;
      ctx.beginPath();
      ctx.moveTo(pos, this.offsetY);
      ctx.lineTo(pos, this.offsetY + (this.gridHeight - 1) * this.spacing * this.scale);
      ctx.stroke();
    }
    for (let i = 0; i < this.gridHeight; i++) {
      const posY = this.offsetY + i * this.spacing * this.scale;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, posY);
      ctx.lineTo(this.offsetX + (this.gridWidth - 1) * this.spacing * this.scale, posY);
      ctx.stroke();
    }

    // Draw bottom layer tracks
    if (this.showBottomLayer) {
      ctx.strokeStyle = '#a855f7'; // Purple
      ctx.lineWidth = this.trackWidth * this.scale;
      ctx.lineCap = 'round';
      
      this.bottomTracks.forEach(track => {
        const x1 = this.offsetX + track.start.col * this.spacing * this.scale;
        const y1 = this.offsetY + track.start.row * this.spacing * this.scale;
        const x2 = this.offsetX + track.end.col * this.spacing * this.scale;
        const y2 = this.offsetY + track.end.row * this.spacing * this.scale;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    }

    // Draw top layer tracks
    if (this.showTopLayer) {
      ctx.strokeStyle = '#ff8800'; // Orange
      ctx.lineWidth = this.trackWidth * this.scale;
      ctx.lineCap = 'round';
      
      this.topTracks.forEach(track => {
        const x1 = this.offsetX + track.start.col * this.spacing * this.scale;
        const y1 = this.offsetY + track.start.row * this.spacing * this.scale;
        const x2 = this.offsetX + track.end.col * this.spacing * this.scale;
        const y2 = this.offsetY + track.end.row * this.spacing * this.scale;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      });
    }

    // Draw pads
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const x = this.offsetX + col * this.spacing * this.scale;
        const y = this.offsetY + row * this.spacing * this.scale;
        
        const isDrill = this.drills.has(`${row},${col}`);
        
        // Draw pad
        ctx.fillStyle = '#c0c8d0';
        ctx.beginPath();
        ctx.arc(x, y, this.padRadius * this.scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw hole or drill indicator
        if (isDrill) {
          // Marked drill - show with accent color
          ctx.fillStyle = '#00ff88';
          ctx.beginPath();
          ctx.arc(x, y, (this.padRadius * 0.5) * this.scale, 0, Math.PI * 2);
          ctx.fill();
          
          // Add extra ring to make it more visible
          ctx.strokeStyle = '#00ff88';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, (this.padRadius * 0.7) * this.scale, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          // Regular hole
          ctx.fillStyle = '#0a0e14';
          ctx.beginPath();
          ctx.arc(x, y, (this.padRadius * 0.4) * this.scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },

  drawPreviewTrack(pad1, pad2) {
    const ctx = this.ctx;
    const x1 = this.offsetX + pad1.col * this.spacing * this.scale;
    const y1 = this.offsetY + pad1.row * this.spacing * this.scale;
    const x2 = this.offsetX + pad2.col * this.spacing * this.scale;
    const y2 = this.offsetY + pad2.row * this.spacing * this.scale;
    
    ctx.strokeStyle = this.tool === 'bottomTrack' ? '#a855f7' : '#ff8800';
    ctx.lineWidth = this.trackWidth * this.scale;
    ctx.lineCap = 'round';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
  },

  setToolMode(tool, mode) {
    this.tool = tool;
    this.toolMode = mode;
    
    // Update tool selector highlights
    document.querySelectorAll('.tool-selector').forEach(sel => sel.classList.remove('active'));
    
    if (tool === 'bottomTrack') {
      document.getElementById('bottomTrackSelector').classList.add('active');
    } else if (tool === 'topTrack') {
      document.getElementById('topTrackSelector').classList.add('active');
    } else if (tool === 'drill') {
      document.getElementById('drillSelector').classList.add('active');
    } else if (tool === 'pan') {
      document.getElementById('panSelector').classList.add('active');
    }
    
    // Update status display
    const toolNames = {
      'bottomTrack': mode === 'add' ? 'DRAW BOTTOM TRACK' : 'ERASE BOTTOM TRACK',
      'topTrack': mode === 'add' ? 'DRAW TOP TRACK' : 'ERASE TOP TRACK',
      'drill': mode === 'add' ? 'MARK DRILL' : 'ERASE DRILL',
      'pan': 'PAN VIEW'
    };
    
    document.getElementById('currentTool').textContent = toolNames[tool] || tool.toUpperCase();
    this.canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
  },

  togglePanel(side) {
    const container = document.getElementById('container');
    const toggleBtn = document.getElementById(side === 'left' ? 'toggleLeft' : 'toggleRight');
    const sidebar = document.getElementById(side === 'left' ? 'leftSidebar' : 'rightSidebar');
    
    if (side === 'left') {
      container.classList.toggle('left-collapsed');
      toggleBtn.classList.toggle('collapsed');
      sidebar.classList.toggle('collapsed');
      toggleBtn.textContent = container.classList.contains('left-collapsed') ? '▶' : '◀';
    } else {
      container.classList.toggle('right-collapsed');
      toggleBtn.classList.toggle('collapsed');
      sidebar.classList.toggle('collapsed');
      toggleBtn.textContent = container.classList.contains('right-collapsed') ? '◀' : '▶';
    }
    
    // Re-render canvas after panel toggle
    setTimeout(() => this.updateGrid(), 300);
  },

  updateStats() {
    document.getElementById('bottomTrackCount').textContent = this.bottomTracks.length;
    document.getElementById('topTrackCount').textContent = this.topTracks.length;
    document.getElementById('drillCount').textContent = this.drills.size;
    const widthMM = ((this.gridWidth - 1) * this.spacing + 4).toFixed(2);
    const heightMM = ((this.gridHeight - 1) * this.spacing + 4).toFixed(2);
    document.getElementById('boardDims').textContent = `${widthMM} × ${heightMM} mm`;
    document.getElementById('resolution').textContent = `${this.gridWidth} × ${this.gridHeight}`;
  },

  clearAll() {
    if (confirm('Clear all tracks and drill marks?')) {
      this.bottomTracks = [];
      this.topTracks = [];
      this.drills.clear();
      this.render();
      this.updateStats();
    }
  },

  drillAllHoles() {
    // Mark all holes for drilling
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        this.drills.add(`${row},${col}`);
      }
    }
    this.render();
    this.updateStats();
  },

  toggleLayerVisibility(layer) {
    if (layer === 'bottom') {
      this.showBottomLayer = document.getElementById('showBottom').checked;
    } else {
      this.showTopLayer = document.getElementById('showTop').checked;
    }
    this.render();
  },

  setLayerCount(count) {
    this.layerCount = count;
    
    // Hide/show bottom layer controls and tool based on layer count
    const bottomTrackSelector = document.getElementById('bottomTrackSelector');
    const bottomTrackInfoSelector = document.getElementById('info-bottom-track');
    const showBottomToggle = document.getElementById('showBottom').parentElement;
    const exportLayers = document.getElementById('exportLayers');
    
    if (count === 1) {
      // Single layer - hide bottom controls
      bottomTrackSelector.style.display = 'none';
      showBottomToggle.style.display = 'none';
      bottomTrackInfoSelector.style.display = 'none';
      
      // Update export info to show only top layer
      exportLayers.innerHTML = '• Top copper (.gtl)<br>';
      
      // If currently on bottom track tool, switch to top track
      if (this.tool === 'bottomTrack') {
        this.setToolMode('topTrack', 'add');
      }
    } else {
      // Double layer - show bottom controls
      bottomTrackSelector.style.display = 'flex';
      showBottomToggle.style.display = 'flex';
      
      // Update export info to show both layers
      exportLayers.innerHTML = '• Bottom copper (.gbl)<br>• Top copper (.gtl)<br>';
    }
  },

  exportGerberZip() {
    // Warn if no drills are marked
    if (this.drills.size === 0) {
      if (!confirm('Warning: No drill holes are marked! The drill file will be empty.\n\nContinue with export?')) {
        return;
      }
    }
    
    const zip = new JSZip();
    const projectName = `perfboard_${this.gridWidth}x${this.gridHeight}`;
    
    // Add top copper layer (always present)
    zip.file(`${projectName}.gtl`, this.generateCopperLayer('top'));
    
    // Add bottom copper layer only if 2-layer board
    if (this.layerCount === 2) {
      zip.file(`${projectName}.gbl`, this.generateCopperLayer('bottom'));
    }
    
    // Add drill file
    zip.file(`${projectName}.drl`, this.generateDrillFile());
    
    // Add board outline
    zip.file(`${projectName}.gko`, this.generateBoardOutline());
    
    // Add readme
    zip.file('README.txt', this.generateReadme());
    
    // Generate and download zip
    zip.generateAsync({type: 'blob'}).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_gerber.zip`;
      a.click();
      URL.revokeObjectURL(url);
    });
  },

  generateCopperLayer(layer) {
    // Gerber RS-274X format
    let gerber = '';
    const layerName = layer === 'bottom' ? 'Bottom' : 'Top';
    const tracks = layer === 'bottom' ? this.bottomTracks : this.topTracks;
    
    // Header
    gerber += `G04 PerfBoard Designer - ${layerName} Copper Layer*\n`;
    gerber += `G04 Board: ${this.gridWidth}x${this.gridHeight} @ ${this.spacing}mm spacing*\n`;
    gerber += '%FSLAX36Y36*%\n';
    gerber += '%MOMM*%\n';
    
    // Aperture definitions
    gerber += `%ADD10C,${(this.padRadius * 2).toFixed(4)}*%\n`; // Pad
    gerber += `%ADD11C,${this.trackWidth.toFixed(4)}*%\n`; // Track
    
    // Set units and format
    gerber += 'G01*\n';
    gerber += 'G75*\n';
    gerber += '%LPD*%\n';
    
    // Draw all pads
    gerber += 'G54D10*\n';
    for (let row = 0; row < this.gridHeight; row++) {
      for (let col = 0; col < this.gridWidth; col++) {
        const x = (col * this.spacing * 1000000).toFixed(0);
        const y = (row * this.spacing * 1000000).toFixed(0);
        gerber += `X${x}Y${y}D03*\n`;
      }
    }
    
    // Draw tracks
    gerber += 'G54D11*\n';
    tracks.forEach(track => {
      const x1 = (track.start.col * this.spacing * 1000000).toFixed(0);
      const y1 = (track.start.row * this.spacing * 1000000).toFixed(0);
      const x2 = (track.end.col * this.spacing * 1000000).toFixed(0);
      const y2 = (track.end.row * this.spacing * 1000000).toFixed(0);
      
      gerber += `X${x1}Y${y1}D02*\n`;
      gerber += `X${x2}Y${y2}D01*\n`;
    });
    
    // Footer
    gerber += 'M02*\n';
    
    return gerber;
  },

  generateDrillFile() {
    // Excellon drill format
    let drill = '';
    
    // Header
    drill += 'M48\n';
    drill += '; PerfBoard Designer - Drill File\n';
    drill += `; Board: ${this.gridWidth}x${this.gridHeight} @ ${this.spacing}mm spacing\n`;
    drill += `; Marked drill points: ${this.drills.size}\n`;
    drill += 'METRIC,TZ\n';
    
    // Tool definition - standard perfboard hole size
    const holeDiameter = (this.padRadius * 2 * 0.5).toFixed(4); // 50% of pad diameter
    drill += `T1C${holeDiameter}\n`;
    drill += '%\n';
    
    // Select tool
    drill += 'T1\n';
    
    // Drill only marked holes
    this.drills.forEach(key => {
      const [row, col] = key.split(',').map(Number);
      const x = (col * this.spacing).toFixed(4);
      const y = (row * this.spacing).toFixed(4);
      drill += `X${x}Y${y}\n`;
    });
    
    // End of program
    drill += 'M30\n';
    
    return drill;
  },

  generateBoardOutline() {
    // Gerber RS-274X format - Board Outline
    let gerber = '';
    
    // Header
    gerber += 'G04 PerfBoard Designer - Board Outline*\n';
    gerber += '%FSLAX36Y36*%\n';
    gerber += '%MOMM*%\n';
    
    // Aperture for outline
    gerber += '%ADD10C,0.1000*%\n'; // 0.1mm line width
    
    // Set units and format
    gerber += 'G01*\n';
    gerber += 'G75*\n';
    gerber += '%LPD*%\n';
    gerber += 'G54D10*\n';
    
    // Calculate board dimensions with margin
    const margin = 2; // 2mm margin around outer pads
    const boardWidth = (this.gridWidth - 1) * this.spacing + margin * 2;
    const boardHeight = (this.gridHeight - 1) * this.spacing + margin * 2;
    const offsetX = -margin;
    const offsetY = -margin;
    
    // Draw rectangle outline
    const x1 = (offsetX * 1000000).toFixed(0);
    const y1 = (offsetY * 1000000).toFixed(0);
    const x2 = ((offsetX + boardWidth) * 1000000).toFixed(0);
    const y2 = ((offsetY + boardHeight) * 1000000).toFixed(0);
    
    // Move to start
    gerber += `X${x1}Y${y1}D02*\n`;
    // Draw rectangle
    gerber += `X${x2}Y${y1}D01*\n`;
    gerber += `X${x2}Y${y2}D01*\n`;
    gerber += `X${x1}Y${y2}D01*\n`;
    gerber += `X${x1}Y${y1}D01*\n`;
    
    // Footer
    gerber += 'M02*\n';
    
    return gerber;
  },

  generateReadme() {
    const boardWidthMM = ((this.gridWidth - 1) * this.spacing + 4).toFixed(2);
    const boardHeightMM = ((this.gridHeight - 1) * this.spacing + 4).toFixed(2);
    
    const layerDescription = this.layerCount === 1 
      ? 'Single-sided board (top copper only)'
      : 'Double-sided board (top and bottom copper)';
    
    const filesIncluded = this.layerCount === 1
      ? `- .gtl - Top copper layer (orange traces and pads)
- .drl - Excellon drill file (marked hole positions only)
- .gko - Board outline (cutting edge)`
      : `- .gbl - Bottom copper layer (purple traces and pads)
- .gtl - Top copper layer (orange traces and pads)
- .drl - Excellon drill file (marked hole positions only)
- .gko - Board outline (cutting edge)`;

    const platingNote = this.layerCount === 1
      ? '- Hole plating optional'
      : '- Hole plating REQUIRED for double-sided functionality';

    const platingInstruction = this.layerCount === 1
      ? ''
      : '\n5. IMPORTANT: Select "plated through holes" option';
    
    return `PerfBoard Designer - Gerber Export
========================================

Board Specifications:
- Grid Size: ${this.gridWidth} × ${this.gridHeight} holes
- Hole Spacing: ${this.spacing}mm
- Board Dimensions: ${boardWidthMM}mm × ${boardHeightMM}mm (with 2mm margin)
- Pad Diameter: ${(this.padRadius * 2).toFixed(2)}mm
- Hole Diameter: ${(this.padRadius * 2 * 0.5).toFixed(2)}mm
- Track Width: ${this.trackWidth.toFixed(2)}mm
- Layer Count: ${this.layerCount}
- Bottom Tracks: ${this.bottomTracks.length}
- Top Tracks: ${this.topTracks.length}
- Drill Points: ${this.drills.size} (only marked holes)

Files Included:
${filesIncluded}

Manufacturing Notes:
- All files use metric units (mm)
- Format: RS-274X (Gerber) and Excellon (drill)
- ${layerDescription}
- Standard FR4 substrate recommended
${platingNote}
- Only holes marked with "Mark Drills" tool will be drilled
- All pads are present on copper layers

Import Instructions:
1. Upload all files to your PCB manufacturer's website
2. Verify board dimensions and layer count (${this.layerCount} layer${this.layerCount > 1 ? 's' : ''})
3. Select desired board thickness (typically 1.6mm)
4. Choose surface finish (HASL, ENIG, etc.)${platingInstruction}
6. Review preview before ordering

Generated by PerfBoard Designer v1.0
`;
  },

  exportPNG() {
    const link = document.createElement('a');
    link.download = `perfboard_${this.gridWidth}x${this.gridHeight}.png`;
    link.href = this.canvas.toDataURL();
    link.click();
  }
};

window.addEventListener('DOMContentLoaded', () => app.init());