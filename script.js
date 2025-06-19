import { parseBlob } from 'music-metadata-browser';
console.log("musicMetadata:", typeof musicMetadata);
let lrcDataList = [];
let audioList = [];
let currentTrack = 0;

const audio = document.getElementById('audio');
const currentLineDiv = document.getElementById('current-line');
const lyricsScreen = document.getElementById('lyrics-screen');
const controls = document.getElementById('controls');
const audioInput = document.getElementById('audioInput');
const lrcInput = document.getElementById('lrcInput');
const bgBlur = document.getElementById('bg-blur');
const trackSelector = document.getElementById('trackSelector');
const trackSelectorContainer = document.getElementById('trackSelectorContainer');
const trackSelectorFullscreen = document.getElementById('trackSelectorFullscreen');
const fullscreenControls = document.getElementById('fullscreen-controls');
const prevTrackBtn = document.getElementById('prevTrackBtn');
const nextTrackBtn = document.getElementById('nextTrackBtn');
const playPauseBtn = document.getElementById('playPauseBtn');
const waveformDiv = document.getElementById('waveform');

let wavesurfer = null;
let tracks = []; // Ogni elemento: { audioFile, lrcFile, name }

audioInput.addEventListener('change', handleFiles);
lrcInput.addEventListener('change', handleFiles);

function handleFiles() {
  // Mappa nome base → file
  const audioMap = {};
  const lrcMap = {};

  Array.from(audioInput.files).forEach(file => {
    const name = file.name.replace(/\.[^/.]+$/, "");
    audioMap[name] = file;
  });
  Array.from(lrcInput.files).forEach(file => {
    const name = file.name.replace(/\.[^/.]+$/, "");
    lrcMap[name] = file;
  });

  // Crea lista tracce abbinate solo se esistono entrambi
  tracks = [];
  Object.keys(audioMap).forEach(name => {
    if (lrcMap[name]) {
      tracks.push({
        name,
        audioFile: audioMap[name],
        lrcFile: lrcMap[name]
      });
    }
  });

  updateTrackSelector();
}

function updateTrackSelector() {
  trackSelector.innerHTML = '';
  trackSelectorFullscreen.innerHTML = '';
  if (tracks.length > 0) {
    tracks.forEach((track, i) => {
      trackSelector.innerHTML += `<option value="${i}">${track.name}</option>`;
      trackSelectorFullscreen.innerHTML += `<option value="${i}">${track.name}</option>`;
    });
    trackSelectorContainer.style.display = '';
    fullscreenControls.style.display = 'flex';
    selectTrack(0);
  } else {
    trackSelectorContainer.style.display = 'none';
    fullscreenControls.style.display = 'none';
  }
}

trackSelector.addEventListener('change', (e) => {
  trackSelectorFullscreen.value = e.target.value;
  selectTrack(Number(e.target.value));
});
trackSelectorFullscreen.addEventListener('change', (e) => {
  trackSelector.value = e.target.value;
  selectTrack(Number(e.target.value));
});

prevTrackBtn.addEventListener('click', () => {
  if (currentTrack > 0) {
    selectTrack(currentTrack - 1);
    audio.play();
  }
});
nextTrackBtn.addEventListener('click', () => {
  if (currentTrack < Math.min(audioList.length, lrcDataList.length) - 1) {
    selectTrack(currentTrack + 1);
    audio.play();
  }
});
playPauseBtn.addEventListener('click', () => {
  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }
});

audio.addEventListener('play', () => {
  playPauseBtn.textContent = '⏸️';
  requestFullscreen(lyricsScreen);
  controls.style.display = 'none';
  lyricsScreen.style.display = 'flex';
  fullscreenControls.style.display = 'flex';
  if (wavesurfer) wavesurfer.play();
});
audio.addEventListener('pause', () => {
  playPauseBtn.textContent = '▶️';
  if (wavesurfer) wavesurfer.pause();
});
audio.addEventListener('ended', () => {
  lyricsScreen.style.display = 'none';
  controls.style.display = '';
  fullscreenControls.style.display = 'none';
  if (wavesurfer) wavesurfer.pause();
});

audio.addEventListener('timeupdate', () => {
  const currentTime = audio.currentTime;
  let currentLyric = '';
  const lrcData = window.currentLrcData || [];
  for (let i = 0; i < lrcData.length; i++) {
    if (currentTime >= lrcData[i].time) {
      currentLyric = lrcData[i].lyric;
    } else {
      break;
    }
  }
  currentLineDiv.textContent = currentLyric;
  if (wavesurfer && Math.abs(wavesurfer.getCurrentTime() - currentTime) > 0.1) {
    wavesurfer.setCurrentTime(currentTime);
  }
});

function requestFullscreen(elem) {
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

async function selectTrack(idx) {
  currentTrack = idx;
  const track = tracks[currentTrack];
  if (track) {
    const url = URL.createObjectURL(track.audioFile);
    audio.src = url;
    await setCoverFromAudio(track.audioFile);
    loadWaveform(track.audioFile);

    // Carica LRC
    const reader = new FileReader();
    reader.onload = function() {
      window.currentLrcData = parseLRC(reader.result);
    };
    reader.readAsText(track.lrcFile);
  }
  trackSelector.value = idx;
  trackSelectorFullscreen.value = idx;
}

function parseLRC(text) {
  const lrcData = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+\.\d+)\](.*)/);
    if (match) {
      const min = parseInt(match[1]);
      const sec = parseFloat(match[2]);
      const time = min * 60 + sec;
      const lyric = match[3].trim();
      lrcData.push({ time, lyric });
    }
  }
  return lrcData;
}

async function setCoverFromAudio(file) {
  try {
    const metadata = await musicMetadata.parseBlob(file);
    console.log("Metadata:", metadata);
    if (
      metadata.common.picture &&
      metadata.common.picture.length > 0 &&
      metadata.common.picture[0].data
    ) {
      const pic = metadata.common.picture[0];
      const blob = new Blob([pic.data], { type: pic.format });
      const url = URL.createObjectURL(blob);
      bgBlur.style.backgroundImage = `url('${url}')`;
      bgBlur.style.backgroundSize = "cover";
      bgBlur.style.backgroundPosition = "center";
      console.log("Copertina FLAC trovata e impostata!");
      return;
    } else {
      console.log("Nessuna copertina trovata nei metadata FLAC.");
    }
  } catch (e) {
    console.error("Errore lettura metadata FLAC:", e);
  }
  // Fallback
  bgBlur.style.backgroundImage = "url('https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=800&q=80')";
  bgBlur.style.backgroundSize = "cover";
  bgBlur.style.backgroundPosition = "center";
}

bgBlur.style.backgroundImage = "linear-gradient(135deg, #222 0%, #444 100%)";

// --- Waveform ---
function loadWaveform(file) {
  if (wavesurfer) {
    wavesurfer.destroy();
    waveformDiv.innerHTML = '';
  }
  wavesurfer = WaveSurfer.create({
    container: waveformDiv,
    waveColor: '#fff',
    progressColor: '#1db954',
    height: 60,
    barWidth: 2,
    responsive: true,
    interact: false,
    cursorWidth: 0,
    normalize: true,
    backend: 'MediaElement',
    mediaControls: false,
  });
  const url = URL.createObjectURL(file);
  wavesurfer.load(url);
  // Sync with audio element
  wavesurfer.on('ready', () => {
    wavesurfer.setVolume(0);
    wavesurfer.seekTo(audio.currentTime / audio.duration || 0);
  });
  audio.ontimeupdate = () => {
    if (wavesurfer && audio.duration) {
      const percent = audio.currentTime / audio.duration;
      wavesurfer.seekTo(percent);
    }
  };
}
