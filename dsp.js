import { PitchDetector } from 'https://cdn.jsdelivr.net/npm/pitchy@4.1.2/dist/pitchy.mjs';

let audioContext;
let sourceNode;
let meydaAnalyzer;
let pitchDetector;
let isRunning = false;

// DOM Elements
const startBtn = document.getElementById('startButton');
const stopBtn = document.getElementById('stopButton');
const kickInd = document.getElementById('kickIndicator');
const snareInd = document.getElementById('snareIndicator');
const pitchInd = document.getElementById('pitchIndicator');
const pitchVal = document.getElementById('pitchValue');

// Debug Elements
const debugFlatness = document.getElementById('debugFlatness');
const debugEnergy = document.getElementById('debugEnergy');
const debugLowBins = document.getElementById('debugLowBins');

// Detection Constants (Tweakable)
const BUFFER_SIZE = 2048; // Good resolution for pitch & low bins
const MIN_ENERGY_THRESHOLD = 1.5; // Noise gate
const KICK_LOW_BINS_THRESHOLD = 30; // Energy required in first few bins
const SNARE_FLATNESS_THRESHOLD = 0.35; // How noisy the signal is (0-1)
const TONE_FLATNESS_THRESHOLD = 0.15; // Clean tones have low flatness

// Debounce state to avoid rapid re-triggering of animations
let kickCooldown = false;
let snareCooldown = false;

startBtn.addEventListener('click', async () => {
    // 1. Initialize Audio Context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    try {
        // 2. Request Microphone Access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        sourceNode = audioContext.createMediaStreamSource(stream);
        
        // 3. Initialize Pitchy
        pitchDetector = PitchDetector.forFloat32Array(BUFFER_SIZE);
        
        // 4. Initialize Meyda
        meydaAnalyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: sourceNode,
            bufferSize: BUFFER_SIZE,
            featureExtractors: ['spectralFlatness', 'energy', 'amplitudeSpectrum', 'buffer'],
            callback: (features) => {
                analyzeFeatures(features);
            }
        });
        
        meydaAnalyzer.start();
        isRunning = true;
        
        // Update UI
        startBtn.disabled = true;
        stopBtn.disabled = false;
        
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Could not access the microphone. Please ensure permissions are granted.');
    }
});

stopBtn.addEventListener('click', () => {
    if (meydaAnalyzer) meydaAnalyzer.stop();
    if (audioContext) audioContext.close();
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    
    kickInd.classList.remove('active');
    snareInd.classList.remove('active');
    pitchInd.classList.remove('active');
});

function analyzeFeatures(features) {
    if (!features || !isRunning) return;
    
    const { energy, spectralFlatness, amplitudeSpectrum, buffer } = features;
    
    // Calculate low bins energy (First 4 bins representing low frequencies)
    let lowBinsEnergy = 0;
    for (let i = 0; i < 4; i++) {
        lowBinsEnergy += amplitudeSpectrum[i];
    }
    
    // Update Debug Metrics
    debugFlatness.textContent = spectralFlatness.toFixed(3);
    debugEnergy.textContent = energy.toFixed(2);
    debugLowBins.textContent = lowBinsEnergy.toFixed(2);
    
    // Noise Gate: Ignore background noise
    if (energy < MIN_ENERGY_THRESHOLD) {
        pitchInd.classList.remove('active');
        return; 
    }
    
    let isKick = false;
    let isSnare = false;
    
    // ----------------------------------------------------
    // Beatbox Logic: Kick vs Snare
    // ----------------------------------------------------
    if (lowBinsEnergy > KICK_LOW_BINS_THRESHOLD && spectralFlatness < SNARE_FLATNESS_THRESHOLD) {
        isKick = true;
        triggerIndicator(kickInd, 'kick');
    } else if (spectralFlatness >= SNARE_FLATNESS_THRESHOLD) {
        isSnare = true;
        triggerIndicator(snareInd, 'snare');
    }
    
    // ----------------------------------------------------
    // Synth/Pitch Logic
    // Optimization: Only run pitch detector if flatness is low
    // ----------------------------------------------------
    if (spectralFlatness < TONE_FLATNESS_THRESHOLD && !isKick) {
        // Meyda provides standard JS Array, Pitchy needs Float32Array
        const float32Buffer = new Float32Array(buffer);
        const [pitch, clarity] = pitchDetector.findPitch(float32Buffer, audioContext.sampleRate);
        
        // Update UI if the pitch is clear
        if (clarity > 0.8 && pitch > 50 && pitch < 2000) { // Reasonable vocal/synth range
            pitchVal.textContent = `${Math.round(pitch)} Hz`;
            pitchInd.classList.add('active');
        } else {
            pitchInd.classList.remove('active');
        }
    } else {
        pitchInd.classList.remove('active');
    }
}

function triggerIndicator(element, type) {
    if (type === 'kick' && kickCooldown) return;
    if (type === 'snare' && snareCooldown) return;
    
    element.classList.add('active');
    
    if (type === 'kick') {
        kickCooldown = true;
        setTimeout(() => {
            element.classList.remove('active');
            kickCooldown = false;
        }, 150); // Debounce time
    }
    
    if (type === 'snare') {
        snareCooldown = true;
        setTimeout(() => {
            element.classList.remove('active');
            snareCooldown = false;
        }, 150);
    }
}
