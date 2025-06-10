const searchForm = document.getElementById('searchForm');
const usernameInput = document.getElementById('usernameInput');
const profileSection = document.getElementById('profileSection');
const statsSection = document.getElementById('statsSection');
const openingsSection = document.getElementById('openingsSection');
const chartsSection = document.getElementById('chartsSection');
const loadingSection = document.getElementById('loadingSection');
const errorSection = document.getElementById('errorSection');

const avatarImg = document.getElementById('avatar');
const profileUsername = document.getElementById('profileUsername');
const followersSpan = document.getElementById('followers');
const countrySpan = document.getElementById('country');
const statusSpan = document.getElementById('status');
const leagueSpan = document.getElementById('league');

const statsContent = document.getElementById('statsContent');
const openingsTableBody = document.getElementById('openingsTableBody');

let winRateChart, timeFormatChart, openingWinRateChart;

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) return;
  clearUI();
  showLoading(true);
  try {
    const profile = await fetchProfile(username);
    displayProfile(profile);
    const stats = await fetchStats(username);
    displayStats(stats);
    const allGames = await fetchAllGames(username);
    const parsedData = analyzeGames(allGames, username);
    displayOpenings(parsedData.openingStats);
    renderCharts(parsedData);
    showSections(true);
  } catch (error) {
    console.error(error);
    showError(true);
  } finally {
    showLoading(false);
  }
});

function clearUI() {
  profileSection.classList.add('hidden');
  statsSection.classList.add('hidden');
  openingsSection.classList.add('hidden');
  chartsSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  statsContent.innerHTML = '';
  openingsTableBody.innerHTML = '';
  if (winRateChart) winRateChart.destroy();
  if (timeFormatChart) timeFormatChart.destroy();
  if (openingWinRateChart) openingWinRateChart.destroy();
}

function showLoading(show) {
  loadingSection.classList.toggle('hidden', !show);
}

function showError(show) {
  errorSection.classList.toggle('hidden', !show);
}

function showSections(show) {
  if (show) {
    profileSection.classList.remove('hidden');
    statsSection.classList.remove('hidden');
    openingsSection.classList.remove('hidden');
    chartsSection.classList.remove('hidden');
  } else {
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    openingsSection.classList.add('hidden');
    chartsSection.classList.add('hidden');
  }
}

async function fetchProfile(username) {
  const res = await fetch(`https://api.chess.com/pub/player/${username}`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

async function fetchStats(username) {
  const res = await fetch(`https://api.chess.com/pub/player/${username}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

async function fetchGameArchives(username) {
  const res = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
  if (!res.ok) throw new Error('Failed to fetch game archives');
  const data = await res.json();
  return data.archives || [];
}

async function fetchAllGames(username) {
  const archives = await fetchGameArchives(username);
  const allGames = [];
  for (const archiveUrl of archives) {
    const res = await fetch(archiveUrl);
    if (!res.ok) continue;
    const data = await res.json();
    if (data.games) {
      allGames.push(...data.games);
    }
  }
  return allGames;
}

function displayProfile(profile) {
  avatarImg.src = profile.avatar || '';
  profileUsername.textContent = profile.username || '';
  followersSpan.textContent = profile.followers ?? 'N/A';
  countrySpan.textContent = profile.country ? profile.country.split('/').pop() : 'N/A';
  statusSpan.textContent = profile.status || 'N/A';
  leagueSpan.textContent = profile.league || 'N/A';
  profileSection.classList.remove('hidden');
}

function displayStats(stats) {
  statsContent.innerHTML = '';
  for (const [key, value] of Object.entries(stats)) {
    if (value.record) {
      const wins = value.record.win || 0;
      const losses = value.record.loss || 0;
      const draws = value.record.draw || 0;
      const total = wins + losses + draws;
      const winRate = total ? ((wins / total) * 100).toFixed(1) : 'N/A';
      const statCard = document.createElement('div');
      statCard.className = 'bg-gray-100 dark:bg-gray-800 p-4 rounded shadow';
      // Remove "chess" prefix from key
      const label = key.replace(/^chess_/, '').replace(/_/g, ' ');
      statCard.innerHTML = `
        <h3 class="font-semibold capitalize">${label}</h3>
        <p>Wins: ${wins}</p>
        <p>Losses: ${losses}</p>
        <p>Draws: ${draws}</p>
        <p>Win Rate: ${winRate}%</p>
      `;
      statsContent.appendChild(statCard);
    }
  }
  statsSection.classList.remove('hidden');
}

function analyzeGames(games, username) {
  const chess = new Chess();
  let whiteWins = 0;
  let blackWins = 0;
  let draws = 0;
  const timeFormatCounts = {};
  const openingStats = {};

  for (const game of games) {
    const pgn = game.pgn;
    chess.load_pgn(pgn);

    // Count results
    const result = chess.header().Result;
    const whitePlayer = chess.header().White.toLowerCase();
    const blackPlayer = chess.header().Black.toLowerCase();
    if (result === '1-0') {
      if (whitePlayer === username.toLowerCase()) whiteWins++;
      else blackWins++;
    } else if (result === '0-1') {
      if (blackPlayer === username.toLowerCase()) blackWins++;
      else whiteWins++;
    } else {
      draws++;
    }

    // Count time formats
    const timeClass = game.time_class || 'unknown';
    timeFormatCounts[timeClass] = (timeFormatCounts[timeClass] || 0) + 1;

    // Count openings by ECO code and track play rate, win rate, loss rate, draw rate
    const eco = chess.header().ECO || 'Unknown';
    if (!openingStats[eco]) {
      openingStats[eco] = { wins: 0, losses: 0, draws: 0, playCount: 0, whiteWins: 0, blackWins: 0 };
    }
    openingStats[eco].playCount++;
    if (result === '1-0') {
      if (whitePlayer === username.toLowerCase()) {
        openingStats[eco].wins++;
        openingStats[eco].whiteWins++;
      } else {
        openingStats[eco].losses++;
        openingStats[eco].blackWins++;
      }
    } else if (result === '0-1') {
      if (blackPlayer === username.toLowerCase()) {
        openingStats[eco].wins++;
        openingStats[eco].blackWins++;
      } else {
        openingStats[eco].losses++;
        openingStats[eco].whiteWins++;
      }
    } else {
      openingStats[eco].draws++;
    }
  }

  return {
    whiteWins,
    blackWins,
    draws,
    timeFormatCounts,
    openingStats,
  };
}

function displayOpenings(openingStats) {
  openingsTableBody.innerHTML = '';
  const totalPlays = Object.values(openingStats).reduce((sum, o) => sum + o.playCount, 0);
  // Sort openings by playCount descending
  const sortedOpenings = Object.entries(openingStats).sort((a, b) => b[1].playCount - a[1].playCount).slice(0, 20);
  for (const [eco, stats] of sortedOpenings) {
    const playRate = totalPlays ? ((stats.playCount / totalPlays) * 100).toFixed(1) : '0';
    const totalGames = stats.wins + stats.losses + stats.draws;
    const winRate = totalGames ? ((stats.wins / totalGames) * 100).toFixed(1) : '0';
    const lossRate = totalGames ? ((stats.losses / totalGames) * 100).toFixed(1) : '0';
    const drawRate = totalGames ? ((stats.draws / totalGames) * 100).toFixed(1) : '0';
    const whiteWinRate = stats.playCount ? ((stats.whiteWins / stats.playCount) * 100).toFixed(1) : '0';
    const blackWinRate = stats.playCount ? ((stats.blackWins / stats.playCount) * 100).toFixed(1) : '0';

    const row = document.createElement('tr');
    row.className = 'border-b border-gray-300 dark:border-gray-700';
    row.innerHTML = `
      <td class="px-4 py-2">${eco}</td>
      <td class="px-4 py-2">${playRate}%</td>
      <td class="px-4 py-2">${winRate}%</td>
      <td class="px-4 py-2">${lossRate}%</td>
      <td class="px-4 py-2">${drawRate}%</td>
      <td class="px-4 py-2">${whiteWinRate}%</td>
      <td class="px-4 py-2">${blackWinRate}%</td>
    `;
    openingsTableBody.appendChild(row);
  }
  openingsSection.classList.remove('hidden');
}

function renderCharts(data) {
  // Win rate by color pie chart
  const ctxWinRate = document.getElementById('winRateChart').getContext('2d');
  if (winRateChart) winRateChart.destroy();
  winRateChart = new Chart(ctxWinRate, {
    type: 'pie',
    data: {
      labels: ['White Wins', 'Black Wins', 'Draws'],
      datasets: [{
        data: [data.whiteWins, data.blackWins, data.draws],
        backgroundColor: ['#ec4899', '#ef4444', '#9ca3af'],
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom' },
        title: { display: true, text: 'Win Rate by Color' },
      },
    },
  });

  // Time format distribution bar chart
  const ctxTimeFormat = document.getElementById('timeFormatChart').getContext('2d');
  if (timeFormatChart) timeFormatChart.destroy();
  timeFormatChart = new Chart(ctxTimeFormat, {
    type: 'bar',
    data: {
      labels: Object.keys(data.timeFormatCounts),
      datasets: [{
        label: 'Games Played',
        data: Object.values(data.timeFormatCounts),
        backgroundColor: '#ec4899',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Games Played by Time Format' },
      },
      scales: {
        y: { beginAtZero: true, precision: 0 },
      },
    },
  });

  // Opening win rates bar chart
  const ctxOpening = document.getElementById('openingWinRateChart').getContext('2d');
  if (openingWinRateChart) openingWinRateChart.destroy();
  const openings = Object.entries(data.openingStats)
    .filter(([eco, stats]) => stats.playCount > 0)
    .sort((a, b) => (b[1].wins / b[1].playCount) - (a[1].wins / a[1].playCount))
    .slice(0, 10);
  const labels = openings.map(([eco]) => eco);
  const winRates = openings.map(([eco, stats]) => {
    return stats.playCount ? (stats.wins / stats.playCount) * 100 : 0;
  });

  openingWinRateChart = new Chart(ctxOpening, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Win Rate (%)',
        data: winRates,
        backgroundColor: '#10b981',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Top 10 Opening Win Rates' },
      },
      scales: {
        y: { beginAtZero: true, max: 100 },
      },
    },
  });

  chartsSection.classList.remove('hidden');
}
