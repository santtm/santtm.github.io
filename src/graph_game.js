// src/graph_game.js

let canvas, ctx;
let selectedNodes = new Set();
let allGraphs;
let currentGraph;
let hintGiven = false;

const nodeRadius = 15;
const nodePositions = [];

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('graphCanvas');
    ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 400;

    const verifyBtn = document.getElementById('verifyBtn');
    const newGraphBtn = document.getElementById('newGraphBtn');
    const hintBtn = document.getElementById('hintBtn');
    const hintText = document.getElementById('hint-text');
    const resultMessage = document.getElementById('result-message');

    async function fetchGraphData() {
        try {
            const response = await fetch('../src/grafos.json');
            allGraphs = await response.json();
            newGame();
        } catch (error) {
            console.error('Erro ao carregar os dados dos grafos:', error);
            resultMessage.textContent = 'Erro ao carregar o jogo. Tente recarregar a página.';
            resultMessage.style.display = 'block';
            verifyBtn.disabled = true;
            newGraphBtn.disabled = true;
            hintBtn.disabled = true;
        }
    }

    function newGame() {
        resultMessage.textContent = '';
        resultMessage.style.display = 'none';
        resultMessage.classList.remove('correct', 'incorrect');
        hintText.textContent = '';
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
                y: centerY + radius * Math.sin(angle)
            });
        }
    }

    function drawGraph() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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

        nodePositions.forEach((pos, index) => {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, nodeRadius, 0, 2 * Math.PI);
            
            ctx.fillStyle = selectedNodes.has(index) ? 'black' : 'white';
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();

            if (resultMessage.classList.contains('incorrect')) {
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

    function toggleNode(nodeId) {
        if (selectedNodes.has(nodeId)) {
            selectedNodes.delete(nodeId);
        } else {
            selectedNodes.add(nodeId);
        }
        resultMessage.textContent = '';
        resultMessage.style.display = 'none';
        resultMessage.classList.remove('correct', 'incorrect');
        drawGraph();
    }

    function checkDominatingSet() {
        const userSet = Array.from(selectedNodes).sort((a, b) => a - b);
        
        let isCorrect = currentGraph.minDominatingSets.some(minSet => {
            return minSet.length === userSet.length && minSet.every(node => userSet.includes(node));
        });

        resultMessage.style.display = 'block';
        if (isCorrect) {
            resultMessage.textContent = 'Parabéns! Você encontrou um Conjunto Dominante Mínimo!';
            resultMessage.classList.add('correct');
        } else {
            resultMessage.textContent = 'Resposta incorreta. O conjunto selecionado não é um dominante mínimo.';
            resultMessage.classList.add('incorrect');
            drawGraph();
        }
    }

    function giveHint() {
        if (!hintGiven) {
            const minSize = Math.min(...currentGraph.minDominatingSets.map(set => set.length));
            hintText.textContent = `A cardinalidade do conjunto dominante mínimo é: ${minSize}.`;
            hintGiven = true;
        }
    }

    canvas.addEventListener('click', (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        nodePositions.forEach((pos, index) => {
            const dist = Math.sqrt((mouseX - pos.x) ** 2 + (mouseY - pos.y) ** 2);
            if (dist < nodeRadius) toggleNode(index);
        });
    });

    verifyBtn.addEventListener('click', checkDominatingSet);
    newGraphBtn.addEventListener('click', newGame);
    hintBtn.addEventListener('click', giveHint);

    fetchGraphData();
});
