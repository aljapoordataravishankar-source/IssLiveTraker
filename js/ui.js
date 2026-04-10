// js/ui.js
import { getUserLocation, getNextPasses } from './passes.js';

let isLocating = false;

export function updateTelemetry(data) {
    if (!data) return;
    
    document.getElementById('tel-lat').textContent = `${data.lat.toFixed(4)}°`;
    document.getElementById('tel-lon').textContent = `${data.lon.toFixed(4)}°`;
    document.getElementById('tel-alt').textContent = `${data.alt.toFixed(2)} km`;
    document.getElementById('tel-vel').textContent = `${data.velocity.toFixed(2)} km/s`;
    document.getElementById('tel-period').textContent = `${data.period.toFixed(2)} min`;
    
    const d = data.date;
    const timeStr = d.toISOString().split('T')[1].split('.')[0];
    document.getElementById('tel-time').textContent = timeStr;
}

export function hideLoading() {
    const loading = document.getElementById('loading');
    loading.classList.add('fadeOut');
    setTimeout(() => { loading.classList.add('hidden'); }, 500);
}

export function setupUI(onTimeChange, onGoLive, onToggleFollow, onResetCamera) {
    const slider = document.getElementById('time-slider');
    const btnLive = document.getElementById('btn-live');
    const labelTime = document.getElementById('time-offset-label');
    const btnFollow = document.getElementById('btn-follow');
    
    slider.addEventListener('input', (e) => {
        const offsetMins = parseInt(e.target.value);
        if (offsetMins === 0) {
            btnLive.classList.add('hidden');
            labelTime.textContent = 'Live Time';
        } else {
            btnLive.classList.remove('hidden');
            const hrs = Math.floor(Math.abs(offsetMins) / 60);
            const mins = Math.abs(offsetMins) % 60;
            const sign = offsetMins > 0 ? '+' : '-';
            labelTime.textContent = `${sign}${hrs}h ${mins}m`;
        }
        onTimeChange(offsetMins);
    });
    
    btnLive.addEventListener('click', () => {
        slider.value = 0;
        slider.dispatchEvent(new Event('input'));
        onGoLive();
    });
    
    btnFollow.addEventListener('click', () => {
        const isActive = btnFollow.classList.toggle('active');
        onToggleFollow(isActive);
    });
    
    document.getElementById('btn-reset').addEventListener('click', () => {
        onResetCamera();
        if(!btnFollow.classList.contains('active')){
           btnFollow.classList.add('active');
           onToggleFollow(true);
        }
    });
    
    document.getElementById('btn-locate').addEventListener('click', async () => {
        if (isLocating) return;
        isLocating = true;
        const statusEl = document.getElementById('loc-status');
        const listEl = document.getElementById('pass-list');
        
        statusEl.textContent = "Detecting location...";
        statusEl.style.color = "var(--accent-cyan)";
        
        try {
            const loc = await getUserLocation();
            statusEl.textContent = `Location acquired: ${loc.lat.toFixed(2)}°, ${loc.lon.toFixed(2)}°`;
            statusEl.style.color = "#0f0";
            
            const passes = getNextPasses(loc.lat, loc.lon, 0, 5);
            listEl.innerHTML = '';
            
            if (passes.length === 0) {
                listEl.innerHTML = '<li class="placeholder">No passes in next 10 days</li>';
            } else {
                passes.forEach(p => {
                    const li = document.createElement('li');
                    const timeStr = p.start.toLocaleString(undefined, {
                        month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                    li.innerHTML = `
                        <span>${timeStr}</span>
                        <span class="pass-detail">Max Elev: ${p.maxElevation.toFixed(1)}°</span>
                    `;
                    listEl.appendChild(li);
                });
            }
        } catch (e) {
            statusEl.textContent = `Error: ${e.message}`;
            statusEl.style.color = "var(--accent-orange)";
        } finally {
            isLocating = false;
        }
    });
}
