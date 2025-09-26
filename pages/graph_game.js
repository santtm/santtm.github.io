// Usa coordenadas absolutas (plano cartesiano) do JSON, normaliza, centraliza e desenha.
// Clique: mapeamento correto entre CSS pixels e canvas com devicePixelRatio.

let canvas, ctx;
let allGraphs = [];
let currentGraph = null;
let selectedNodes = new Set();
let nodePositions = []; // coordenadas em CSS pixels para desenho/interação
let hintGiven = false;
const nodeRadius = 15; // em CSS pixels
let messageBox;
let DPR = window.devicePixelRatio || 1;

document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('graphCanvas');
  messageBox = document.getElementById('message-box');
  ctx = canvas.getContext('2d');

  const verifyBtn = document.getElementById('verifyBtn');
  const newGraphBtn = document.getElementById('newGraphBtn');
  const hintBtn = document.getElementById('hintBtn');

  // ---- Helpers: ajuste DPR e bitmap do canvas ----
  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * DPR));
    const height = Math.max(1, Math.round(rect.height * DPR));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      // Faz com que usar coordenadas em "CSS pixels" funcione no ctx:
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

  // ---- Fetch dos grafos ----
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

  // ---- Geração de posições normalizadas e centralizadas ----
  // Aceita:
  // - graph.positions fornecido como { "0": {x,y}, "1": {x,y}, ... } em coordenadas cartesianas (Y para cima)
  // - se faltar índices, cria fallback circular para os faltantes
  function generateNodePositions(graph) {
    nodePositions = [];
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const margin = Math.max(16, nodeRadius * 3); // margem razoável em CSS pixels

    // se não houver positions, fallback circular
    if (!graph.positions || Object.keys(graph.positions).length === 0) {
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;
      for (let i = 0; i < graph.nodes; i++) {
        const angle = (i / Math.max(1, graph.nodes)) * Math.PI * 2;
        nodePositions.push({ x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle), scale: 1 });
      }
      return;
    }

    // positions fornecidas: coletar apenas as que existem
    const provided = {};
    const xs = [];
    const ys = [];
    Object.keys(graph.positions).forEach(k => {
      const idx = Number(k);
      const p = graph.positions[k];
      if (p && typeof p.x === 'number' && typeof p.y === 'number') {
        provided[idx] = { x: p.x, y: p.y };
        xs.push(p.x);
        ys.push(p.y);
      }
    });

    if (xs.length === 0 || ys.length === 0) {
      // fallback
      generateNodePositions({ nodes: graph.nodes });
      return;
    }

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    // escala uniforme para caber dentro do canvas com margem
    const scale = Math.min((width - 2 * margin) / rangeX, (height - 2 * margin) / rangeY);

    // centro geométrico dos pontos dados (em coordenadas absolutas)
    const centerX_world = (minX + maxX) / 2;
    const centerY_world = (minY + maxY) / 2;

    const canvasCenterX = width / 2;
    const canvasCenterY = height / 2;

    // Para índices que não tenham posição, cria pontos em círculo dentro da caixa normalizada
    const missing = [];
    for (let i = 0; i < graph.nodes; i++) {
      if (!(i in provided)) missing.push(i);
    }
    if (missing.length > 0) {
      // gerar pontos circulares na mesma escala e caixa para preencher
      const fillRadius = Math.min(width, height) * 0.25;
      for (let j = 0; j < missing.length; j++) {
        const i = missing[j];
        const angle = (j / Math.max(1, missing.length)) * Math.PI * 2;
        // mapeia para um "mundo" coordenada aproximada dentro [minX,maxX]x[minY,maxY]
        const tx = centerX_world + (Math.cos(angle) * (rangeX * 0.25));
        const ty = centerY_world + (Math.sin(angle) * (rangeY * 0.25));
        provided[i] = { x: tx, y: ty };
      }
    }

    // finalmente, normaliza todos os vértices para CSS pixels (Y invertido: plano cartesiano -> tela)
    for (let i = 0; i < graph.nodes; i++) {
      const p = provided[i];
      // proteção caso ainda falte
      const px = (p && typeof p.x === 'number') ? p.x : centerX_world;
      const py = (p && typeof p.y === 'number') ? p.y : centerY_world;

      // world -> canvas:
      const normX = (px - centerX_world) * scale + canvasCenterX;
      // Inverter Y: em JSON y cresce pra cima; no canvas y cresce pra baixo
      const normY = canvasCenterY - (py - centerY_world) * scale;

      nodePositions.push({ x: normX, y: normY, scale: 1 });
    }
  }

  // ---- Desenho ----
  function drawGraph() {
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // arestas
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

    // nós
    nodePositions.forEach((pos, index) => {
      const r = nodeRadius * (pos.scale || 1);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = selectedNodes.has(index) ? 'black' : 'white';
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.stroke();

      // destaque dos nós corretos quando resposta incorreta estiver visível
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

  // ---- Interação: clique (CSS pixels) ----
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

  // ---- Validação / dica / mensagens ----
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

  // ---- Inicializar novo jogo ----
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
    const idx = Math.floor(Math.random() * allGraphs.length);
    currentGraph = allGraphs[idx];
    generateNodePositions(currentGraph);
    drawGraph();
  }

  verifyBtn?.addEventListener('click', checkDominatingSet);
  newGraphBtn?.addEventListener('click', () => startNewGame());
  hintBtn?.addEventListener('click', giveHint);

  // start
  resizeCanvasToDisplaySize();
  fetchGraphData();
});
