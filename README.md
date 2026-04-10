# 3D Live ISS Tracker

A high-performance, purely front-end web application that tracks the International Space Station (ISS) in real-time, rendered in rich interactive 3D. 

## Features
- **Real-Time 3D Rendering**: Built with Three.js. It features a high-fidelity Earth model, complete with a bump map, specular map, and atmospheric glow.
- **Accurate Orbital Mechanics**: Uses `satellite.js` to propagate standard Two-Line Element (TLE) satellite data and accurately calculate the ISS's position without relying on external API computations.
- **Live TLE Pull**: Automatically fetches the latest trajectory data directly from Celestrak.
- **Pass Prediction**: Uses browser geolocation to predict the next overhead appearances of the ISS in your local sky.
- **Time Controls**: Allows rewinding or fast-forwarding the simulated time by up to 12 hours.

## How to Run Locally
Because this application is 100% frontend and relies on ES Modules and `fetch` requests, it needs to be served via a local web server to avoid CORS/file protocol restrictions.

1. Install a simple local HTTP server, for example `serve` via Node.js:
   ```bash
   npx serve .
   ```
2. Navigate to the provided local URL (typically `http://localhost:3000`).

Alternatively, you can open the folder using the "Live Server" extension in VS Code.

## Architecture
- `index.html`: Entry point and UI structure.
- `css/style.css`: Provides the dark, HUD-style glassmorphic design space theme.
- `js/main.js`: Initializes and manages the Three.js 3D scene, rotation, controls, and active loop.
- `js/iss.js`: Contains logic wrapping `satellite.js` to process the ISS's TLE set.
- `js/passes.js`: Performs line-of-sight elevation predictions relative to the user's geocoordinates.
- `js/ui.js`: Synchronizes telemetry models with the DOM elements.

## Attributions & Libraries Used
- **Three.js**: A lightweight, 3D library with a default WebGL renderer ([MIT License](https://github.com/mrdoob/three.js/blob/dev/LICENSE)).
- **Satellite.js**: Library for TLE propagation and orbital calculations ([MIT License](https://github.com/shashwatak/satellite-js/blob/master/LICENSE)).
- **Celestrak**: Origin for the live unformatted ISS TLE data.
- **NASA Blue Marble**: Open-source textural maps used for wrapping the Earth sphere geometry. Loaded via public CDN in this demo.

## License
Published under the [MIT License](LICENSE).
