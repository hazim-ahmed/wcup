const API_BASE_URL = ''; // Empty string means it will use the current domain (FastAPI backend)

// DOM Elements
const categoriesList = document.getElementById('categories-list');
const channelsGrid = document.getElementById('channels-grid');
const currentCategoryTitle = document.getElementById('current-category-title');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');
const videoModal = document.getElementById('video-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const videoPlayer = document.getElementById('video-player');
const modalTitle = document.getElementById('modal-title');
const videoLoader = document.getElementById('video-loader');

let hls = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    closeModalBtn.addEventListener('click', closeVideoModal);

    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            e.target !== menuBtn) {
            sidebar.classList.remove('open');
        }
    });
}

// Fetch Categories
async function fetchCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        // Render Categories
        categoriesList.innerHTML = '';

        // Add Live Matches Option First
        const liveBtn = document.createElement('div');
        liveBtn.className = 'category-item';
        liveBtn.style.color = '#ef4444'; // Red color for LIVE
        liveBtn.innerHTML = `<span>🔴 مباريات اليوم (Live)</span>`;
        liveBtn.addEventListener('click', () => {
            document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
            liveBtn.classList.add('active');
            fetchLiveEvents();
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
            }
        });
        categoriesList.appendChild(liveBtn);

        data.data.forEach((category, index) => {
            const div = document.createElement('div');
            div.className = 'category-item';
            div.innerHTML = `<span>${category.name}</span>`;
            
            div.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.category-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                
                // Fetch channels
                fetchChannels(category.id, category.name);
                
                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
            
            categoriesList.appendChild(div);
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        categoriesList.innerHTML = '<div class="loader" style="color: #ef4444;">خطأ في تحميل التصنيفات</div>';
    }
}

// Fetch Channels
async function fetchChannels(categoryId, categoryName) {
    currentCategoryTitle.textContent = categoryName;
    channelsGrid.innerHTML = '<div class="loader">جاري تحميل القنوات...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/categories/${categoryId}/channels`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        channelsGrid.innerHTML = '';
        
        if (!data.data || data.data.length === 0) {
            channelsGrid.innerHTML = '<div class="welcome-message"><p>لا توجد قنوات في هذا التصنيف حالياً.</p></div>';
            return;
        }

        data.data.forEach(channel => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            
            const logoUrl = channel.logo || 'https://via.placeholder.com/80?text=No+Logo';
            
            card.innerHTML = `
                <img src="${logoUrl}" alt="${channel.name}" class="channel-logo" onerror="this.src='https://via.placeholder.com/80?text=TV'">
                <div class="channel-name">${channel.name}</div>
            `;
            
            card.addEventListener('click', () => {
                playChannel(channel.id, channel.name);
            });
            
            channelsGrid.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching channels:', error);
        channelsGrid.innerHTML = '<div class="loader" style="color: #ef4444;">خطأ في تحميل القنوات</div>';
    }
}

// Fetch Live Events
async function fetchLiveEvents() {
    currentCategoryTitle.textContent = "🔴 مباريات اليوم (Live)";
    channelsGrid.innerHTML = '<div class="loader">جاري تحميل المباريات...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/events`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        channelsGrid.innerHTML = '';
        
        if (!data.data || data.data.length === 0) {
            channelsGrid.innerHTML = '<div class="welcome-message"><p>لا توجد مباريات حية حالياً.</p></div>';
            return;
        }

        data.data.forEach(match => {
            const card = document.createElement('div');
            card.className = 'channel-card';
            
            card.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; gap: 10px; width:100%; margin-bottom:10px;">
                    <img src="${match.team_1.logo}" alt="${match.team_1.name}" style="width:40px;height:40px;object-fit:contain;">
                    <span style="font-weight:bold;font-size:12px;">VS</span>
                    <img src="${match.team_2.logo}" alt="${match.team_2.name}" style="width:40px;height:40px;object-fit:contain;">
                </div>
                <div class="channel-name" style="font-size:14px; margin-bottom:5px;">${match.team_1.name} ضد ${match.team_2.name}</div>
                <div style="font-size:12px; color:var(--text-muted); background:var(--bg-dark); padding:4px 8px; border-radius:4px;">${match.channel}</div>
            `;
            
            card.addEventListener('click', () => {
                fetchEventStreams(match.id, `${match.team_1.name} ضد ${match.team_2.name}`);
            });
            
            channelsGrid.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching live events:', error);
        channelsGrid.innerHTML = '<div class="loader" style="color: #ef4444;">خطأ في تحميل المباريات</div>';
    }
}

// Fetch Streams for Live Event
async function fetchEventStreams(eventId, matchTitle) {
    modalTitle.textContent = matchTitle;
    videoModal.classList.add('active');
    videoLoader.style.display = 'block';
    
    if (hls) {
        hls.destroy();
        hls = null;
    }
    videoPlayer.src = '';

    try {
        const response = await fetch(`${API_BASE_URL}/event/${eventId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        let streamUrl = '';
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            // Pick highest quality (first item usually Multi or HD)
            streamUrl = data.data[0].url; 
        } else if (data.url) {
            streamUrl = data.url;
        }

        if (!streamUrl) throw new Error('لا توجد روابط بث متاحة لهذه المباراة');

        playStreamUrl(streamUrl);

    } catch (error) {
        console.error('Error playing event:', error);
        videoLoader.style.display = 'none';
        alert('حدث خطأ أثناء محاولة تشغيل المباراة');
        closeVideoModal();
    }
}

// Play Channel
async function playChannel(channelId, channelName) {
    modalTitle.textContent = channelName;
    videoModal.classList.add('active');
    videoLoader.style.display = 'block';
    
    // Stop previous playback
    if (hls) {
        hls.destroy();
        hls = null;
    }
    videoPlayer.src = '';

    try {
        const response = await fetch(`${API_BASE_URL}/channel/${channelId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        // Extract stream URL (depends on API response structure)
        // Usually YacineTV returns an array of servers or a single URL
        let streamUrl = '';
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            streamUrl = data.data[0].url; // Adjust based on actual API response
        } else if (data.url) {
            streamUrl = data.url;
        }

        if (!streamUrl) {
            throw new Error('لم يتم العثور على رابط بث');
        }

        playStreamUrl(streamUrl);

    } catch (error) {
        console.error('Error playing channel:', error);
        videoLoader.style.display = 'none';
        alert('حدث خطأ أثناء محاولة تشغيل القناة');
        closeVideoModal();
    }
}

function playStreamUrl(streamUrl) {
    // Pass the stream URL through our proxy to bypass CORS and Referer restrictions
    const proxiedStreamUrl = `/proxy?url=${encodeURIComponent(streamUrl)}`;

    videoLoader.style.display = 'none';
    
    // Play with Hls.js
    if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(proxiedStreamUrl);
        hls.attachMedia(videoPlayer);
        hls.on(Hls.Events.MANIFEST_PARSED, function() {
            videoPlayer.play();
        });
        hls.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                console.error('HLS Error:', data);
                alert('خطأ في تشغيل البث');
            }
        });
    }
    // For Safari
    else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = proxiedStreamUrl;
        videoPlayer.addEventListener('loadedmetadata', function() {
            videoPlayer.play();
        });
    }
}

function closeVideoModal() {
    videoModal.classList.remove('active');
    if (hls) {
        hls.destroy();
        hls = null;
    }
    videoPlayer.pause();
    videoPlayer.src = '';
}
