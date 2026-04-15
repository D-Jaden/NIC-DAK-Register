// ============================================================
// dashboard.js — DAK Register Analytics Dashboard
// ============================================================

const COLORS = {
    zone:   ['#1E88E5', '#43A047', '#8E24AA', '#E53935'],
    method: ['#FB8C00', '#E53935', '#1E88E5', '#8E24AA'],
    lang:   ['#8E24AA', '#1E88E5', '#43A047', '#FB8C00'],
    zoneLang: ['#FB8C00', '#43A047', '#FDD835', '#1E88E5', '#8E24AA', '#E53935', '#00897B'],
    month:  '#1E88E5',
    place:  ['#1E88E5', '#43A047', '#FB8C00', '#8E24AA', '#E53935',
             '#00897B', '#FDD835', '#3949AB', '#D81B60', '#F4511E']
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
    if (from) params.append('from', from);
    if (to)   params.append('to',   to);

    const url = '/api/despatch/stats' + (params.toString() ? '?' + params.toString() : '');

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
            <span>${label}</span>
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

    const topZone = stats.byZone.length ? stats.byZone[0] : null;
    document.getElementById('statZone').textContent =
        topZone ? topZone.label : '—';

    const topMethod = stats.byMethod.length ? stats.byMethod[0] : null;
    document.getElementById('statMethod').textContent =
        topMethod ? topMethod.label : '—';

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

    // ── Zone Doughnut ─────────────────────────────────────
    const zoneLabels = stats.byZone.map(r => r.label);
    const zoneCounts = stats.byZone.map(r => r.count);

    if (zoneLabels.length) {
        charts.zone = new Chart(document.getElementById('chartZone'), {
            ...doughnutBase,
            data: {
                labels: zoneLabels,
                datasets: [{ data: zoneCounts, backgroundColor: COLORS.zone, borderWidth: 0, hoverOffset: 6 }]
            }
        });
        makeLegend('legendZone', zoneLabels, zoneCounts, total, COLORS.zone);
    } else {
        document.getElementById('chartZone').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No data yet</p>';
    }

    // ── Zone + Language Doughnut ──────────────────────────────
    const zoneLangLabels = (stats.byZoneLang || []).map(r => r.label);
    const zoneLangCounts = (stats.byZoneLang || []).map(r => r.count);

    if (zoneLangLabels.length) {
        charts.zoneLang = new Chart(document.getElementById('chartZoneLang'), {
            ...doughnutBase,
            data: {
                labels: zoneLangLabels,
                datasets: [{ data: zoneLangCounts, backgroundColor: COLORS.zoneLang, borderWidth: 0, hoverOffset: 6 }]
            }
        });
        makeLegend('legendZoneLang', zoneLangLabels, zoneLangCounts, total, COLORS.zoneLang);
    } else {
        const zlEl = document.getElementById('chartZoneLang');
        if(zlEl) {
           zlEl.parentElement.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No data yet</p>';
        }
    }

    // ── Delivery Method Doughnut ──────────────────────────
    const methodLabels = stats.byMethod.map(r => r.label);
    const methodCounts = stats.byMethod.map(r => r.count);

    if (methodLabels.length) {
        charts.method = new Chart(document.getElementById('chartMethod'), {
            ...doughnutBase,
            data: {
                labels: methodLabels,
                datasets: [{ data: methodCounts, backgroundColor: COLORS.method, borderWidth: 0, hoverOffset: 6 }]
            }
        });
        makeLegend('legendMethod', methodLabels, methodCounts, total, COLORS.method);
    } else {
        document.getElementById('chartMethod').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No data yet</p>';
    }

    // ── Language Doughnut ─────────────────────────────────
    const langLabels = stats.byLanguage.map(r => r.label);
    const langCounts = stats.byLanguage.map(r => r.count);

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
                labels: stats.byMonth.map(r => r.label),
                datasets: [{
                    label: 'Letters Despatched',
                    data: stats.byMonth.map(r => r.count),
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

    // ── Top Places Horizontal Bar ─────────────────────────
    if (stats.byPlace.length) {
        charts.place = new Chart(document.getElementById('chartPlace'), {
            type: 'bar',
            data: {
                labels: stats.byPlace.map(r => r.label),
                datasets: [{
                    label: 'Letters',
                    data: stats.byPlace.map(r => r.count),
                    backgroundColor: COLORS.place.map(c => c + 'bb'),
                    borderColor: COLORS.place,
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
        document.getElementById('chartPlace').parentElement.innerHTML =
            '<p style="color:var(--text-muted);text-align:center;margin-top:40px">No place data yet</p>';
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
