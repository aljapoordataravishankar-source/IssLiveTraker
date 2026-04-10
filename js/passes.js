// js/passes.js
import * as satellite from 'satellite.js';
import { getSatrec } from './iss.js';

export function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!("geolocation" in navigator)) {
            return reject(new Error("Geolocation not supported by browser."));
        }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
            err => reject(err),
            { timeout: 10000, maximumAge: 60000 }
        );
    });
}

export function getNextPasses(userLat, userLon, userAlt = 0, count = 5) {
    const satrec = getSatrec();
    if (!satrec) return [];
    
    const obsLatRad = userLat * Math.PI / 180;
    const obsLonRad = userLon * Math.PI / 180;
    
    const passes = [];
    const now = new Date();
    let currentMs = now.getTime();
    const stepMs = 60 * 1000;
    const maxMs = now.getTime() + 10 * 24 * 60 * 60 * 1000; // max 10 days ahead
    
    let inPass = false;
    let currentPass = null;

    while (currentMs < maxMs && passes.length < count) {
        let stepDate = new Date(currentMs);
        let posAndVel = satellite.propagate(satrec, stepDate);
        if (posAndVel.position && posAndVel.position !== false) {
            let gmst = satellite.gstime(stepDate);
            let positionEcf = satellite.eciToEcf(posAndVel.position, gmst);
            let observerGd = { longitude: obsLonRad, latitude: obsLatRad, height: userAlt };
            
            let lookAngles = satellite.ecfToLookAngles(observerGd, positionEcf);
            let elevation = lookAngles.elevation * 180 / Math.PI;
            
            if (elevation > 10) { 
                if (!inPass) {
                    inPass = true;
                    currentPass = {
                        start: stepDate,
                        maxElevation: elevation,
                        end: null
                    };
                } else {
                    currentPass.maxElevation = Math.max(currentPass.maxElevation, elevation);
                }
            } else {
                if (inPass) {
                    inPass = false;
                    currentPass.end = stepDate;
                    passes.push(currentPass);
                    currentPass = null;
                }
            }
        }
        currentMs += stepMs;
    }
    return passes;
}
