# Yukti_Formula1_Pitwise1
PitWise: F1 pit strategy advisor. Runs 2,000 simulated races with Safety Cars, weather changes and rival moves to find the strategy with the best win chance.
# PitWise: F1 Pit Strategy Advisor

PitWise helps a Formula 1 race team decide when to pit. It runs 2,000 simulated races for each analysis, with random Safety Car periods, weather changes and rival pit calls. It then shows which strategy has the best chance to win.

> Simulation only. PitWise does not use live or real Formula 1 data. All numbers are assumptions chosen for this prototype.

## Features

- **Driver login:** enter a name and optional team. The name and initials show at the top right, with a Log out button.
- **Race dashboard:** six tiles show the current lap, position, tyre wear, weather, Safety Car and rival status.
- **Race conditions:** set the lap, position, tyre wear, weather, Safety Car and rival pit call.
- **Strategy page:**
  - A recommendation with reasons and a confidence level (strong edge, lean or toss-up).
  - A comparison table with each option's win chance and average time lost.
  - A lap-by-lap chart of the plan when nothing unexpected happens.
- **Demo and guide page:** a demo video and six how-to steps.
- **Responsive design:** works on desktop and phone screens.

## How the strategy works

1. You enter the race situation and press **Analyse race**.
2. The app plays 2,000 races. Each race has random events: Safety Car periods, weather changes and a possible rival pit call.
3. Four strategies run in every race: stay out, pit now, pit in 5 laps, and pit under a Safety Car. They all face the same events, so the comparison is fair.
4. In each race, the strategy that loses the least time wins that race.
5. The strategy that wins the most races is the recommendation.

## Run it

No installation is needed.

1. Download or clone this repository.
2. Keep `index.html`, `style.css` and `script.js` in the same folder.
3. Open `index.html` in any modern browser.

To show the demo video, add a file named `demo.mp4` to the same folder.

You can also run it online:
- **CodePen:** paste the HTML, CSS and JavaScript into the three panels.
- **GitHub Pages:** in **Settings > Pages**, choose the `main` branch and the root folder.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page layout: login, dashboard, race conditions, strategy, demo |
| `style.css` | Design, colours and responsive layout |
| `script.js` | Login, page navigation, race simulation, recommendation and chart |
| `demo.mp4` | Optional demo video (add it yourself) |

## Assumptions and limits

- A pit stop costs 22 seconds, or 11 seconds under a Safety Car.
- Worn tyres cost more time each lap. Wear below about 40% costs almost nothing.
- Dry tyres in the rain lose 1.2 seconds per lap. Intermediate tyres lose 0.1 seconds per lap.
- A rival pit call adds 2 seconds to staying out.
- The app does not know other cars' positions or lap times, so it cannot guarantee a win.
- Login is a prototype: no password is checked, and the name is saved only in the browser.

## Tech stack

- HTML, CSS and vanilla JavaScript (no frameworks, no build step)
- SVG for the lap chart
- Inter font from Google Fonts

## Event

ZERO HOUR hackathon, Theme 1: Formula 1 Pit Strategist.

Team: [add your team name and members]
