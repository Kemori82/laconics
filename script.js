const username = "ethan";
const body = document.body;
const themeToggle = document.getElementById("theme-toggle");
themeToggle.addEventListener("change", () => {
  body.className = themeToggle.checked ? "dark" : "light";
});

async function fetchGameArchives() {
  const res = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
  const data = await res.json();
  return data.archives.slice(-3); // Last 3 months
}

async function fetchAllGames() {
  const archives = await fetchGameArchives();
  let allGames = [];
  for (const url of archives) {
    const res = await fetch(url);
    const data = await res.json();
    allGames.push(...data.games);
  }
  return allGames;
}

function analyzeOpenings(games) {
  const stats = {};
  for (const game of games) {
    const chess = new Chess();
    chess.load_pgn(game.pgn);
    const firstMoves = chess.history().slice(0, 4).join(" ");
    const opening = firstMoves || "Unknown";

    const isWhite = game.white.username.toLowerCase() === username;
    const result = isWhite ? game.white.result : game.black.result;

    if (!stats[opening]) stats[opening] = { win: 0, loss: 0, draw: 0, count: 0 };

    stats[opening].count++;
    if (result === "win") stats[opening].win++;
    else if (["checkmated", "timeout", "resigned"].includes(result)) stats[opening].loss++;
    else stats[opening].draw++;
  }
  return stats;
}

function renderChart(stats) {
  const labels = Object.keys(stats);
  const winRates = labels.map(o => (stats[o].win / stats[o].count) * 100);
  const lossRates = labels.map(o => (stats[o].loss / stats[o].count) * 100);
  const drawRates = labels.map(o => (stats[o].draw / stats[o].count) * 100);

  const ctx = document.getElementById('openingChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Win Rate',
          data: winRates,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
        },
        {
          label: 'Loss Rate',
          data: lossRates,
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
        },
        {
          label: 'Draw Rate',
          data: drawRates,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
        }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}

(async function () {
  const games = await fetchAllGames();
  const stats = analyzeOpenings(games);
  renderChart(stats);
})();
