// PitWise logic: login, page navigation, race simulation, strategy result and lap chart.
(function () {
  "use strict";

  const TOTAL_LAPS = 53;
  // Seconds lost by staying out when a rival pits (the rival may gain track position).
  const UNDERCUT_PENALTY = 2.0;
  // Number of simulated races per analysis.
  const SIM_RUNS = 2000;
  const STRATS = ["Stay out", "Pit now", "Pit in 5 laps", "Pit under Safety Car"];
  const COLORS = { "Stay out": "#ff3b57", "Pit now": "#22c55e", "Pit in 5 laps": "#38bdf8" };
  const PAGES = ["dashboard", "conditions", "strategy", "demo"];
  const STORAGE_KEY = "pitwise.driver";
  const $ = (id) => document.getElementById(id);

  // Keep a number between a lowest and highest value.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Extra seconds lost per lap because of worn tyres.
  // Wear below 40% costs almost nothing, and the cost rises faster above that.
  function wearPenalty(wear) {
    const x = Math.max(0, (wear - 40) / 100);
    return x * x * 10;
  }

  // Reads the current values from the race conditions inputs.
  function readState() {
    return {
      lap: clamp(parseInt($("lap").value, 10) || 1, 1, TOTAL_LAPS - 1),
      position: clamp(parseInt($("position").value, 10) || 1, 1, 20),
      wear: Number($("wear").value),
      rain: document.querySelector('input[name="weather"]:checked').value === "rain",
      sc: document.querySelector('input[name="sc"]:checked').value === "on",
      rivalPits: document.querySelector('input[name="rival"]:checked').value === "yes",
    };
  }

  // ---------- Fixed-plan baseline (no surprises) ----------

  // Builds the time-lost functions for each fixed option, used for the lap chart.
  // Each function takes the number of laps from now and returns the total extra seconds so far.
  function plan(s) {
    const remaining = TOTAL_LAPS - s.lap;
    const pitLoss = s.sc ? 11 : 22;          // a Safety Car makes a stop cheaper
    const dry = s.rain ? 1.2 : 0;            // dry tyres lose grip in the rain
    const fresh = s.rain ? 0.1 : 0.05;       // intermediates in rain, new dry tyres otherwise
    const wait = Math.min(5, remaining);
    const undercut = s.rivalPits ? UNDERCUT_PENALTY : 0;

    function stay(i) {
      return i * (wearPenalty(s.wear) + dry) + undercut;
    }

    function pitNow(i) {
      return pitLoss + i * fresh;
    }

    function later(i) {
      const waited = Math.min(i, wait);
      let total = 0;
      for (let k = 1; k <= waited; k++) {
        total += wearPenalty(s.wear + 2 * k) + dry;
      }
      if (i >= wait) {
        total += pitLoss + (i - wait) * fresh;
      }
      return total;
    }

    return { remaining, stay, pitNow, later };
  }

  // ---------- Race simulation ----------

  // A small, repeatable random number generator (same inputs give the same result).
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Turns the input text into a number seed (FNV-1a hash).
  function hashSeed(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // Random events for one race: Safety Car periods, weather changes and a rival pit call.
  function makeEvents(s, R, rnd) {
    const sc = [];
    const wet = [];
    let scLeft = s.sc ? 3 : 0;
    let rain = s.rain;

    for (let lap = 1; lap <= R; lap++) {
      if (lap > 1) {
        if (scLeft > 0) scLeft--;
        else if (rnd() < 0.015) scLeft = 3;              // a Safety Car comes out for 3 laps
        if (!rain && rnd() < 0.01) rain = true;          // rain starts
        else if (rain && rnd() < 0.02) rain = false;     // rain stops
      }
      sc.push(scLeft > 0);
      wet.push(rain);
    }

    // With the rival already pitting, the undercut always applies. Otherwise it is a 25% chance.
    return { sc: sc, wet: wet, rival: s.rivalPits || rnd() < 0.25 };
  }

  // Extra seconds lost for one strategy in one simulated race. Lower is better.
  function raceLoss(strat, s, R, ev) {
    let total = 0;
    let wear = s.wear;
    let inters = false;
    let pitted = false;

    for (let i = 0; i < R; i++) {
      const lap = i + 1;
      const sc = ev.sc[i];
      const wet = ev.wet[i];

      const wantPit =
        !pitted &&
        ((strat === "Pit now" && lap === 1) ||
          (strat === "Pit in 5 laps" && lap === Math.min(5, R)) ||
          (strat === "Pit under Safety Car" && (sc || lap === Math.min(10, R))));

      if (wantPit) {
        total += sc ? 11 : 22;   // pit stops are cheaper under a Safety Car
        pitted = true;
        wear = 20;               // new tyres
        inters = wet;            // intermediates if it is raining at the stop
      }

      total += wearPenalty(wear);
      if (wet) total += inters ? 0.1 : 1.2;
      else total += inters ? 1.5 : 0.05;

      wear = Math.min(100, wear + 2);
    }

    if (strat === "Stay out" && ev.rival) total += UNDERCUT_PENALTY;
    return total;
  }

  // Runs many races. Every option faces the same random events, so the comparison is fair.
  function runSimulation(s, R) {
    const rnd = mulberry32(hashSeed(JSON.stringify(s)));
    const wins = {};
    const sums = {};
    STRATS.forEach(function (n) { wins[n] = 0; sums[n] = 0; });

    let scRaces = 0;
    let weatherRaces = 0;
    let rivalRaces = 0;

    for (let k = 0; k < SIM_RUNS; k++) {
      const ev = makeEvents(s, R, rnd);
      if (ev.sc.some(Boolean)) scRaces++;
      if (ev.wet.some(function (w) { return w !== s.rain; })) weatherRaces++;
      if (ev.rival) rivalRaces++;

      let bestTime = null;
      let bestName = null;
      STRATS.forEach(function (name) {
        const t = raceLoss(name, s, R, ev);
        sums[name] += t;
        if (bestTime === null || t < bestTime) {
          bestTime = t;
          bestName = name;
        }
      });
      wins[bestName]++;
    }

    const results = STRATS.map(function (name) {
      return { name: name, win: (wins[name] / SIM_RUNS) * 100, avg: sums[name] / SIM_RUNS };
    }).sort(function (a, b) { return b.win - a.win || a.avg - b.avg; });

    return {
      results: results,
      scChance: (scRaces / SIM_RUNS) * 100,
      weatherChance: (weatherRaces / SIM_RUNS) * 100,
      rivalChance: (rivalRaces / SIM_RUNS) * 100,
    };
  }

  // Updates the dashboard tiles.
  function updateDashboard(s, remaining) {
    $("s-lap").textContent = s.lap + " / " + TOTAL_LAPS;
    $("s-pos").textContent = "P" + s.position;
    $("s-wear").textContent = s.wear + "%";
    $("s-weather").textContent = s.rain ? "Rain" : "Dry";
    $("s-sc").textContent = s.sc ? "Active" : "Inactive";
    $("s-rival").textContent = s.rivalPits ? "Pitting" : "Staying out";
    $("s-left").textContent = remaining;
    $("wear-out").textContent = s.wear + "%";
  }

  // Draws the lap-by-lap chart as an SVG (no-surprise baseline).
  function drawChart(s, p) {
    const W = 600, H = 260, PAD = 40;
    const n = p.remaining;
    const series = [
      { name: "Stay out", fn: p.stay },
      { name: "Pit now", fn: p.pitNow },
      { name: "Pit in 5 laps", fn: p.later },
    ];

    const data = series.map(function (se) {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(se.fn(i));
      return pts;
    });

    const maxY = Math.max.apply(null, [].concat.apply([], data)) * 1.05 || 1;
    const x = (i) => PAD + (i / n) * (W - 2 * PAD);
    const y = (v) => H - PAD - (v / maxY) * (H - 2 * PAD);

    let html = "";

    for (let g = 0; g <= 4; g++) {
      const v = (maxY / 4) * g;
      html += '<line x1="' + PAD + '" x2="' + (W - PAD) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#24304f"/>';
      html += '<text x="' + (PAD - 6) + '" y="' + (y(v) + 4) + '" fill="#97a3c7" font-size="11" text-anchor="end">' + Math.round(v) + " s</text>";
    }

    series.forEach(function (se, k) {
      const pts = data[k].map(function (v, i) { return x(i).toFixed(1) + "," + y(v).toFixed(1); }).join(" ");
      html += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[se.name] + '" stroke-width="2.5" stroke-linejoin="round"/>';
    });

    html += '<text x="' + PAD + '" y="' + (H - 10) + '" fill="#97a3c7" font-size="11">Now (lap ' + s.lap + ')</text>';
    html += '<text x="' + (W - PAD) + '" y="' + (H - 10) + '" fill="#97a3c7" font-size="11" text-anchor="end">Finish (lap ' + TOTAL_LAPS + ')</text>';

    $("chart").innerHTML = html;
  }

  // Runs the full analysis: simulation for the recommendation, fixed plan for the chart.
  function analyse() {
    const s = readState();
    const p = plan(s);
    updateDashboard(s, p.remaining);

    const sim = runSimulation(s, p.remaining);
    const top = sim.results[0];
    const second = sim.results[1];
    const gap = top.win - second.win;

    // Reasons, based on the simulation.
    const reasons = [];
    reasons.push("Wins " + top.win.toFixed(0) + "% of " + SIM_RUNS.toLocaleString() + " simulated races, the best of the four options.");

    if (s.wear >= 70) {
      reasons.push("Tyres are heavily worn at " + s.wear + "%, so each lap on them costs more time.");
    } else {
      reasons.push("Tyres at " + s.wear + "% still have grip, so staying out costs little.");
    }

    reasons.push("A Safety Car comes out in " + sim.scChance.toFixed(0) + "% of simulated races.");
    reasons.push("The weather changes in " + sim.weatherChance.toFixed(0) + "% of simulated races.");

    if (s.rivalPits) {
      reasons.push("A rival is pitting now. Staying out costs about 2 s.");
    } else {
      reasons.push("A rival pits in about " + sim.rivalChance.toFixed(0) + "% of races. Staying out then costs about 2 s.");
    }

    $("rec").innerHTML =
      "<h3>Recommendation: " + top.name.toLowerCase() + "</h3>" +
      "<strong>Why?</strong><ul>" +
      reasons.map(function (r) { return "<li>" + r + "</li>"; }).join("") +
      "</ul>";

    // The fixed plan with no surprises, shown for comparison.
    const base = [
      { name: "Stay out", total: p.stay(p.remaining) },
      { name: "Pit now", total: p.pitNow(p.remaining) },
      { name: "Pit in 5 laps", total: p.later(p.remaining) },
    ].sort(function (a, b) { return a.total - b.total; })[0];
    $("baseline").textContent = "If nothing unexpected happens, the best plan is " + base.name.toLowerCase() + ".";

    if (top.win >= 50 && gap >= 15) {
      $("confidence").textContent =
        "Strong edge: " + top.win.toFixed(0) + "% win chance, " + gap.toFixed(0) + " points ahead of " + second.name.toLowerCase() + ".";
    } else if (top.win >= 35 && gap >= 8) {
      $("confidence").textContent =
        "Lean: this option wins " + top.win.toFixed(0) + "% of races. " + second.name + " is next at " + second.win.toFixed(0) + "%.";
    } else {
      $("confidence").textContent =
        "Toss-up: no option wins clearly. The best is only " + top.win.toFixed(0) + "%. Judge the risk yourself.";
    }

    $("alt").textContent = "Next best: " + second.name + " (" + second.win.toFixed(0) + "% win chance).";

    // Comparison table: win chance with a bar, and the average time lost.
    $("rows").innerHTML = sim.results
      .map(function (o, i) {
        const width = Math.max(3, o.win).toFixed(0);
        return (
          '<tr class="' + (i === 0 ? "best" : "") + '">' +
          "<td>" + o.name + '<div class="bar" style="width:' + width + '%"></div></td>' +
          "<td>" + o.win.toFixed(0) + "%</td>" +
          "<td>" + o.avg.toFixed(1) + " s</td>" +
          "</tr>"
        );
      })
      .join("");

    drawChart(s, p);
  }

  // ---------- Login and profile ----------

  // Reads the saved driver. Storage can be blocked, so every access is guarded.
  function loadDriver() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveDriver(driver) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(driver)); } catch (e) { /* page still works */ }
  }

  function clearDriver() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* page still works */ }
  }

  let driver = loadDriver();

  // Two-letter initials for the avatar, e.g. "Srusti Jadhav" -> "SJ".
  function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const letters = parts.slice(0, 2).map(function (p) { return p.charAt(0); }).join("");
    return letters.toUpperCase() || "?";
  }

  function updateProfile() {
    $("profile-name").textContent = driver.name;
    $("profile-team").textContent = driver.team || "No team";
    $("avatar").textContent = initials(driver.name);
  }

  // ---------- Page navigation ----------

  function showOnly(id) {
    document.querySelectorAll(".page").forEach(function (sec) {
      sec.hidden = sec.id !== id;
    });
  }

  // Shows the page named in the address hash, or the login page when nobody is logged in.
  function render() {
    const loggedIn = !!driver;
    $("appbar").hidden = !loggedIn;
    $("topnav").hidden = !loggedIn;

    if (!loggedIn) {
      showOnly("page-login");
      return;
    }

    updateProfile();
    const requested = location.hash.replace("#", "");
    const page = PAGES.indexOf(requested) === -1 ? "dashboard" : requested;
    showOnly("page-" + page);

    document.querySelectorAll("#topnav a").forEach(function (a) {
      if (a.dataset.page === page) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    window.scrollTo(0, 0);
  }

  function go(page) {
    location.hash = "#" + page;
    render();
  }

  // Buttons with data-go move between pages.
  document.addEventListener("click", function (e) {
    const btn = e.target.closest("[data-go]");
    if (btn) go(btn.dataset.go);
  });

  window.addEventListener("hashchange", render);

  // Login: the name is required. No password is checked in this prototype.
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = $("login-name").value.trim();
    if (!name) {
      $("login-error").textContent = "Please enter your driver name.";
      $("login-error").classList.add("error");
      $("login-name").focus();
      return;
    }
    $("login-error").textContent = "";
    $("login-error").classList.remove("error");
    driver = { name: name, team: $("login-team").value.trim() };
    saveDriver(driver);
    go("dashboard");
  });

  $("logout").addEventListener("click", function () {
    driver = null;
    clearDriver();
    $("login-name").value = "";
    $("login-team").value = "";
    location.hash = "";
    render();
  });

  // ---------- Race analysis ----------

  // The conditions inputs update the dashboard and strategy as they change.
  $("page-conditions").querySelectorAll("input").forEach(function (el) {
    el.addEventListener("input", analyse);
    el.addEventListener("change", analyse);
  });

  // Analyse race runs the analysis and opens the strategy page.
  $("analyse").addEventListener("click", function () {
    analyse();
    $("status").textContent = "Analysis updated.";
    go("strategy");
  });

  // Fill the dashboard and strategy results on load.
  analyse();
  render();
})();
