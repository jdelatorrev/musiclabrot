// Variables globales del reproductor
let currentSongIndex = 0;
let isPlaying = false;
let audioPlayer = null;

// Lista de canciones de ejemplo (en un proyecto real, estas vendrían de una base de datos)
const playlist = [
    {
        title: "Canción Demo 1",
        artist: "Artista Ejemplo",
        duration: "3:45"
    },
    {
        title: "Melodía Relajante",
        artist: "Compositor Virtual",
        duration: "4:12"
    },
    {
        title: "Ritmo Energético",
        artist: "Banda Digital",
        duration: "3:28"
    },
    {
        title: "Sonidos de la Naturaleza",
        artist: "Ambiente Natural",
        duration: "5:30"
    },
    {
        title: "Jazz Suave",
        artist: "Conjunto Clásico",
        duration: "4:45"
    }
];

// Elementos del DOM
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const currentSongTitle = document.getElementById('currentSongTitle');
const currentArtist = document.getElementById('currentArtist');
const currentTime = document.getElementById('currentTime');
const totalTime = document.getElementById('totalTime');
const progressFill = document.getElementById('progressFill');
const progressSlider = document.getElementById('progressSlider');
const volumeSlider = document.getElementById('volumeSlider');
const playlistContainer = document.getElementById('playlist');

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    initializePlayer();
    loadPlaylist();
    setupEventListeners();
});

// Inicializar el reproductor
function initializePlayer() {
    audioPlayer = document.getElementById('audioPlayer');
    
    // Configurar volumen inicial
    audioPlayer.volume = volumeSlider.value / 100;
    
    // Cargar primera canción
    loadSong(currentSongIndex);
}

// Configurar event listeners
function setupEventListeners() {
    playPauseBtn.addEventListener('click', togglePlayPause);
    prevBtn.addEventListener('click', previousSong);
    nextBtn.addEventListener('click', nextSong);
    
    volumeSlider.addEventListener('input', function() {
        if (audioPlayer) {
            audioPlayer.volume = this.value / 100;
        }
    });
    
    progressSlider.addEventListener('input', function() {
        if (audioPlayer && audioPlayer.duration) {
            const seekTime = (this.value / 100) * audioPlayer.duration;
            audioPlayer.currentTime = seekTime;
        }
    });
    
    // Event listeners del audio
    if (audioPlayer) {
        audioPlayer.addEventListener('timeupdate', updateProgress);
        audioPlayer.addEventListener('ended', nextSong);
        audioPlayer.addEventListener('loadedmetadata', function() {
            totalTime.textContent = formatTime(audioPlayer.duration || 0);
        });
    }
}

// Cargar canción
function loadSong(index) {
    if (index >= 0 && index < playlist.length) {
        const song = playlist[index];
        currentSongTitle.textContent = song.title;
        currentArtist.textContent = song.artist;
        totalTime.textContent = song.duration;
        
        // En un proyecto real, aquí cargarías el archivo de audio
        // audioPlayer.src = song.src;
        
        updatePlaylistUI();
    }
}

// Toggle play/pause
function togglePlayPause() {
    if (isPlaying) {
        pauseSong();
    } else {
        playSong();
    }
}

// Reproducir canción
function playSong() {
    // En un proyecto real, aquí reproducirías el audio
    // audioPlayer.play();
    
    isPlaying = true;
    playPauseBtn.textContent = '⏸️';
    playPauseBtn.classList.add('playing');
    
    // Simular reproducción
    simulatePlayback();
}

// Pausar canción
function pauseSong() {
    // En un proyecto real, aquí pausarías el audio
    // audioPlayer.pause();
    
    isPlaying = false;
    playPauseBtn.textContent = '▶️';
    playPauseBtn.classList.remove('playing');
    
    // Detener simulación
    if (window.playbackInterval) {
        clearInterval(window.playbackInterval);
    }
}

// Canción anterior
function previousSong() {
    currentSongIndex = currentSongIndex > 0 ? currentSongIndex - 1 : playlist.length - 1;
    loadSong(currentSongIndex);
    if (isPlaying) {
        playSong();
    }
}

// Siguiente canción
function nextSong() {
    currentSongIndex = currentSongIndex < playlist.length - 1 ? currentSongIndex + 1 : 0;
    loadSong(currentSongIndex);
    if (isPlaying) {
        playSong();
    }
}

// Actualizar progreso
function updateProgress() {
    if (audioPlayer && audioPlayer.duration) {
        const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFill.style.width = progress + '%';
        progressSlider.value = progress;
        currentTime.textContent = formatTime(audioPlayer.currentTime);
    }
}

// Simular reproducción (para demo)
function simulatePlayback() {
    let currentSeconds = 0;
    const totalSeconds = parseDuration(playlist[currentSongIndex].duration);
    
    window.playbackInterval = setInterval(() => {
        if (isPlaying && currentSeconds < totalSeconds) {
            currentSeconds++;
            const progress = (currentSeconds / totalSeconds) * 100;
            progressFill.style.width = progress + '%';
            progressSlider.value = progress;
            currentTime.textContent = formatTime(currentSeconds);
        } else if (currentSeconds >= totalSeconds) {
            nextSong();
        }
    }, 1000);
}

// Formatear tiempo
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Parsear duración
function parseDuration(duration) {
    const parts = duration.split(':');
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

// Cargar playlist en la UI
function loadPlaylist() {
    playlistContainer.innerHTML = '';
    
    playlist.forEach((song, index) => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';
        songItem.innerHTML = `
            <div class="song-number">${index + 1}</div>
            <div class="song-details">
                <div class="song-title">${song.title}</div>
                <div class="song-artist">${song.artist}</div>
            </div>
            <div class="song-duration">${song.duration}</div>
        `;
        
        songItem.addEventListener('click', () => {
            currentSongIndex = index;
            loadSong(currentSongIndex);
            playSong();
        });
        
        playlistContainer.appendChild(songItem);
    });
}

// Actualizar UI de la playlist
function updatePlaylistUI() {
    const songItems = document.querySelectorAll('.song-item');
    songItems.forEach((item, index) => {
        if (index === currentSongIndex) {
            item.classList.add('active');
            if (isPlaying) {
                item.classList.add('playing');
            }
        } else {
            item.classList.remove('active', 'playing');
        }
    });
}

// Función para cerrar sesión
function logout() {
    // Usar SweetAlert2 para confirmación elegante
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            title: 'Cerrar sesión',
            text: '¿Estás seguro de que quieres cerrar sesión?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                // Detener reproducción
                pauseSong();
                // Feedback breve y redirección
                Swal.fire({
                    title: 'Sesión cerrada',
                    text: 'Has salido de la biblioteca musical.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                }).then(() => {
                    window.location.href = '/';
                });
            }
        });
    } else {
        // Fallback al confirm nativo si SweetAlert no está disponible
        if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
            pauseSong();
            window.location.href = '/';
        }
    }
}