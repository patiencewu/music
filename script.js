// 音乐播放器主类
class MusicPlayer {
    constructor() {
        // 获取 DOM 元素
        this.audioPlayer = document.getElementById('audio-player');
        this.playBtn = document.getElementById('play-btn');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.shuffleBtn = document.getElementById('shuffle-btn');
        this.repeatBtn = document.getElementById('repeat-btn');
        this.progressSlider = document.getElementById('progress-slider');
        this.progressFill = document.getElementById('progress-fill');
        this.currentTimeDisplay = document.getElementById('current-time');
        this.durationDisplay = document.getElementById('duration');
        this.volumeSlider = document.getElementById('volume-slider');
        this.volumeValue = document.getElementById('volume-value');
        this.songTitle = document.getElementById('song-title');
        this.songArtist = document.getElementById('song-artist');
        this.playlist = document.getElementById('playlist');
        this.sortAscBtn = document.getElementById('sort-asc-btn');
        this.sortDescBtn = document.getElementById('sort-desc-btn');
        this.shufflePlaylistBtn = document.getElementById('shuffle-playlist-btn');

        // 播放器状态
        this.songs = [];
        this.currentSongIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.repeatMode = 'none'; // none, one, all
        this.volume = 80;

        // 初始化
        this.init();
    }

    // 初始化播放器
    async init() {
        // 从 localStorage 加载设置
        this.loadSettings();

        // 加载音乐列表
        await this.loadMusicList();

        // 绑定事件监听器
        this.bindEventListeners();

        // 设置初始音量
        this.audioPlayer.volume = this.volume / 100;
        this.volumeSlider.value = this.volume;
        this.volumeValue.textContent = this.volume + '%';

        // 更新按钮状态
        this.updateButtonStates();
    }

    // 从 localStorage 加载设置
    loadSettings() {
        const settings = localStorage.getItem('musicPlayerSettings');
        if (settings) {
            try {
                const parsedSettings = JSON.parse(settings);
                this.volume = parsedSettings.volume || 80;
                this.isShuffle = parsedSettings.isShuffle || false;
                this.repeatMode = parsedSettings.repeatMode || 'none';
                
                // 加载播放列表顺序
                if (parsedSettings.playlistOrder) {
                    this.playlistOrder = parsedSettings.playlistOrder;
                }
            } catch (error) {
                console.error('加载设置失败:', error);
            }
        }
    }

    // 保存设置到 localStorage
    saveSettings() {
        const settings = {
            volume: this.volume,
            isShuffle: this.isShuffle,
            repeatMode: this.repeatMode,
            playlistOrder: this.songs.map(song => song.name)
        };
        localStorage.setItem('musicPlayerSettings', JSON.stringify(settings));
    }

    // 加载音乐列表
    async loadMusicList() {
        try {
            // 尝试从 music 目录加载音乐文件
            const response = await fetch('music/');
            const text = await response.text();
            
            // 解析 HTML 获取音乐文件列表
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const links = doc.querySelectorAll('a[href]');
            
            const musicFiles = [];
            links.forEach(link => {
                const href = link.getAttribute('href');
                // 过滤音频文件
                if (href && this.isAudioFile(href)) {
                    const fileName = this.decodeURIComponent(href.split('/').pop());
                    if (fileName && !fileName.startsWith('.')) {
                        musicFiles.push({
                            name: fileName,
                            url: 'music/' + href
                        });
                    }
                }
            });

            if (musicFiles.length > 0) {
                // 应用保存的播放顺序
                if (this.playlistOrder && this.playlistOrder.length > 0) {
                    this.songs = this.sortSongsByOrder(musicFiles, this.playlistOrder);
                } else {
                    this.songs = musicFiles;
                }
                this.renderPlaylist();
            } else {
                this.playlist.innerHTML = '<div class="playlist-empty">未找到音乐文件<br>请将音乐文件放在 music 目录下</div>';
            }
        } catch (error) {
            console.error('加载音乐列表失败:', error);
            this.playlist.innerHTML = '<div class="playlist-empty">加载音乐列表失败<br>请确保 music 目录存在</div>';
        }
    }

    // 判断是否为音频文件
    isAudioFile(filename) {
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma'];
        const lowerFilename = filename.toLowerCase();
        return audioExtensions.some(ext => lowerFilename.endsWith(ext));
    }

    // 根据保存的顺序排序歌曲
    sortSongsByOrder(musicFiles, order) {
        const orderedSongs = [];
        const remainingSongs = [...musicFiles];

        // 按照保存的顺序添加歌曲
        order.forEach(songName => {
            const index = remainingSongs.findIndex(song => song.name === songName);
            if (index !== -1) {
                orderedSongs.push(remainingSongs[index]);
                remainingSongs.splice(index, 1);
            }
        });

        // 添加新歌曲
        orderedSongs.push(...remainingSongs);

        return orderedSongs;
    }

    // 渲染播放列表
    renderPlaylist() {
        if (this.songs.length === 0) {
            this.playlist.innerHTML = '<div class="playlist-empty">未找到音乐文件</div>';
            return;
        }

        this.playlist.innerHTML = '';
        this.songs.forEach((song, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item' + (index === this.currentSongIndex ? ' active' : '');
            item.innerHTML = `
                <span class="song-number">${index + 1}</span>
                <span class="song-name">${this.escapeHtml(song.name)}</span>
                <span class="song-duration">--:--</span>
            `;
            item.addEventListener('click', () => this.playSong(index));
            this.playlist.appendChild(item);
        });
    }

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // URI 解码
    decodeURIComponent(uri) {
        try {
            return decodeURIComponent(uri);
        } catch (error) {
            return uri;
        }
    }

    // 绑定事件监听器
    bindEventListeners() {
        // 播放/暂停按钮
        this.playBtn.addEventListener('click', () => this.togglePlay());

        // 上一首/下一首按钮
        this.prevBtn.addEventListener('click', () => this.playPrevious());
        this.nextBtn.addEventListener('click', () => this.playNext());

        // 随机播放按钮
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());

        // 循环播放按钮
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());

        // 进度条
        this.progressSlider.addEventListener('input', (e) => this.seekTo(e.target.value));

        // 音量控制
        this.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

        // 音频事件
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audioPlayer.addEventListener('ended', () => this.onSongEnd());
        this.audioPlayer.addEventListener('error', () => this.onAudioError());

        // 播放列表排序按钮
        this.sortAscBtn.addEventListener('click', () => this.sortPlaylist('asc'));
        this.sortDescBtn.addEventListener('click', () => this.sortPlaylist('desc'));
        this.shufflePlaylistBtn.addEventListener('click', () => this.shufflePlaylist());
    }

    // 播放指定歌曲
    playSong(index) {
        if (index < 0 || index >= this.songs.length) {
            return;
        }

        this.currentSongIndex = index;
        const song = this.songs[index];
        
        this.audioPlayer.src = song.url;
        this.audioPlayer.play().then(() => {
            this.isPlaying = true;
            this.updatePlayButton();
            this.updateSongInfo(song);
            this.renderPlaylist();
        }).catch(error => {
            console.error('播放失败:', error);
        });
    }

    // 切换播放/暂停
    togglePlay() {
        if (this.songs.length === 0) {
            return;
        }

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
    }

    // 更新播放按钮
    updatePlayButton() {
        this.playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
    }

    // 更新歌曲信息
    updateSongInfo(song) {
        const songName = song.name.replace(/\.[^/.]+$/, ''); // 移除文件扩展名
        this.songTitle.textContent = songName;
        this.songArtist.textContent = '音乐播放器';
    }

    // 播放上一首
    playPrevious() {
        if (this.songs.length === 0) {
            return;
        }

        if (this.isShuffle) {
            this.currentSongIndex = this.getRandomIndex();
        } else {
            this.currentSongIndex = (this.currentSongIndex - 1 + this.songs.length) % this.songs.length;
        }
        this.playSong(this.currentSongIndex);
    }

    // 播放下一首
    playNext() {
        if (this.songs.length === 0) {
            return;
        }

        if (this.isShuffle) {
            this.currentSongIndex = this.getRandomIndex();
        } else {
            this.currentSongIndex = (this.currentSongIndex + 1) % this.songs.length;
        }
        this.playSong(this.currentSongIndex);
    }

    // 获取随机索引
    getRandomIndex() {
        let newIndex;
        do {
            newIndex = Math.floor(Math.random() * this.songs.length);
        } while (newIndex === this.currentSongIndex && this.songs.length > 1);
        return newIndex;
    }

    // 切换随机播放
    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        this.updateButtonStates();
        this.saveSettings();
    }

    // 切换循环模式
    toggleRepeat() {
        const modes = ['none', 'all', 'one'];
        const currentIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentIndex + 1) % modes.length];
        this.updateButtonStates();
        this.saveSettings();
    }

    // 更新按钮状态
    updateButtonStates() {
        this.shuffleBtn.classList.toggle('active', this.isShuffle);
        this.repeatBtn.classList.toggle('active', this.repeatMode !== 'none');
        this.repeatBtn.textContent = this.repeatMode === 'one' ? '🔂' : '🔁';
    }

    // 更新进度
    updateProgress() {
        const currentTime = this.audioPlayer.currentTime;
        const duration = this.audioPlayer.duration;
        
        if (duration) {
            const progress = (currentTime / duration) * 100;
            this.progressFill.style.width = progress + '%';
            this.progressSlider.value = progress;
            this.currentTimeDisplay.textContent = this.formatTime(currentTime);
        }
    }

    // 更新时长
    updateDuration() {
        const duration = this.audioPlayer.duration;
        if (duration) {
            this.durationDisplay.textContent = this.formatTime(duration);
        }
    }

    // 跳转到指定位置
    seekTo(value) {
        const duration = this.audioPlayer.duration;
        if (duration) {
            this.audioPlayer.currentTime = (value / 100) * duration;
        }
    }

    // 设置音量
    setVolume(value) {
        this.volume = value;
        this.audioPlayer.volume = value / 100;
        this.volumeValue.textContent = value + '%';
        this.saveSettings();
    }

    // 格式化时间
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // 歌曲结束处理
    onSongEnd() {
        if (this.repeatMode === 'one') {
            this.audioPlayer.currentTime = 0;
            this.audioPlayer.play();
        } else if (this.repeatMode === 'all' || this.currentSongIndex < this.songs.length - 1) {
            this.playNext();
        } else {
            this.isPlaying = false;
            this.updatePlayButton();
        }
    }

    // 音频错误处理
    onAudioError() {
        console.error('音频加载失败');
        this.isPlaying = false;
        this.updatePlayButton();
    }

    // 升序排列播放列表
    sortPlaylist(order) {
        if (this.songs.length === 0) {
            return;
        }

        this.songs.sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (order === 'asc') {
                return nameA.localeCompare(nameB);
            } else {
                return nameB.localeCompare(nameA);
            }
        });

        this.currentSongIndex = 0;
        this.renderPlaylist();
        this.saveSettings();
    }

    // 随机排列播放列表
    shufflePlaylist() {
        if (this.songs.length === 0) {
            return;
        }

        for (let i = this.songs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
        }

        this.currentSongIndex = 0;
        this.renderPlaylist();
        this.saveSettings();
    }
}

// 页面加载完成后初始化播放器
document.addEventListener('DOMContentLoaded', () => {
    new MusicPlayer();
});
