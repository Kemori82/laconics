const searchForm = document.getElementById('searchForm');
const usernameInput = document.getElementById('usernameInput');
const profileSection = document.getElementById('profileSection');
const statsSection = document.getElementById('statsSection');
const openingsSection = document.getElementById('openingsSection');
const chartsSection = document.getElementById('chartsSection');
const leaderboardSection = document.getElementById('leaderboardSection');
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
const leaderboardTableBody = document.getElementById('leaderboardTableBody');

const timeFilterSelect = document.getElementById('timeFilter');

let winRateChart, timeFormatChart, openingWinRateChart, ratingHistoryChart;

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

    // Fetch all games once
    const allGames = await fetchAllGames(username);

    // Apply current time filter
    const filteredGames = filterGamesByTime(allGames, timeFilterSelect.value);

    // Analyze filtered games
    const parsedData = analyzeGames(filteredGames, username);

    displayOpenings(parsedData.openingStats);
    displayLeaderboard(parsedData.opponentStats);
    renderCharts(parsedData);

    showSections(true);
  } catch (error) {
    console.error(error);
    showError(true);
  } finally {
    showLoading(false);
  }
});

// Re-filter and update charts when the time filter changes
timeFilterSelect.addEventListener('change', () => {
  const username = usernameInput.value.trim();
  if (!username) return;

  // Show loading and clear current displays
  clearUI();
  showLoading(true);

  // Refetch all games and reapply the new filter and update charts
  fetchAllGames(username)
    .then(allGames => {
      const filteredGames = filterGamesByTime(allGames, timeFilterSelect.value);
      const parsedData = analyzeGames(filteredGames, username);

      displayOpenings(parsedData.openingStats);
      displayLeaderboard(parsedData.opponentStats);
      renderCharts(parsedData);

      showSections(true);
    })
    .catch(error => {
      console.error(error);
      showError(true);
    })
    .finally(() => showLoading(false));
});

function clearUI() {
  profileSection.classList.add('hidden');
  statsSection.classList.add('hidden');
  openingsSection.classList.add('hidden');
  chartsSection.classList.add('hidden');
  leaderboardSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  statsContent.innerHTML = '';
  openingsTableBody.innerHTML = '';
  leaderboardTableBody.innerHTML = '';
  if (winRateChart) winRateChart.destroy();
  if (timeFormatChart) timeFormatChart.destroy();
  if (openingWinRateChart) openingWinRateChart.destroy();
  if (ratingHistoryChart) ratingHistoryChart.destroy();
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
    leaderboardSection.classList.remove('hidden');
  } else {
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    openingsSection.classList.add('hidden');
    chartsSection.classList.add('hidden');
    leaderboardSection.classList.add('hidden');
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

/**
 * Filters games based on the selected time filter.
 * @param {Array} games - All games.
 * @param {string} filter - 'week', '3months', '1year', 'all'
 * @returns {Array} filtered games
 */
function filterGamesByTime(games, filter) {
  if (filter === 'all') return games;

  const now = new Date();
  let cutoff;

  switch (filter) {
    case 'week':
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '3months':
      cutoff = new Date(now.getTime());
      cutoff.setMonth(cutoff.getMonth() - 3);
      break;
    case '1year':
      cutoff = new Date(now.getTime());
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
    default:
      return games;
  }

  return games.filter(game => {
    // game.end_time is UNIX timestamp seconds
    if (!game.end_time) return false;
    const gameDate = new Date(game.end_time * 1000);
    return gameDate >= cutoff;
  });
}

/**
 * Map of ECO codes to opening names.
 * You can expand this with a full dictionary as needed.
 */
const ECO_TO_NAME = {
  "B01": "Scandinavian Defense",
  "C20": "King's Pawn Game",
  "C40": "King's Knight Opening",
  "C50": "Italian Game",
  "D00": "Queen's Pawn Game",
  "E60": "King's Indian Defense",
  // Add more mappings here...
  "Unknown": "Unknown Opening"
};

/**
 * Analyze the games for stats, rating history, opponent stats, etc.
 * @param {Array} games
 * @param {string} username
 * @returns {Object}
 */
function analyzeGames(games, username) {
  const chess = new Chess();
  let whiteWins = 0;
  let blackWins = 0;
  let draws = 0;
  const timeFormatCounts = {};
  const openingStats = {};
  const opponentStats = {};
  const ratingHistory = [];

  const unameLower = username.toLowerCase();

  for (const game of games) {
    const pgn = game.pgn;
    if (!pgn) continue;
    chess.load_pgn(pgn);

    const headers = chess.header();
    const result = headers.Result;
    const whitePlayer = headers.White.toLowerCase();
    const blackPlayer = headers.Black.toLowerCase();

    // Count results
    if (result === '1-0') {
      if (whitePlayer === unameLower) whiteWins++;
      else blackWins++;
    } else if (result === '0-1') {
      if (blackPlayer === unameLower) blackWins++;
      else whiteWins++;
    } else {
      draws++;
    }

    // Time format counts
    const timeClass = game.time_class || 'unknown';
    timeFormatCounts[timeClass] = (timeFormatCounts[timeClass] || 0) + 1;

    // Opening stats by ECO code
    const eco = headers.ECO || 'Unknown';
    if (!openingStats[eco]) {
      openingStats[eco] = { wins: 0, losses: 0, draws: 0, playCount: 0 };
    }
    openingStats[eco].playCount++;
    if (result === '1-0') {
      if (whitePlayer === unameLower) openingStats[eco].wins++;
      else openingStats[eco].losses++;
    } else if (result === '0-1') {
      if (blackPlayer === unameLower) openingStats[eco].wins++;
      else openingStats[eco].losses++;
    } else {
      openingStats[eco].draws++;
    }

    // Opponent stats
    let opponentName;
    if (whitePlayer === unameLower) opponentName = headers.Black;
    else opponentName = headers.White;

    if (!opponentStats[opponentName]) {
      opponentStats[opponentName] = { games: 0, wins: 0, losses: 0, draws: 0 };
    }
    opponentStats[opponentName].games++;
    if (result === '1-0') {
      if (whitePlayer === unameLower) opponentStats[opponentName].wins++;
      else opponentStats[opponentName].losses++;
    } else if (result === '0-1') {
      if (blackPlayer === unameLower) opponentStats[opponentName].wins++;
      else opponentStats[opponentName].losses++;
    } else {
      opponentStats[opponentName].draws++;
    }

    // Rating history (date and rating at game end)
    // Use the player's rating for this time_class (if available)
    // Chess.com API includes a "white_rating" and "black_rating" in each game
    // We'll record the rating after each game to build the timeline
    const playerColor = (whitePlayer === unameLower) ? 'white' : 'black';
    const playerRating = game[`${playerColor}_rating`];

    // Use end_time as date
    if (playerRating && game.end_time) {
      ratingHistory.push({ date: new Date(game.end_time * 1000), rating: playerRating });
    }
  }

  // Sort rating history by date ascending
  ratingHistory.sort((a, b) => a.date - b.date);

  return {
    whiteWins,
    blackWins,
    draws,
    timeFormatCounts,
    openingStats,
    opponentStats,
    ratingHistory
  };
}

function displayOpenings(openingStats) {
  openingsTableBody.innerHTML = '';
  const totalPlays = Object.values(openingStats).reduce((sum, o) => sum + o.playCount, 0);

  // Sort by playCount desc and limit to 20
  const sortedOpenings = Object.entries(openingStats)
    .sort((a, b) => b[1].playCount - a[1].playCount)
    .slice(0, 20);

  for (const [eco, stats] of sortedOpenings) {
    const playRate = totalPlays ? ((stats.playCount / totalPlays) * 100).toFixed(1) : '0';
    const totalGames = stats.wins + stats.losses + stats.draws;
    const winRate = totalGames ? ((stats.wins / totalGames) * 100).toFixed(1) : '0';
    const lossRate = totalGames ? ((stats.losses / totalGames) * 100).toFixed(1) : '0';
    const drawRate = totalGames ? ((stats.draws / totalGames) * 100).toFixed(1) : '0';

    const openingName = ECO_TO_NAME[eco] || eco;

    const row = document.createElement('tr');
    row.className = 'border-b border-gray-300 dark:border-gray-700';
    row.innerHTML = `
      <td class="px-4 py-2">${openingName}</td>
      <td class="px-4 py-2">${playRate}%</td>
      <td class="px-4 py-2">${winRate}%</td>
      <td class="px-4 py-2">${lossRate}%</td>
      <td class="px-4 py-2">${drawRate}%</td>
    `;
    openingsTableBody.appendChild(row);
  }
  openingsSection.classList.remove('hidden');
}

function displayLeaderboard(opponentStats) {
  leaderboardTableBody.innerHTML = '';

  // Sort opponents by most games played descending, limit to top 5
  const topOpponents = Object.entries(opponentStats)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 5);

  for (const [opponent, stats] of topOpponents) {
    const totalGames = stats.games;
    const winRate = totalGames ? ((stats.wins / totalGames) * 100).toFixed(1) : '0';
    const lossRate = totalGames ? ((stats.losses / totalGames) * 100).toFixed(1) : '0';
    const drawRate = totalGames ? ((stats.draws / totalGames) * 100).toFixed(1) : '0';

    const row = document.createElement('tr');
    row.className = 'border-b border-gray-300 dark:border-gray-700';
    row.innerHTML = `
      <td class="px-4 py-2">${opponent}</td>
      <td class="px-4 py-2">${totalGames}</td>
      <td class="px-4 py-2">${winRate}%</td>
      <td class="px-4 py-2">${lossRate}%</td>
      <td class="px-4 py-2">${drawRate}%</td>
    `;
    leaderboardTableBody.appendChild(row);
  }
  leaderboardSection.classList.remove('hidden');
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

  // Opening win rates bar chart (showing opening names)
  const ctxOpening = document.getElementById('openingWinRateChart').getContext('2d');
  if (openingWinRateChart) openingWinRateChart.destroy();
  const openings = Object.entries(data.openingStats)
    .filter(([eco, stats]) => stats.playCount > 0)
    .sort((a, b) => (b[1].wins / b[1].playCount) - (a[1].wins / a[1].playCount))
    .slice(0, 10);
  const labels = openings.map(([eco]) => ECO_TO_NAME[eco] || eco);
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
        backgroundColor: '#ec4899',
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Top 10 Opening Win Rates' },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { stepSize: 10 },
        },
      },
    },
  });

  // Rating history line chart
  const ctxRatingHistory = document.getElementById('ratingHistoryChart').getContext('2d');
  if (ratingHistoryChart) ratingHistoryChart.destroy();
  const dates = data.ratingHistory.map(r => r.date.toISOString().split('T')[0]);
  const ratings = data.ratingHistory.map(r => r.rating);

  ratingHistoryChart = new Chart(ctxRatingHistory, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [{
        label: 'Rating',
        data: ratings,
        fill: false,
        borderColor: '#ef4444',
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'month',
            tooltipFormat: 'MMM DD, YYYY',
          },
          title: { display: true, text: 'Date' },
        },
        y: {
          beginAtZero: false,
          title: { display: true, text: 'Rating' },
        },
      },
      plugins: {
        legend: { display: true },
        title: { display: true, text: 'Rating History' },
      },
    },
  });

  chartsSection.classList.remove('hidden');
}
