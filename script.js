(() => {
  const themeToggleBtn = document.getElementById('themeToggle');
  const body = document.body;
  const localStorageKey = 'chessPlayerAnalyzerTheme';

  function initTheme() {
    const savedTheme = localStorage.getItem(localStorageKey);
    if (savedTheme === 'light') {
      body.classList.add('light-theme');
      updateToggleIcon(true);
    } else {
      body.classList.remove('light-theme');
      updateToggleIcon(false);
    }
  }

  function updateToggleIcon(isLight) {
    const icon = themeToggleBtn.querySelector('.material-icons');
    icon.textContent = isLight ? 'light_mode' : 'dark_mode';
  }

  themeToggleBtn.addEventListener('click', () => {
    const isLight = body.classList.toggle('light-theme');
    localStorage.setItem(localStorageKey, isLight ? 'light' : 'dark');
    updateToggleIcon(isLight);
  });

  initTheme();

  const searchForm = document.getElementById('searchForm');
  const usernameInput = document.getElementById('usernameInput');
  const profileSection = document.getElementById('profileSection');
  const statsSection = document.getElementById('statsSection');
  const openingsSection = document.getElementById('openingsSection');
  const loadingSection = document.getElementById('loadingSection');
  const errorSection = document.getElementById('errorSection');

  const avatarImg = document.getElementById('avatar');
  const profileUsername = document.getElementById('profileUsername');
  const followersSpan = document.getElementById('followers');
  const countrySpan = document.getElementById('country');
  const statusSpan = document.getElementById('status');

  const statsContent = document.getElementById('statsContent');
  const openingsTableBody = document.getElementById('openingsTableBody');

  // Helpers
  function clearUI() {
    profileSection.classList.add('hidden');
    statsSection.classList.add('hidden');
    openingsSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    statsContent.innerHTML = '';
    openingsTableBody.innerHTML = '';
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
    } else {
      profileSection.classList.add('hidden');
      statsSection.classList.add('hidden');
      openingsSection.classList.add('hidden');
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

  function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function calcWinPercent(wins, total) {
    if (total === 0) return '0.0';
    return ((wins / total) * 100).toFixed(1);
  }

  function displayProfile(profile) {
    avatarImg.src = profile.avatar || '';
    profileUsername.textContent = profile.username || 'N/A';
    followersSpan.textContent = profile.followers ?? 'N/A';
    countrySpan.textContent = profile.country ? profile.country.split('/').pop().toUpperCase() : 'N/A';
    statusSpan.textContent = profile.status || 'N/A';
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
        const winRate = calcWinPercent(wins, total);
        const label = key.replace(/^chess_/, '').replace(/_/g, ' ');
        const statCard = document.createElement('div');
        statCard.className = 'stat-card';
        statCard.innerHTML = `
          <h3 class="stat-label">${label}</h3>
          <p>Wins: ${numberWithCommas(wins)}</p>
          <p>Losses: ${numberWithCommas(losses)}</p>
          <p>Draws: ${numberWithCommas(draws)}</p>
          <p>Win Rate: ${winRate}%</p>
        `;
        statsContent.appendChild(statCard);
      }
    }
    statsSection.classList.remove('hidden');
  }

  function analyzeGames(games, username) {
    const chess = new Chess();
    const lowerUser = username.toLowerCase();
    let whiteWins = 0;
    let blackWins = 0;
    let draws = 0;

    const timeFormatCounts = {};
    const openingStats = {};

    for (const game of games) {
      if (!game.pgn) continue;
      chess.load_pgn(game.pgn);
      const result = chess.header().Result || '';
      const whitePlayer = chess.header().White.toLowerCase() || '';
      const blackPlayer = chess.header().Black.toLowerCase() || '';
      const timeClass = game.time_class || 'unknown';
      timeFormatCounts[timeClass] = (timeFormatCounts[timeClass] || 0) + 1;

      // Opening ECO
      const eco = chess.header().ECO || 'Unknown';
      if (!openingStats[eco]) {
        openingStats[eco] = { playCount: 0, whiteWins: 0, blackWins: 0, draws: 0 };
      }
      openingStats[eco].playCount++;

      // Count result per player color
      const isWhite = whitePlayer === lowerUser;
      const isBlack = blackPlayer === lowerUser;

      if (result === '1-0') {
        if (isWhite) whiteWins++;
        else if (isBlack) blackWins++;
        openingStats[eco].whiteWins++;
      } else if (result === '0-1') {
        if (isBlack) blackWins++;
        else if (isWhite) whiteWins++;
        openingStats[eco].blackWins++;
      } else if (result === '1/2-1/2') {
        draws++;
        openingStats[eco].draws++;
      }
    }

    return { whiteWins, blackWins, draws, timeFormatCounts, openingStats };
  }

  function displayOpenings(openingStats) {
    openingsTableBody.innerHTML = '';
    const totalPlays = Object.values(openingStats).reduce((sum, o) => sum + o.playCount, 0);
    // Sort and show top 20 openings
    const sortedOpenings = Object.entries(openingStats)
      .sort((a, b) => b[1].playCount - a[1].playCount)
      .slice(0, 20);
    for (const [eco, stats] of sortedOpenings) {
      const playRate = totalPlays ? ((stats.playCount / totalPlays) * 100).toFixed(1) : '0.0';
      const totalGames = stats.playCount;
      const winRate =
        totalGames ? ((stats.whiteWins + stats.blackWins) / totalGames * 100).toFixed(1) : '0.0';
      const lossRate =
        totalGames ? ((totalGames - stats.whiteWins - stats.blackWins - stats.draws) / totalGames * 100).toFixed(1) : '0.0';
      const drawRate =
        totalGames ? ((stats.draws / totalGames) * 100).toFixed(1) : '0.0';
      const whiteWinRate =
        totalGames ? ((stats.whiteWins / totalGames) * 100).toFixed(1) : '0.0';
      const blackWinRate =
        totalGames ? ((stats.blackWins / totalGames) * 100).toFixed(1) : '0.0';

      const row = document.createElement('tr');
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

  let winRateChart;
  let timeFormatChart;
  let openingWinRateChart;

  function renderCharts(data) {
    // Clear previous charts
    if (winRateChart) winRateChart.destroy();
    if (timeFormatChart) timeFormatChart.destroy();
    if (openingWinRateChart) openingWinRateChart.destroy();

    const ctxWinRate = document.getElementById('winRateChart').getContext('2d');
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
        plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Win Rate by Color' } }
      }
    });

    const ctxTimeFormat = document.getElementById('timeFormatChart').getContext('2d');
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
        plugins: { legend: { display: false }, title: { display: true, text: 'Games Played by Time Format' } },
        scales: { y: { beginAtZero: true, precision: 0 } }
      }
    });

    const ctxOpening = document.getElementById('openingWinRateChart').getContext('2d');
    // Prepare opening data for chart: top 10 openings by play count
    const openingsArr = Object.entries(data.openingStats)
      .sort((a,b) => b[1].playCount - a[1].playCount)
      .slice(0,10)
      .map(([eco, stats]) => {
        const totalGames = stats.playCount;
        const winRate = totalGames ? ((stats.whiteWins + stats.blackWins) / totalGames * 100) : 0;
        return { eco, winRate: +winRate.toFixed(1) };
      });

    openingWinRateChart = new Chart(ctxOpening, {
      type: 'bar',
      data: {
        labels: openingsArr.map(o => o.eco),
        datasets: [{
          label: 'Win Rate (%)',
          data: openingsArr.map(o => o.winRate),
          backgroundColor: '#10b981',
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false }, title: { display: true, text: 'Top 10 Opening Win Rates' } },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
    // Show charts section
    document.getElementById('chartsSection').classList.remove('hidden');
  }

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
})()

