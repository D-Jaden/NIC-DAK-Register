// ============================================================
// dashboard_acquired.js — Acquired Analytics Dashboard
// ============================================================

const COLORS = {
    lang:   ['#d2a8ff','#58a6ff','#3fb950','#8b949e'],
    month:  '#58a6ff',
    zone:   ['#ff7b72', '#ffa657', '#e3b341', '#3fb950', '#79c0ff', '#d2a8ff'],
    sender: ['#58a6ff','#3fb950','#ffa657','#d2a8ff','#f78166',
             '#79c0ff','#56d364','#e3b341','#bc8cff','#ff7b72']
};

let charts = {};

// ── Utilities ──────────────────────────────────────────────
function getAuthToken() {
    return localStorage.getItem('authToken')
        || sessionStorage.getItem('authToken')
        || '';
}

function pct(count, total) {
    return total > 0 ? ((count / total) * 100).toFixed(1) + '%' : '0%';
}

function showError(msg) {
    const el = document.getElementById('errorBanner');
    el.textContent = msg;
    el.classList.add('show');
}

function hideError() {
    document.getElementById('errorBanner').classList.remove('show');
}

function setLoading(on) {
    document.getElementById('loadingOverlay').style.display = on ? 'flex' : 'none';
}

function destroyAll() {
    Object.values(charts).forEach(c => c && c.destroy());
    charts = {};
}

// ── Fetch Stats ────────────────────────────────────────────
async function fetchStats(from, to) {
    const params = new URLSearchParams();
    if (from) params.append('from_date', from);
    if (to)   params.append('to_date',   to);

    const url = '/api/acquired/stats' + (params.toString() ? '?' + params.toString() : '');

    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json'
        }
    });

    if (res.status === 401 || res.status === 403) {
        window.location.href = 'login.html';
        return null;
    }

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
}

// ── Build the doughnut legend below each chart ─────────────
function makeLegend(containerId, labels, data, total, colors) {
    const ul = document.getElementById(containerId);
    if (!ul) return;
    ul.innerHTML = '';
    labels.forEach((label, i) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="legend-dot" style="background:${colors[i % colors.length]}"></span>
            <span>${label || 'Unknown'}</span>
            <span class="legend-val">${data[i]} &nbsp;<span style="color:var(--text-muted);font-weight:400">(${pct(data[i], total)})</span></span>
        `;
        ul.appendChild(li);
    });
}

// ── Render All Charts ──────────────────────────────────────
function renderCharts(stats) {
    destroyAll();

    const total = stats.total || 0;

    // ── Stat Cards ────────────────────────────────────────
    document.getElementById('statTotal').textContent    = total;
    document.getElementById('statMonth').textContent    =
        stats.byMonth.length ? stats.byMonth[stats.byMonth.length - 1].count : 0;

    const topSender = stats.bySender.length ? stats.bySender[0] : null;
    document.getElementById('statSender').textContent =
        topSender ? topSender.sender : '—';

    // ── Defaults for Chart.js ─────────────────────────────
    Chart.defaults.color = '#64748b';
    Chart.defaults.font.family = "'Inter', sans-serif";

    const doughnutBase = {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const v = ctx.parsed;
                            const t = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                            return ` ${ctx.label}: ${v} (${pct(v, t)})`;
                        }
                    }
                }
            }
        }
    };

    // ── Language Doughnut ─────────────────────────────────
    const langLabels = stats.byLanguage.map(r => r.language || 'Unknown');
    const langCounts = stats.byLanguage.map(r => parseInt(r.count));

    if (langLabels.length) {
        charts.lang = new Chart(document.getElementById('chartLang'), {
            ...doughnutBase,
            data: {
                labels: langLabels,
                datasets: [{ data: langCounts, backgroundColor: COLORS.lang, borderWidth: 0, hoverOffset: 6 }]
            }
        });
        makeLegend('legendLang', langLabels, langCounts, total, COLORS.lang);
    } else {
        document.getElementById('chartLang').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No data yet</p>';
    }

    // ── Letters by Month Bar ──────────────────────────────
    if (stats.byMonth.length) {
        charts.month = new Chart(document.getElementById('chartMonth'), {
            type: 'bar',
            data: {
                labels: stats.byMonth.map(r => r.month),
                datasets: [{
                    label: 'Letters Received',
                    data: stats.byMonth.map(r => parseInt(r.count)),
                    backgroundColor: COLORS.month + '99',
                    borderColor: COLORS.month,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.y} letters`
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: '#e2e8f0' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            stepSize: 1,
                            callback: v => Number.isInteger(v) ? v : null
                        }
                    }
                }
            }
        });
    } else {
        document.getElementById('chartMonth').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No monthly data yet</p>';
    }

    // ── Top Senders Horizontal Bar ─────────────────────────
    if (stats.bySender.length) {
        charts.sender = new Chart(document.getElementById('chartSender'), {
            type: 'bar',
            data: {
                labels: stats.bySender.map(r => r.sender),
                datasets: [{
                    label: 'Letters',
                    data: stats.bySender.map(r => parseInt(r.count)),
                    backgroundColor: COLORS.sender.map(c => c + 'bb'),
                    borderColor: COLORS.sender,
                    borderWidth: 2,
                    borderRadius: 5,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.x} letters (${pct(ctx.parsed.x, total)})`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    }
                }
            }
        });
    } else {
        document.getElementById('chartSender').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No sender data yet</p>';
    }

    // ── Letters by Zone Horizontal Bar ─────────────────────────
    if (stats.byZone && stats.byZone.length) {
        charts.zone = new Chart(document.getElementById('chartZone'), {
            type: 'bar',
            data: {
                labels: stats.byZone.map(r => r.zone || 'None'),
                datasets: [{
                    label: 'Letters',
                    data: stats.byZone.map(r => parseInt(r.count)),
                    backgroundColor: COLORS.zone.map(c => c + 'bb'),
                    borderColor: COLORS.zone,
                    borderWidth: 2,
                    borderRadius: 5,
                    borderSkipped: false
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.parsed.x} letters (${pct(ctx.parsed.x, total)})`
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    }
                }
            }
        });
    } else {
        const cz = document.getElementById('chartZone');
        if(cz) cz.parentElement.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No zone data yet</p>';
    }

    // ── Zone Breakdown by Language ───────────────────────────
    if (stats.zoneByLanguage && stats.zoneByLanguage.length) {
        // Prepare stacked dataset
        const uniqueZones = [...new Set(stats.zoneByLanguage.map(r => r.zone))];
        const uniqueLangs = [...new Set(stats.zoneByLanguage.map(r => r.language))];
        
        const datasets = uniqueLangs.map((lang, index) => {
            const dataCounts = uniqueZones.map(zone => {
                const found = stats.zoneByLanguage.find(r => r.zone === zone && r.language === lang);
                return found ? parseInt(found.count) : 0;
            });
            
            return {
                label: lang || 'Unknown',
                data: dataCounts,
                backgroundColor: COLORS.lang[index % COLORS.lang.length],
            };
        });

        charts.zoneLang = new Chart(document.getElementById('chartZoneLang'), {
            type: 'bar',
            data: {
                labels: uniqueZones,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#64748b', font: { family: "'Inter', sans-serif" } }
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} letters`
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#64748b', font: { size: 11 } }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: '#e2e8f0' },
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 },
                            stepSize: 1,
                            callback: v => Number.isInteger(v) ? v : null
                        }
                    }
                }
            }
        });
    } else {
        const czl = document.getElementById('chartZoneLang');
        if(czl) czl.parentElement.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No zone/language data yet</p>';
    }

    // ── Last updated ──────────────────────────────────────
    document.getElementById('last-updated').textContent =
        'Updated: ' + new Date().toLocaleTimeString();
}

// ── Main Load ──────────────────────────────────────────────
async function loadDashboard() {
    setLoading(true);
    hideError();

    const from = document.getElementById('dateFrom').value || '';
    const to   = document.getElementById('dateTo').value   || '';

    try {
        const stats = await fetchStats(from, to);
        if (stats && stats.success) {
            renderCharts(stats);
        } else if (stats) {
            showError('Failed to load stats: ' + (stats.error || 'Unknown error'));
        }
    } catch (err) {
        console.error(err);
        showError('Could not connect to server. Make sure you are logged in.');
    } finally {
        setLoading(false);
    }
}

// ── Event Wiring ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btnFilter').addEventListener('click', loadDashboard);
    document.getElementById('btnReset').addEventListener('click', () => {
        document.getElementById('dateFrom').value = '';
        document.getElementById('dateTo').value   = '';
        loadDashboard();
    });

    loadDashboard();
});
