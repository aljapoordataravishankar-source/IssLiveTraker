// js/iss.js

const ISS_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';

const STANDBY_TLE = `ISS (ZARYA)
1 25544U 98067A   23292.51860000  .00016717  00000-0  30164-3 0  9997
2 25544  51.6416 270.8322 0001046 226.5414 266.3887 15.49887702421376`;

let satrec = null;

export async function loadTLE() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
        const response = await fetch(ISS_TLE_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error("Fetch failed");
        const data = await response.text();
        
        const lines = data.split('\n').map(l => l.trim());
        let tle1 = '', tle2 = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('1 25544')) {
                tle1 = lines[i];
                tle2 = lines[i+1];
                break;
            }
        }
        
        if (tle1 && tle2) {
            satrec = window.satellite.twoline2satrec(tle1, tle2);
            return satrec;
        }
    } catch (e) {
        console.warn("Failed to fetch TLE, using standby payload", e);
    }
    
    // Fallback
    const fallbackLines = STANDBY_TLE.split('\n').map(l => l.trim());
    satrec = window.satellite.twoline2satrec(fallbackLines[1], fallbackLines[2]);
    return satrec;
}

export function getSatrec() {
    return satrec;
}

export function getPositionData(date = new Date()) {
    if (!satrec) return null;
    
    const posVel = window.satellite.propagate(satrec, date);
    if (!posVel.position || posVel.position === false) return null;

    const gmst = window.satellite.gstime(date);
    const geodetic = window.satellite.eciToGeodetic(posVel.position, gmst);
    
    const velocityKmS = Math.sqrt(
        Math.pow(posVel.velocity.x, 2) + 
        Math.pow(posVel.velocity.y, 2) + 
        Math.pow(posVel.velocity.z, 2)
    );
    
    const meanMotionRad = satrec.no;
    const periodMin = (2 * Math.PI) / meanMotionRad;

    return {
        lat: satellite.degreesLat(geodetic.latitude),
        lon: satellite.degreesLong(geodetic.longitude),
        alt: geodetic.height, // km
        velocity: velocityKmS, // km/s
        period: periodMin, // min
        eci: posVel.position, // x, y, z in km
        gmst: gmst, // radians
        date: date
    };
}

export function getOrbitPath(baseDate = new Date(), minutesPast = 45, minutesFuture = 45, stepMin = 1) {
    if (!satrec) return { past: [], future: [] };
    
    const past = [];
    const future = [];
    const timeMs = baseDate.getTime();
    
    for (let i = 0; i <= minutesFuture; i += stepMin) {
        let p = getPositionData(new Date(timeMs + i * 60000));
        if (p) future.push(p.eci);
    }
    
    for (let i = 0; i >= -minutesPast; i -= stepMin) {
        let p = getPositionData(new Date(timeMs + i * 60000));
        if (p) past.push(p.eci);
    }
    past.reverse();

    return { past, future };
}
