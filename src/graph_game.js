// src/graph_game.js

let canvas, ctx;
let selectedNodes = new Set();
let allGraphs;
let currentGraph;
let hintGiven = false;

const nodeRadius = 15;
const nodePositions = [];
let messageBox;

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('graphCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;

    const verifyBtn = document.getElementById('verifyBtn');
    const newGraphBtn = document.getElementById('newGraphBtn');
    const hintBtn = document.getElementById('hintBtn');
    messageBox = document.getElementById('message-box');

    async function fetchGraphData() {
        try {
            const response = await fetch('../src/grafos.json');
            allGraphs = await response.json();
            newGame();
        } catch (error) {
            console.error('Erro ao carregar os dados dos grafos:', error);
            showMessage('Erro ao carregar o jogo. Tente recarregar a página.', 'incorrect');
            verifyBtn.disabled = true;
            newGraphBtn.disabled = true;
            hintBtn.disabled = true;
        }
    }

    function newGame() {
        clearMessage();
        hintGiven = false;
        selectedNodes.clear();
        
        const randomIndex = Math.floor(Math.random() * allGraphs.length);
        currentGraph = allGraphs[randomIndex];

        generateNodePositions(currentGraph.nodes);
        drawGraph();
    }

    function generateNodePositions(numNodes) {
        nodePositions.length = 0;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 150;
        
        for (let i = 0; i < numNodes; i++) {
            const angle = (i / numNodes) * 2 * Math.PI;
            nodePositions.push({
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
                scale: 1
            });
        }
    }

    function drawGraph() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Arestas
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        for (const [node, neighbors] of Object.entries(currentGraph.adjList)) {
            const startPos = nodePositions[node];
            neighbors.forEach(neighbor => {
                if (parseInt(node) < neighbor) {
                    const endPos = nodePositions[neighbor];
                    ctx.beginPath();
                    ctx.moveTo(startPos.x, startPos.y);
                    ctx.lineTo(endPos.x, endPos.y);
                    ctx.stroke();
                }
            });
        }

        // Nós
        nodePositions.forEach((pos, index) => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeRadius * pos.scale, 0, 2 * Math.PI);
            
            ctx.fillStyle = selectedNodes.has(index) ? 'black' : 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (messageBox.classList.contains('incorrect')) {
                const minSize = Math.min(...currentGraph.minDominatingSets.map(set => set.length));
                const correctSet = currentGraph.minDominatingSets.find(set => set.length === minSize);
                if (correctSet.includes(index)) {
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 4;
                    ctx.stroke();
                }
            }
        });
    }

    function animateClick(nodeId) {
        let step = 0;
        const animate = () => {
            step++;
            nodePositions[nodeId].scale = 1 + 0.2 * Math.sin(step * 0.3);
            drawGraph();
            if (step < 10) {
                requestAnimationFrame(animate);
            } else {
                nodePositions[nodeId].scale = 1;
                drawGraph();
            }
        };
        animate();
    }

    function toggleNode(nodeId) {
        if (selectedNodes.has(nodeId)) {
            selectedNodes.delete(nodeId);
        } else {
            selectedNodes.add(nodeId);
        }
        clearMessage();
        animateClick(nodeId);
    }

    function checkDominatingSet(event) {
        event.preventDefault();
        const userSet = Array.from(selectedNodes).sort((a, b) => a - b);
        
        let isCorrect = currentGraph.minDominatingSets.some(minSet => {
            return minSet.length === userSet.length && minSet.every(node => userSet.includes(node));
        });

        if (isCorrect) {
            showMessage('Parabéns! Você encontrou um Conjunto Dominante Mínimo!', 'correct');
        } else {
            showMessage('Resposta incorreta. O conjunto selecionado não é um dominante mínimo.', 'incorrect');
            drawGraph();
        }
    }

    function giveHint(event) {
        event.preventDefault();
        if (!hintGiven) {
            const minSize = Math.min(...currentGraph.minDominatingSets.map(set => set.length));
            showMessage(`A cardinalidade do conjunto dominante mínimo é: ${minSize}.`, 'hint');
            hintGiven = true;
        }
    }

    function showMessage(text, type) {
        messageBox.textContent = text;
        messageBox.className = `show ${type}`;
    }

    function clearMessage() {
        messageBox.textContent = '';
        messageBox.className = '';
    }

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        nodePositions.forEach((pos, index) => {
            const dist = Math.sqrt((mouseX - pos.x) ** 2 + (mouseY - pos.y) ** 2);
            if (dist < nodeRadius * pos.scale) {
                toggleNode(index);
            }
        });
    });

    verifyBtn.addEventListener('click', checkDominatingSet);
    newGraphBtn.addEventListener('click', (e) => { e.preventDefault(); newGame(); });
    hintBtn.addEventListener('click', giveHint);

    fetchGraphData();
});
