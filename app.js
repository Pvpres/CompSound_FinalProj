console.log("Strudel-Sync Phase 2 initialized.");

// DOM Elements
const micButton = document.getElementById('micButton');
const volumeMeter = document.getElementById('volumeMeter');
const volumeText = document.getElementById('volumeText');
const flatnessText = document.getElementById('flatnessText');
const centroidText = document.getElementById('centroidText');
const detectedHitText = document.getElementById('detectedHitText');
const recordButton = document.getElementById('recordButton');
const codeOutput = document.getElementById('codeOutput');
const copyBtn = document.getElementById('copyBtn');
const clearCodeBtn = document.getElementById('clearCodeBtn');

copyBtn.addEventListener('click', () => {
    if (codeOutput.value) {
        navigator.clipboard.writeText(codeOutput.value).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = "Copied!";
            setTimeout(() => { copyBtn.innerText = originalText; }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    }
});

clearCodeBtn.addEventListener('click', () => {
    fullStrudelCode = "";
    codeOutput.value = "";
});

// Web Audio API and Meyda variables
let audioContext;
let micStream;
let sourceNode;
let meydaAnalyzer;
let isListening = false;

// Speech Recognition Variables
let speechRecognition;
let isSpeechActive = false;

// Classification Thresholds & State
const RMS_THRESHOLD = 0.05; // Minimum volume to register a "hit"
const CENTROID_THRESHOLD = 40; // Above this = Snare (high freq noise), Below this = Kick (low freq punch)
let lastHitTime = 0;
const COOLDOWN_MS = 150; // Milliseconds to wait before detecting the next hit

// Phase 4: Recording and Quantization variables
let isRecording = false;
let recordingCycleInterval;
let cycleStartTime = 0;
const CYCLE_DURATION_MS = 2000;
const SLOTS = 8; // Changed from 16 to 8 (each slot is now 250ms instead of 125ms)
const SLOT_DURATION_MS = CYCLE_DURATION_MS / SLOTS;
let beatArray = new Array(SLOTS).fill('~');

// Maintain full history to append cycles
let fullStrudelCode = "";

function startNewCycle() {
    const now = Date.now();
    
    // If a cycle was just completed, append its array to Strudel
    if (cycleStartTime !== 0) {
        // Format the string: $: s("[bd ~ ~ sd ...]")
        const patternString = beatArray.join(" ");
        
        // Append instead of overwrite
        if (fullStrudelCode !== "") {
            fullStrudelCode += "\n";
        }
        fullStrudelCode += `$: s("[${patternString}]")`;
        
        console.log("⏱️ Cycle Complete! Generated Strudel Code:\n", fullStrudelCode);
        
        // Output to UI text area for user to copy-paste
        codeOutput.value = fullStrudelCode;
        // Scroll to bottom
        codeOutput.scrollTop = codeOutput.scrollHeight;
    }
    
    // Reset for the new cycle
    cycleStartTime = now;
    beatArray = new Array(SLOTS).fill('~');
    console.log("⏱️ New 2-second recording cycle started!");
}

function startRecording() {
    isRecording = true;
    recordButton.innerText = "Stop Recording Cycle";
    recordButton.classList.add("primary");
    recordButton.style.backgroundColor = "#ff9800"; // Orange
    
    // Start cycle loop
    startNewCycle();
    recordingCycleInterval = setInterval(startNewCycle, CYCLE_DURATION_MS);
}

function stopRecording() {
    isRecording = false;
    clearInterval(recordingCycleInterval);
    cycleStartTime = 0;
    
    recordButton.innerText = "Start 2s Recording Cycle";
    recordButton.classList.remove("primary");
    recordButton.style.backgroundColor = "";
}

recordButton.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

async function startMic() {
    try {
        const constraints = { audio: true, video: false };
        
        // Check for mediaDevices support
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            micStream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
            const legacyGetUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
            if (!legacyGetUserMedia) {
                alert("Microphone access blocked! You MUST access this site via 'http://localhost:8000' (not an IP address) or use HTTPS.");
                throw new Error("getUserMedia is not supported or blocked by Secure Context restrictions.");
            }
            micStream = await new Promise((resolve, reject) => {
                legacyGetUserMedia.call(navigator, constraints, resolve, reject);
            });
        }
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        sourceNode = audioContext.createMediaStreamSource(micStream);
        
        // Setup Speech Recognition
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition && !speechRecognition) {
            speechRecognition = new SpeechRecognition();
            speechRecognition.continuous = true;
            speechRecognition.interimResults = false;
            
            speechRecognition.onresult = (event) => {
                const resultIndex = event.results.length - 1;
                const transcript = event.results[resultIndex][0].transcript.trim().toLowerCase();
                
                if (transcript.includes("rave")) {
                    console.log("🎤 Keyword Detected: rave");
                    if (fullStrudelCode !== "") {
                        fullStrudelCode += "\n";
                    }
                    if (typeof rave !== 'undefined') {
                        fullStrudelCode += rave;
                    } else {
                        fullStrudelCode += `// This is a rave`;
                    }
                    codeOutput.value = fullStrudelCode;
                    codeOutput.scrollTop = codeOutput.scrollHeight;
                }
            };
            
            speechRecognition.onerror = (e) => {
                console.warn("Speech Recognition Error:", e);
            };
            
            speechRecognition.onend = () => {
                // Auto-restart if we are still supposed to be listening
                if (isListening && isSpeechActive) {
                    try { speechRecognition.start(); } catch(e) {}
                }
            };
        }
        
        if (typeof Meyda === 'undefined') {
            console.error("Meyda.js is not loaded!");
            return;
        }

        meydaAnalyzer = Meyda.createMeydaAnalyzer({
            audioContext: audioContext,
            source: sourceNode,
            bufferSize: 512,
            featureExtractors: ['rms', 'spectralFlatness', 'spectralCentroid'],
            callback: features => {
                const now = Date.now();
                
                if (features && features.rms !== undefined) {
                    const rms = features.rms;
                    const flatness = features.spectralFlatness;
                    const centroid = features.spectralCentroid;
                    
                    if (rms > RMS_THRESHOLD && (now - lastHitTime > COOLDOWN_MS)) {
                        lastHitTime = now;
                        
                        let label = "";
                        let drumCode = "";
                        if (centroid > CENTROID_THRESHOLD) {
                            label = "Snare (Noise)";
                            drumCode = "sd";
                        } else {
                            label = "Kick (Low Freq)";
                            drumCode = "bd";
                        }
                        
                        const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
                        console.log(`🥁 HIT DETECTED! [${timestamp}] Label: ${label} | RMS: ${rms.toFixed(3)} | Centroid: ${centroid.toFixed(1)}`);
                        
                        // If recording, snap to the closest slot
                        if (isRecording && cycleStartTime !== 0) {
                            const timeSinceStart = now - cycleStartTime;
                            const slotIndex = Math.round(timeSinceStart / SLOT_DURATION_MS) % SLOTS;
                            beatArray[slotIndex] = drumCode;
                            console.log(`Snapped ${drumCode} to slot ${slotIndex}`);
                        }
                        
                        detectedHitText.innerText = `${label}`;
                        detectedHitText.style.color = centroid > CENTROID_THRESHOLD ? "#ffeb3b" : "#4caf50";
                        detectedHitText.style.textShadow = "0px 0px 10px white";
                        setTimeout(() => {
                            detectedHitText.style.textShadow = "none";
                        }, 100);
                    }
                    
                    const displayRms = Math.min(rms * 3, 1.0); 
                    volumeMeter.style.width = `${displayRms * 100}%`;
                    
                    volumeText.innerText = `RMS: ${rms.toFixed(4)}`;
                    flatnessText.innerText = flatness.toFixed(4);
                    if (centroidText) centroidText.innerText = centroid.toFixed(1);
                }
            }
        });
        
        meydaAnalyzer.start();
        isListening = true;
        recordButton.disabled = false; // Enable recording
        
        if (speechRecognition && !isSpeechActive) {
            try {
                speechRecognition.start();
                isSpeechActive = true;
                console.log("Speech Recognition started.");
            } catch(e) {
                console.warn("Could not start speech recognition:", e);
            }
        }
        
        micButton.innerText = "Stop Microphone";
        micButton.classList.remove("primary");
        micButton.style.backgroundColor = "#f44336";
        console.log("Microphone started. Meyda analyzer running.");
        
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Microphone access denied or not available. See console for details.");
    }
}

function stopMic() {
    if (isRecording) {
        stopRecording();
    }
    
    if (meydaAnalyzer) {
        meydaAnalyzer.stop();
    }
    
    if (speechRecognition && isSpeechActive) {
        try {
            speechRecognition.stop();
            isSpeechActive = false;
        } catch(e) {}
    }
    
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
    }
    
    isListening = false;
    recordButton.disabled = true; // Disable recording
    volumeMeter.style.width = "0%";
    volumeText.innerText = "RMS: 0.000";
    flatnessText.innerText = "0.000";
    if (centroidText) centroidText.innerText = "0.0";
    
    micButton.innerText = "Start Microphone";
    micButton.classList.add("primary");
    micButton.style.backgroundColor = ""; 
    console.log("Microphone stopped.");
}

micButton.addEventListener('click', () => {
    if (!isListening) {
        startMic();
    } else {
        stopMic();
    }
});
