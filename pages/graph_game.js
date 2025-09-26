// src/graph_game.js

let canvas, ctx;
let allGraphs = [];
let currentGraph = null;
let currentIndex = -1;
let selectedNodes = new Set();
let nodePositions = [];
let hintGiven = false;
const nodeRadius = 15;
let messageBox;
let DPR = window.devicePixelRatio || 1;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('graphCanvas');
  messageBox = document.getElementById('message-box');
  ctx = canvas.getContext('2d');

  const verifyBtn = document.getElementById('verifyBtn');
  const newGraphBtn = document.getElementById('newGraphBtn');
  const hintBtn = document.getElementById('hintBtn');

  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * DPR));
    const height = Math.max(1, Math.round(rect.height * DPR));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  window.addEventListener('resize', () => {
    resizeCanvasToDisplaySize();
    if (currentGraph) {
      generateNodePositions(currentGraph);
      drawGraph();
    }
  });

  async function fetchGraphData() {
    try {
      const res = await fetch('../src/grafos.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      allGraphs = await res.json();
      if (!Array.isArray(allGraphs) || allGraphs.length === 0) {
        throw new Error('Arquivo de grafos vazio ou inválido');
      }
      startNewGame();
    } catch (err) {
      console.error('Erro ao carregar grafos:', err);
      showMessage('Erro ao carregar o jogo. Tente recarregar a página.', 'incorrect');
      disableControls(true);
    }
  }

  function disableControls(flag) {
    [verifyBtn, newGraphBtn, hintBtn].forEach(b => {
      if (b) {
        b.disabled = !!flag;
        b.classList.remove('active');
        b.blur();
      }
    });
  }

  function generateNodePositions(graph) {
    nodePositions = [];
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const margin = Math.max(16, nodeRadius * 3);

    if (!graph.positions || Object.keys(graph.positions).length === 0) {
      // fallback circular
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;
      for (let i = 0; i < graph.nodes; i++) {
        const angle = (i / Math.max(1, graph.nodes)) * Math.PI * 2;
        nodePositions.push({
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          scale: 1
        });
      }
      return;
    }

    const xs = Object.values(graph.positions).map(p => p.x);
    const ys = Object.values(graph.positions).map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min(
      (width - 2 * margin) / rangeX,
      (height - 2 * margin) / rangeY
    );

    const centerX_world = (minX + maxX) / 2;
    const centerY_world = (minY + maxY) / 2;
    const canvasCenterX = width / 2;
    const canvasCenterY = height / 2;

    for (let i = 0; i < graph.nodes; i++) {
      const p = graph.positions[i] || { x: 0, y: 0 };
      const normX = (p.x - centerX_world) * scale + canvasCenterX;
      const normY = (p.y - centerY_world) * scale + canvasCenterY;
      nodePositions.push({ x: normX, y: normY, scale: 1 });
    }
  }

  function drawGraph() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    if (currentGraph && currentGraph.adjList) {
      for (const [nodeKey, neighbors] of Object.entries(currentGraph.adjList)) {
        const iNode = Number(nodeKey);
        const A = nodePositions[iNode];
        if (!A) continue;
        (neighbors || []).forEach(n => {
          const j = Number(n);
          const B = nodePositions[j];
          if (typeof j === 'number' && j > iNode && B) {
            ctx.beginPath();
            ctx.moveTo(A.x, A.y);
            ctx.lineTo(B.x, B.y);
            ctx.stroke();
          }
        });
      }
    }

    nodePositions.forEach((pos, index) => {
      const r = nodeRadius * (pos.scale || 1);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = selectedNodes.has(index) ? 'black' : 'white';
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (messageBox.classList.contains('incorrect') && currentGraph?.minDominatingSets) {
        const minSize = Math.min(...currentGraph.minDominatingSets.map(s => s.length));
        const correctSet = currentGraph.minDominatingSets.find(s => s.length === minSize) || [];
        if (correctSet.includes(index)) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    });
  }

  function animateClick(nodeId) {
    const totalFrames = 10;
    let frame = 0;
    const original = nodePositions[nodeId].scale || 1;
    function step() {
      frame++;
      const t = Math.sin((frame / totalFrames) * Math.PI);
      nodePositions[nodeId].scale = 1 + 0.18 * t;
      drawGraph();
      if (frame < totalFrames) requestAnimationFrame(step);
      else {
        nodePositions[nodeId].scale = original;
        drawGraph();
      }
    }
    step();
  }

  function toggleNode(nodeId) {
    if (selectedNodes.has(nodeId)) selectedNodes.delete(nodeId);
    else selectedNodes.add(nodeId);
    clearMessage();
    animateClick(nodeId);
  }

  canvas.addEventListener('click', (ev) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = ev.clientX - rect.left;
    const mouseY = ev.clientY - rect.top;

    for (let i = 0; i < nodePositions.length; i++) {
      const pos = nodePositions[i];
      const r = nodeRadius * (pos.scale || 1);
      const dx = mouseX - pos.x;
      const dy = mouseY - pos.y;
      if (dx * dx + dy * dy <= r * r) {
        toggleNode(i);
        return;
      }
    }
  });

  function checkDominatingSet(e) {
    if (e) { e.preventDefault(); e.currentTarget?.blur(); e.currentTarget?.classList.remove('active'); }
    if (!currentGraph) { showMessage('Grafo não carregado.', 'incorrect'); return; }
    const user = Array.from(selectedNodes).sort((a, b) => a - b);
    const ok = (currentGraph.minDominatingSets || []).some(minSet => {
      return minSet.length === user.length && minSet.every(n => user.includes(n));
    });
    if (ok) showMessage('Parabéns! Você encontrou um Conjunto Dominante Mínimo!', 'correct');
    else { showMessage('Resposta incorreta. O conjunto selecionado não é um dominante mínimo.', 'incorrect'); drawGraph(); }
  }

  function giveHint(e) {
    if (e) { e.preventDefault(); e.currentTarget?.blur(); e.currentTarget?.classList.remove('active'); }
    if (!currentGraph?.minDominatingSets) { showMessage('Sem dados para dica.', 'hint'); return; }
    if (!hintGiven) {
      const minSize = Math.min(...currentGraph.minDominatingSets.map(s => s.length));
      showMessage(`A cardinalidade do conjunto dominante mínimo é: ${minSize}.`, 'hint');
      hintGiven = true;
    }
  }

  function showMessage(text, type) {
    messageBox.className = '';
    messageBox.textContent = text;
    void messageBox.offsetWidth;
    messageBox.classList.add('show');
    if (type) messageBox.classList.add(type);
  }
  function clearMessage() { messageBox.textContent = ''; messageBox.className = ''; }

  function startNewGame() {
    [verifyBtn, newGraphBtn, hintBtn].forEach(b => { b?.classList.remove('active'); b?.blur(); });
    resizeCanvasToDisplaySize();
    hintGiven = false;
    selectedNodes.clear();
    clearMessage();

    if (!Array.isArray(allGraphs) || allGraphs.length === 0) {
      showMessage('Sem grafos disponíveis', 'incorrect');
      return;
    }

    // sortear um índice diferente do atual
    let idx;
    if (allGraphs.length === 1) {
      idx = 0;
    } else {
      do {
        idx = Math.floor(Math.random() * allGraphs.length);
      } while (idx === currentIndex);
    }
    currentIndex = idx;
    currentGraph = allGraphs[idx];

    generateNodePositions(currentGraph);
    drawGraph();
  }

  verifyBtn?.addEventListener('click', checkDominatingSet);
  newGraphBtn?.addEventListener('click', () => startNewGame());
  hintBtn?.addEventListener('click', giveHint);

  resizeCanvasToDisplaySize();
  fetchGraphData();
});
