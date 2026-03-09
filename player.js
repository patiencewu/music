class MusicPlayer {
    constructor() {
        this.audioPlayer = document.getElementById('audioPlayer');
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.volume = 80;
        this.isMuted = false;
        this.playMode = 'sequential';
        this.shuffleEnabled = false;
        this.repeatMode = 'none';
        this.lyrics = [];
        this.currentLyricIndex = -1;
        
        this.config = null;
        this.repository = null;
        
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.loadSettings();
        this.bindEvents();
        this.loadPlaylist();
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            this.config = await response.json();
            this.repository = this.config.repository;
        } catch (error) {
            console.error('加载配置文件失败:', error);
            this.detectRepository();
        }
    }

    detectRepository() {
        const url = window.location.href;
        const match = url.match(/github\.io\/([^\/]+)/);
        if (match) {
            const repoName = match[1];
            this.repository = {
                owner: repoName,
                repo: repoName,
                branch: 'main',
                path: 'music'
            };
        }
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('musicPlayerSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.volume = settings.volume || 80;
            this.playMode = settings.playMode || 'sequential';
            this.shuffleEnabled = settings.shuffleEnabled || false;
            this.repeatMode = settings.repeatMode || 'none';
        } else if (this.config && this.config.defaultSettings) {
            this.volume = this.config.defaultSettings.volume || 80;
            this.playMode = this.config.defaultSettings.playMode || 'sequential';
            this.shuffleEnabled = this.config.defaultSettings.shuffleEnabled || false;
            this.repeatMode = this.config.defaultSettings.repeatMode || 'none';
        }
        
        this.audioPlayer.volume = this.volume / 100;
        this.updateVolumeUI();
        this.updatePlayModeUI();
    }

    saveSettings() {
        const settings = {
            volume: this.volume,
            playMode: this.playMode,
            shuffleEnabled: this.shuffleEnabled,
            repeatMode: this.repeatMode
        };
        localStorage.setItem('musicPlayerSettings', JSON.stringify(settings));
    }

    async loadPlaylist() {
        this.showLoading();
        
        try {
            if (this.repository) {
                await this.loadFromGitHub();
            } else {
                await this.loadFromLocal();
            }
        } catch (error) {
            console.error('加载播放列表失败:', error);
            this.showEmptyPlaylist();
        }
    }

    async loadFromGitHub() {
        const { owner, repo, branch, path } = this.repository;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
        
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('GitHub API请求失败');
            
            const data = await response.json();
            this.playlist = [];
            
            await this.processGitHubFiles(data, path);
            
            if (this.playlist.length === 0) {
                this.showEmptyPlaylist();
            } else {
                this.renderPlaylist();
                this.updateSongCount();
            }
        } catch (error) {
            console.error('从GitHub加载失败:', error);
            await this.loadFromLocal();
        }
    }

    async processGitHubFiles(files, currentPath) {
        const supportedFormats = this.config?.supportedFormats || ['mp3', 'flac', 'wav', 'ogg', 'm4a', 'aac'];
        
        for (const file of files) {
            if (file.type === 'file') {
                const extension = file.name.split('.').pop().toLowerCase();
                if (supportedFormats.includes(extension)) {
                    const song = {
                        name: file.name.replace(`.${extension}`, ''),
                        path: file.path,
                        url: file.download_url,
                        type: extension
                    };
                    this.playlist.push(song);
                }
            } else if (file.type === 'dir') {
                try {
                    const { owner, repo, branch } = this.repository;
                    const subDirUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}?ref=${branch}`;
                    const response = await fetch(subDirUrl);
                    if (response.ok) {
                        const subFiles = await response.json();
                        await this.processGitHubFiles(subFiles, file.path);
                    }
                } catch (error) {
                    console.error(`加载目录 ${file.name} 失败:`, error);
                }
            }
        }
    }

    async loadFromLocal() {
        try {
            const response = await fetch('playlist.json');
            if (response.ok) {
                const data = await response.json();
                this.playlist = data.songs || [];
                this.renderPlaylist();
                this.updateSongCount();
            } else {
                this.showEmptyPlaylist();
            }
        } catch (error) {
            console.error('加载本地播放列表失败:', error);
            this.showEmptyPlaylist();
        }
    }

    showLoading() {
        const playlistEl = document.getElementById('playlist');
        playlistEl.innerHTML = `
            <div class="empty-playlist">
                <i class="fas fa-spinner fa-spin"></i>
                <p>加载中...</p>
            </div>
        `;
    }

    showEmptyPlaylist() {
        const playlistEl = document.getElementById('playlist');
        playlistEl.innerHTML = `
            <div class="empty-playlist">
                <i class="fas fa-music"></i>
                <p>播放列表为空</p>
                <p>点击刷新按钮加载音乐</p>
            </div>
        `;
        document.getElementById('songCount').textContent = '0 首歌曲';
    }

    renderPlaylist() {
        const playlistEl = document.getElementById('playlist');
        playlistEl.innerHTML = '';
        
        this.playlist.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            item.dataset.index = index;
            item.innerHTML = `
                <div class="song-icon"><i class="fas fa-music"></i></div>
                <div class="song-info">
                    <h4>${song.name}</h4>
                    <p>${song.type.toUpperCase()}</p>
                </div>
            `;
            item.addEventListener('click', () => this.playSong(index));
            playlistEl.appendChild(item);
        });
    }

    updateSongCount() {
        document.getElementById('songCount').textContent = `${this.playlist.length} 首歌曲`;
    }

    playSong(index) {
        if (index < 0 || index >= this.playlist.length) return;
        
        this.currentIndex = index;
        const song = this.playlist[index];
        
        this.audioPlayer.src = song.url;
        this.audioPlayer.play();
        this.isPlaying = true;
        
        this.updateUI();
        this.loadLyrics(song);
        this.updatePlaylistActive();
        
        const albumPlaceholder = document.querySelector('.album-placeholder');
        albumPlaceholder.classList.remove('paused');
    }

    togglePlay() {
        if (this.playlist.length === 0) return;
        
        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.isPlaying = false;
        } else {
            if (!this.audioPlayer.src) {
                this.playSong(0);
            } else {
                this.audioPlayer.play();
                this.isPlaying = true;
            }
        }
        
        this.updatePlayButton();
        this.updateAlbumAnimation();
    }

    playNext() {
        if (this.playlist.length === 0) return;
        
        let nextIndex;
        
        if (this.shuffleEnabled) {
            nextIndex = this.getRandomIndex();
        } else {
            nextIndex = this.currentIndex + 1;
            if (nextIndex >= this.playlist.length) {
                if (this.repeatMode === 'all') {
                    nextIndex = 0;
                } else {
                    return;
                }
            }
        }
        
        this.playSong(nextIndex);
    }

    playPrevious() {
        if (this.playlist.length === 0) return;
        
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) {
            if (this.repeatMode === 'all') {
                prevIndex = this.playlist.length - 1;
            } else {
                prevIndex = 0;
            }
        }
        
        this.playSong(prevIndex);
    }

    getRandomIndex() {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.playlist.length);
        } while (newIndex === this.currentIndex && this.playlist.length > 1);
        return newIndex;
    }

    toggleShuffle() {
        this.shuffleEnabled = !this.shuffleEnabled;
        this.updatePlayModeUI();
        this.saveSettings();
    }

    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        this.updatePlayModeUI();
        this.saveSettings();
    }

    setVolume(value) {
        this.volume = value;
        this.audioPlayer.volume = value / 100;
        this.isMuted = value === 0;
        this.updateVolumeUI();
        this.saveSettings();
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted) {
            this.audioPlayer.volume = 0;
        } else {
            this.audioPlayer.volume = this.volume / 100;
        }
        this.updateVolumeUI();
    }

    seekTo(value) {
        if (this.audioPlayer.duration) {
            const time = (value / 100) * this.audioPlayer.duration;
            this.audioPlayer.currentTime = time;
        }
    }

    async loadLyrics(song) {
        const lyricsPath = song.path.replace(/\.[^.]+$/, '.lrc');
        const lyricsUrl = song.url.replace(/\.[^.]+$/, '.lrc');
        
        try {
            const response = await fetch(lyricsUrl);
            if (response.ok) {
                const lyricsText = await response.text();
                this.parseLyrics(lyricsText);
                this.renderLyrics();
            } else {
                this.showNoLyrics();
            }
        } catch (error) {
            this.showNoLyrics();
        }
    }

    parseLyrics(text) {
        this.lyrics = [];
        const lines = text.split('\n');
        
        for (const line of lines) {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (match) {
                const minutes = parseInt(match[1]);
                const seconds = parseInt(match[2]);
                const milliseconds = parseInt(match[3]);
                const time = minutes * 60 + seconds + milliseconds / 1000;
                const content = match[4].trim();
                
                if (content) {
                    this.lyrics.push({ time, content });
                }
            }
        }
    }

    renderLyrics() {
        const lyricsContent = document.getElementById('lyricsContent');
        
        if (this.lyrics.length === 0) {
            this.showNoLyrics();
            return;
        }
        
        lyricsContent.innerHTML = this.lyrics.map((lyric, index) => 
            `<p data-index="${index}">${lyric.content}</p>`
        ).join('');
    }

    showNoLyrics() {
        document.getElementById('lyricsContent').innerHTML = '<p class="no-lyrics">暂无歌词</p>';
    }

    updateLyrics() {
        if (this.lyrics.length === 0) return;
        
        const currentTime = this.audioPlayer.currentTime;
        let newIndex = -1;
        
        for (let i = this.lyrics.length - 1; i >= 0; i--) {
            if (currentTime >= this.lyrics[i].time) {
                newIndex = i;
                break;
            }
        }
        
        if (newIndex !== this.currentLyricIndex) {
            this.currentLyricIndex = newIndex;
            this.highlightLyric(newIndex);
        }
    }

    highlightLyric(index) {
        const lyricsContent = document.getElementById('lyricsContent');
        const lyrics = lyricsContent.querySelectorAll('p');
        
        lyrics.forEach((lyric, i) => {
            lyric.classList.remove('current');
            if (i === index) {
                lyric.classList.add('current');
                lyric.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    }

    updateUI() {
        const song = this.playlist[this.currentIndex];
        document.getElementById('songTitle').textContent = song.name;
        document.getElementById('songArtist').textContent = song.type.toUpperCase();
        this.updatePlayButton();
    }

    updatePlayButton() {
        const playButton = document.getElementById('playButton');
        const icon = playButton.querySelector('i');
        
        if (this.isPlaying) {
            icon.className = 'fas fa-pause';
        } else {
            icon.className = 'fas fa-play';
        }
    }

    updateAlbumAnimation() {
        const albumPlaceholder = document.querySelector('.album-placeholder');
        if (this.isPlaying) {
            albumPlaceholder.classList.remove('paused');
        } else {
            albumPlaceholder.classList.add('paused');
        }
    }

    updateVolumeUI() {
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        const muteButton = document.getElementById('muteButton');
        const icon = muteButton.querySelector('i');
        
        volumeSlider.value = this.volume;
        volumeValue.textContent = `${this.volume}%`;
        
        if (this.isMuted || this.volume === 0) {
            icon.className = 'fas fa-volume-mute';
        } else if (this.volume < 50) {
            icon.className = 'fas fa-volume-down';
        } else {
            icon.className = 'fas fa-volume-up';
        }
    }

    updatePlayModeUI() {
        const shuffleButton = document.getElementById('shuffleButton');
        const repeatButton = document.getElementById('repeatButton');
        
        shuffleButton.classList.toggle('active', this.shuffleEnabled);
        
        repeatButton.classList.remove('active');
        const repeatIcon = repeatButton.querySelector('i');
        
        if (this.repeatMode === 'all') {
            repeatButton.classList.add('active');
            repeatIcon.className = 'fas fa-redo';
        } else if (this.repeatMode === 'one') {
            repeatButton.classList.add('active');
            repeatIcon.className = 'fas fa-redo-alt';
        } else {
            repeatIcon.className = 'fas fa-redo';
        }
    }

    updatePlaylistActive() {
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.remove('active', 'playing');
            if (index === this.currentIndex) {
                item.classList.add('active', 'playing');
            }
        });
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    bindEvents() {
        document.getElementById('playButton').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevButton').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextButton').addEventListener('click', () => this.playNext());
        document.getElementById('shuffleButton').addEventListener('click', () => this.toggleShuffle());
        document.getElementById('repeatButton').addEventListener('click', () => this.toggleRepeat());
        document.getElementById('muteButton').addEventListener('click', () => this.toggleMute());
        document.getElementById('refreshButton').addEventListener('click', () => this.loadPlaylist());
        
        const volumeSlider = document.getElementById('volumeSlider');
        volumeSlider.addEventListener('input', (e) => this.setVolume(parseInt(e.target.value)));
        
        const progressBar = document.getElementById('progressBar');
        progressBar.addEventListener('input', (e) => this.seekTo(parseInt(e.target.value)));
        
        this.audioPlayer.addEventListener('timeupdate', () => {
            const currentTime = this.audioPlayer.currentTime;
            const duration = this.audioPlayer.duration;
            
            document.getElementById('currentTime').textContent = this.formatTime(currentTime);
            document.getElementById('duration').textContent = this.formatTime(duration);
            
            if (duration) {
                progressBar.value = (currentTime / duration) * 100;
            }
            
            this.updateLyrics();
        });
        
        this.audioPlayer.addEventListener('ended', () => {
            if (this.repeatMode === 'one') {
                this.audioPlayer.currentTime = 0;
                this.audioPlayer.play();
            } else {
                this.playNext();
            }
        });
        
        this.audioPlayer.addEventListener('error', () => {
            console.error('音频播放错误');
            this.playNext();
        });
        
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
    }

    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT') return;
        
        switch(e.code) {
            case 'Space':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'ArrowLeft':
                this.playPrevious();
                break;
            case 'ArrowRight':
                this.playNext();
                break;
            case 'ArrowUp':
                e.preventDefault();
                this.setVolume(Math.min(100, this.volume + 5));
                break;
            case 'ArrowDown':
                e.preventDefault();
                this.setVolume(Math.max(0, this.volume - 5));
                break;
            case 'KeyM':
                this.toggleMute();
                break;
            case 'KeyS':
                this.toggleShuffle();
                break;
            case 'KeyR':
                this.toggleRepeat();
                break;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.musicPlayer = new MusicPlayer();
});