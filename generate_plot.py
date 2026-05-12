import numpy as np
import matplotlib.pyplot as plt
import scipy.signal
import warnings
warnings.filterwarnings('ignore')

# Generate a synthetic "hit" (e.g., a kick drum or woodblock sound)
sr = 44100
t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)

# Kick drum: fast frequency sweep (pitch drop) and exponential decay
f0 = 150.0  # starting freq
f1 = 40.0   # ending freq
decay = np.exp(-12 * t)
phase = 2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / sr
kick = np.sin(phase) * decay

# Add a little bit of noise at the attack
noise_decay = np.exp(-100 * t)
noise = np.random.randn(len(t)) * noise_decay * 0.3
hit = kick + noise
hit = hit / np.max(np.abs(hit)) # normalize

# Create plot with a solid dark background
plt.style.use('dark_background')
fig, axes = plt.subplots(3, 1, figsize=(10, 8))
fig.patch.set_facecolor('#1a1a1a') # Set solid background color
fig.suptitle('Audio Analysis "Beneath the Hood"', fontsize=16, color='white')

# 1. Waveform
axes[0].plot(t, hit, color='cyan')
axes[0].set_title('Waveform (Time Domain)', color='white')
axes[0].set_ylabel('Amplitude', color='white')
axes[0].set_xlim([0, 0.2])
axes[0].tick_params(colors='white')
axes[0].set_facecolor('#1a1a1a')

# 2. Spectrogram using scipy
f, t_spec, Sxx = scipy.signal.spectrogram(hit, fs=sr, nperseg=1024, noverlap=512)
Sxx_db = 10 * np.log10(Sxx + 1e-10)
im = axes[1].pcolormesh(t_spec, f, Sxx_db, shading='gouraud', cmap='magma')
axes[1].set_title('Spectrogram (Frequency vs. Time)', color='white')
axes[1].set_xlim([0, 0.2])
axes[1].set_ylim([0, 5000])
axes[1].set_ylabel('Frequency (Hz)', color='white')
axes[1].tick_params(colors='white')
axes[1].set_facecolor('#1a1a1a')

cbar = fig.colorbar(im, ax=axes[1], format="%+2.0f dB")
cbar.ax.yaxis.set_tick_params(color='white')
cbar.ax.yaxis.set_ticklabels(cbar.ax.yaxis.get_ticklabels(), color='white')

# 3. Power Spectral Density (Welch's method)
f_welch, Pxx = scipy.signal.welch(hit, sr, nperseg=1024)
axes[2].semilogy(f_welch, Pxx, color='magenta')
axes[2].set_title('Frequency Spectrum (Power vs. Frequency)', color='white')
axes[2].set_xlabel('Time (s) / Frequency (Hz)', color='white')
axes[2].set_ylabel('Power', color='white')
axes[2].set_xlim([0, 5000])
axes[2].tick_params(colors='white')
axes[2].set_facecolor('#1a1a1a')

for ax in axes:
    for spine in ax.spines.values():
        spine.set_color('white')

plt.tight_layout()
# Save WITHOUT transparency so the dark background is preserved!
plt.savefig('audio_analysis_plot.png', dpi=300, bbox_inches='tight', transparent=False, facecolor='#1a1a1a', edgecolor='none')
