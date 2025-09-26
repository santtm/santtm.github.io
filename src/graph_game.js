// src/graph_game.js

// Estado global
let canvas, ctx;
let allGraphs = [];
let currentGraph = null;
let selectedNodes = new Set();
let nodePositions = []; // posição em CSS pixels
let hintGiven = false;
const nodeRadius = 15; // em CSS pixels
let messageBox;
let DPR = window.devicePixelRatio || 1;

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('graphCanvas');
  messageBox = document.getElementById('message-box');

  // Cria contexto 2D e ajusta resolução do canvas conforme exibição
  ctx = canvas.getContext('2d');

  // Seletores de botão
  const verifyBtn = document.getElementById('verifyBtn');
  const newGraphBtn = document.getElementById('newGraphBtn');
  const hintBtn = document.getElementById('hintBtn');

  // Ajusta tamanho interno do bitmap do canvas ao tamanho exibido (e ao DPR)
  function resizeCanvasToDisplaySize() {
    const rect = canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * DPR));
    const height = Math.max(1, Math.round(rect.height * DPR));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      // faz com que desenhos a seguir se comportem em CSS pixels:
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
  }

  // Fazer resize quando janela mudar
  window.addEventListener('resize', () => {
    // recalcula e regenera posições (posições dependem do tamanho do canvas)
    resizeCanvasToDisplaySize();
    if (currentGraph) {
      generateNodePositions(currentGraph.nodes);
      drawGraph();
    }
  });

  // Buscar dados dos grafos
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
      // desabilitar botões caso existam
      disableControls(true);
    }
  }

  // Habilita/desabilita botões e remove foco/active visual
  function disableControls(flag) {
    const btns = [verifyBtn, newGraphBtn, hintBtn].filter(Boolean);
    btns.forEach(b => {
      b.disabled = !!flag;
      // remove foco visual
      b.classList.remove('active');
      b.blur();
    });
  }

  // Gera posições dos nós em CSS pixels (com base no tamanho exibido do canvas)
  function generateNodePositions(numNodes) {
    nodePositions = [];
    // obter tamanho em CSS pixels
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35; // relativo ao espaço

    for (let i = 0; i < numNodes; i++) {
      const angle = (i / numNodes) * Math.PI * 2;
      nodePositions.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        scale: 1 // escala para animação
      });
    }
  }

  // Desenha grafo: arestas + nós (usando coordenadas em CSS pixels)
  function drawGraph() {
    // limpar (coord em CSS pixels porque setTransform foi ajustado)
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // arestas
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    if (currentGraph && currentGraph.adjList) {
      for (const [nodeKey, neighbors] of Object.entries(currentGraph.adjList)) {
        const iNode = Number(nodeKey);
        const startPos = nodePositions[iNode];
        if (!startPos) continue;
        neighbors.forEach(n => {
          const j = Number(n);
          if (iNode < j && nodePositions[j]) {
            const endPos = nodePositions[j];
            ctx.beginPath();
            ctx.moveTo(startPos.x, startPos.y);
            ctx.lineTo(endPos.x, endPos.y);
            ctx.stroke();
          }
        });
      }
    }

    // nós
    nodePositions.forEach((pos, index) => {
      const r = nodeRadius * pos.scale;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);

      // preenchimento conforme seleção
      ctx.fillStyle = selectedNodes.has(index) ? 'black' : 'white';
      ctx.fill();
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.stroke();

      // se mensagem incorreta estiver visível, destaca nós do conjunto correto
      if (messageBox.classList.contains('incorrect') && currentGraph && Array.isArray(currentGraph.minDominatingSets)) {
        const minSize = Math.min(...currentGraph.minDominatingSets.map(s => s.length));
        // pega um conjunto mínimo (se existirem vários, pega o primeiro com esse tamanho)
        const correct = currentGraph.minDominatingSets.find(s => s.length === minSize) || [];
        if (correct.includes(index)) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
          ctx.strokeStyle = 'red';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }
    });
  }

  // animação curta ao clicar no nó
  function animateClick(nodeId) {
    const totalFrames = 10;
    let frame = 0;
    const original = nodePositions[nodeId].scale || 1;
    function step() {
      frame++;
      // efeito pop: sobe e volta
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

  // alterna seleção do nó
  function toggleNode(nodeId) {
    if (selectedNodes.has(nodeId)) selectedNodes.delete(nodeId);
    else selectedNodes.add(nodeId);
    clearMessage();
    animateClick(nodeId);
  }

  // handler de clique no canvas
  canvas.addEventListener('click', (ev) => {
    // coords em CSS pixels
    const rect = canvas.getBoundingClientRect();
    const mouseX = ev.clientX - rect.left;
    const mouseY = ev.clientY - rect.top;

    // percorre nós e checa distância com raio correto (considera escala do nó)
    for (let i = 0; i < nodePositions.length; i++) {
      const pos = nodePositions[i];
      const r = nodeRadius * (pos.scale || 1);
      const dx = mouseX - pos.x;
      const dy = mouseY - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= r) {
        toggleNode(i);
        // interrompe ao encontrar o nó clicado (evita múltiplas seleções)
        return;
      }
    }
  });

  // valida se seleção é conjunto dominante mínimo
  function checkDominatingSet(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    // deleção de foco/visual pressed
    if (e && e.currentTarget) {
      e.currentTarget.classList.remove('active');
      setTimeout(() => e.currentTarget.blur(), 0);
    }

    if (!currentGraph) {
      showMessage('Grafo não carregado.', 'incorrect');
      return;
    }
    const user = Array.from(selectedNodes).sort((a, b) => a - b);
    const ok = (currentGraph.minDominatingSets || []).some(minSet => {
      if (minSet.length !== user.length) return false;
      return minSet.every(n => user.includes(n));
    });

    if (ok) showMessage('Parabéns! Você encontrou um Conjunto Dominante Mínimo!', 'correct');
    else {
      showMessage('Resposta incorreta. O conjunto selecionado não é um dominante mínimo.', 'incorrect');
      // redesenha para destacar (drawGraph já usa messageBox.classList)
      drawGraph();
    }
  }

  // dica: mostra cardinalidade mínima
  function giveHint(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (e && e.currentTarget) {
      e.currentTarget.classList.remove('active');
      setTimeout(() => e.currentTarget.blur(), 0);
    }

    if (!currentGraph || !Array.isArray(currentGraph.minDominatingSets)) {
      showMessage('Sem dados para dica.', 'hint');
      return;
    }
    if (!hintGiven) {
      const minSize = Math.min(...currentGraph.minDominatingSets.map(s => s.length));
      showMessage(`A cardinalidade do conjunto dominante mínimo é: ${minSize}.`, 'hint');
      hintGiven = true;
    }
  }

  // mostra mensagem no box (não altera layout)
  function showMessage(text, type) {
    // limpa classes antigas e seta novas
    messageBox.className = ''; // limpa tudo
    messageBox.textContent = text;
    // força reflow visual: aplicar classes
    void messageBox.offsetWidth;
    messageBox.classList.add('show');
    if (type) messageBox.classList.add(type);
  }

  function clearMessage() {
    messageBox.textContent = '';
    messageBox.className = '';
  }

  // inicia novo jogo
  function startNewGame() {
    // remove foco visual de botões
    [document.getElementById('verifyBtn'),
     document.getElementById('newGraphBtn'),
     document.getElementById('hintBtn')].forEach(b => {
       if (b) { b.classList.remove('active'); b.blur(); }
     });

    // recalc canvas e posições
    resizeCanvasToDisplaySize();

    hintGiven = false;
    selectedNodes.clear();
    clearMessage();

    // sorteia grafo
    if (!Array.isArray(allGraphs) || allGraphs.length === 0) {
      showMessage('Sem grafos disponíveis', 'incorrect');
      return;
    }
    const idx = Math.floor(Math.random() * allGraphs.length);
    currentGraph = allGraphs[idx];

    // gera posições e desenha
    generateNodePositions(currentGraph.nodes || 0);
    drawGraph();
  }

  // associa botões com proteções para blur e remoção de estado "ativo"
  if (verifyBtn) verifyBtn.addEventListener('click', (e) => { checkDominatingSet(e); });
  if (newGraphBtn) newGraphBtn.addEventListener('click', (e) => { 
    if (e && e.currentTarget) { e.currentTarget.classList.remove('active'); setTimeout(()=>e.currentTarget.blur(),0); }
    startNewGame(); 
  });
  if (hintBtn) hintBtn.addEventListener('click', (e) => { giveHint(e); });

  // inicialização
  resizeCanvasToDisplaySize();
  fetchGraphData();
}); // DOMContentLoaded end
