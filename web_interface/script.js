// Configuration
const CLUSTERS_DIR = '../clustered_artworks';
let allImages = [];  // All available images
let phase1Images = [];  // Images shown in phase 1
let phase2Images = [];  // Unseen images for phase 2
let currentImages = [];  // Currently active images (phase 1 or phase 2)
let currentIndex = 0;
let currentPhase = 1;  // 1 or 2
// Track cluster scores separately for each phase
let phase1Scores = {};  // { cluster_id: { likes: 0, dislikes: 0, total: 0 } }
let phase2Scores = {};  // { cluster_id: { likes: 0, dislikes: 0, total: 0 } }
let shownImagePaths = new Set();  // Track which images were shown in phase 1

// DOM Elements
const welcomeScreen = document.getElementById('welcome-screen');
const swipeScreen = document.getElementById('swipe-screen');
const summaryScreen = document.getElementById('summary-screen');
const startBtn = document.getElementById('start-btn');
const likeBtn = document.getElementById('like-btn');
const dislikeBtn = document.getElementById('dislike-btn');
const restartBtn = document.getElementById('restart-btn');
const artworkImage = document.getElementById('artwork-image');
const progressFill = document.getElementById('progress-fill');
const currentIndexSpan = document.getElementById('current-index');
const totalCountSpan = document.getElementById('total-count');
const likesCountSpan = document.getElementById('likes-count');
const dislikesCountSpan = document.getElementById('dislikes-count');
const likedImagesDiv = document.getElementById('liked-images');
const artworkCard = document.getElementById('artwork-card');

// Swipe variables
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
let isDragging = false;
let cardElement = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    startBtn.addEventListener('click', startSwiping);
    likeBtn.addEventListener('click', () => handleSwipe('like'));
    dislikeBtn.addEventListener('click', () => handleSwipe('dislike'));
    restartBtn.addEventListener('click', restart);
    
    // Setup swipe handlers
    setupSwipeHandlers();
});

async function startSwiping() {
    // Load images from clusters
    await loadImagesFromClusters();
    
    if (allImages.length === 0) {
        alert('No images found in clusters! Please run the clustering script first.');
        return;
    }
    
    // Reset state
    currentPhase = 1;
    currentIndex = 0;
    phase1Scores = {};
    phase2Scores = {};
    shownImagePaths.clear();
    
    // Phase 1: Select up to 3 images per cluster
    phase1Images = selectPhase1Images();
    // Phase 2: Select up to 3 unseen images per cluster
    phase2Images = selectPhase2Images();
    
    // Start with phase 1
    currentImages = [...phase1Images];
    shuffleArray(currentImages);
    
    // Initialize phase 1 cluster scores
    currentImages.forEach(img => {
        const clusterId = img.cluster;
        if (!phase1Scores[clusterId]) {
            phase1Scores[clusterId] = { likes: 0, dislikes: 0, total: 0, cluster_name: img.cluster_name };
        }
        phase1Scores[clusterId].total++;
    });
    
    // Show swipe screen
    welcomeScreen.classList.remove('active');
    swipeScreen.classList.add('active');
    
    // Load first image
    loadCurrentImage();
}

function selectPhase1Images() {
    const selected = [];
    const imagesPerCluster = {};
    const MAX_IMAGES_PER_CLUSTER = 3;
    
    // Group images by cluster
    allImages.forEach(img => {
        if (!imagesPerCluster[img.cluster]) {
            imagesPerCluster[img.cluster] = [];
        }
        imagesPerCluster[img.cluster].push(img);
    });
    
    // Select up to MAX_IMAGES_PER_CLUSTER images per cluster (random selection each time)
    Object.values(imagesPerCluster).forEach(clusterImages => {
        // Create a copy and shuffle for random selection
        const shuffled = [...clusterImages];
        shuffleArray(shuffled);
        const numToSelect = Math.min(MAX_IMAGES_PER_CLUSTER, shuffled.length);
        const selectedFromCluster = shuffled.slice(0, numToSelect);
        selected.push(...selectedFromCluster);
        selectedFromCluster.forEach(img => {
            shownImagePaths.add(img.path);
        });
    });
    
    return selected;
}

function selectPhase2Images() {
    const MAX_IMAGES_PER_CLUSTER = 3;
    const selected = [];
    const imagesPerCluster = {};
    
    // Get all images that weren't shown in phase 1
    const unseenImages = allImages.filter(img => !shownImagePaths.has(img.path));
    
    // Group unseen images by cluster
    unseenImages.forEach(img => {
        if (!imagesPerCluster[img.cluster]) {
            imagesPerCluster[img.cluster] = [];
        }
        imagesPerCluster[img.cluster].push(img);
    });
    
    // Select up to MAX_IMAGES_PER_CLUSTER images per cluster (random selection each time)
    Object.values(imagesPerCluster).forEach(clusterImages => {
        // Create a copy and shuffle for random selection
        const shuffled = [...clusterImages];
        shuffleArray(shuffled);
        const numToSelect = Math.min(MAX_IMAGES_PER_CLUSTER, shuffled.length);
        const selectedFromCluster = shuffled.slice(0, numToSelect);
        selected.push(...selectedFromCluster);
    });
    
    return selected;
}

async function loadImagesFromClusters() {
    allImages = [];
    
    // Try to load from embedded JavaScript data (avoids CORS)
    if (typeof window.IMAGE_DATA !== 'undefined') {
        allImages = window.IMAGE_DATA.images;
        console.log(`Loaded ${allImages.length} images from ${window.IMAGE_DATA.clusters} clusters`);
        return;
    }
    
    // Fallback: Try to load from JSON file
    try {
        const response = await fetch('images.json');
        if (response.ok) {
            const data = await response.json();
            allImages = data.images;
            console.log(`Loaded ${allImages.length} images from ${data.clusters} clusters`);
            return;
        }
    } catch (e) {
        console.warn('Could not load images.json (CORS issue):', e);
    }
    
    // Auto-discover images by trying to load from cluster directories
    console.log('Auto-discovering images from cluster directories...');
    await discoverImagesFromClusters();
    
    if (allImages.length === 0) {
        console.error('Could not load or discover any images.');
        alert('Could not find any images!\n\nPlease ensure:\n' +
              '1. clustered_artworks directory exists with cluster_* subdirectories\n' +
              '2. Or run: python generate_image_list.py to generate images_data.js');
        swipeScreen.classList.remove('active');
        welcomeScreen.classList.add('active');
    } else {
        console.log(`Auto-discovered ${allImages.length} images`);
    }
}

async function discoverImagesFromClusters() {
    // JavaScript cannot directly access file system, so we'll try to discover
    // images by attempting to load them from common patterns
    // This is a fallback - the Python script is still recommended for reliability
    
    const CLUSTERS_BASE = '../clustered_artworks';
    const MAX_CLUSTERS = 10; // Try up to 10 clusters
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const discoveredImages = [];
    const clusterMap = new Map();
    
    // Try to discover images by attempting to load them
    // We'll try common filename patterns
    const commonNames = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', 
                        'image', 'img', 'photo', 'pic', 'art', 'artwork'];
    
    for (let clusterNum = 0; clusterNum < MAX_CLUSTERS; clusterNum++) {
        const clusterName = `cluster_${clusterNum}`;
        const clusterImages = [];
        
        // Try common filename patterns
        for (const name of commonNames) {
            for (const ext of imageExtensions) {
                const testPath = `${CLUSTERS_BASE}/${clusterName}/${name}${ext}`;
                try {
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = () => {
                            clusterImages.push({
                                path: testPath,
                                cluster: clusterNum,
                                filename: `${name}${ext}`,
                                cluster_name: clusterName
                            });
                            resolve();
                        };
                        img.onerror = reject;
                        img.src = testPath;
                        setTimeout(reject, 500); // Timeout after 500ms
                    });
                } catch (e) {
                    // Image doesn't exist, continue
                }
            }
        }
        
        if (clusterImages.length > 0) {
            clusterMap.set(clusterNum, clusterImages);
            discoveredImages.push(...clusterImages);
            console.log(`Discovered ${clusterImages.length} images in ${clusterName}`);
        }
    }
    
    allImages = discoveredImages;
    return discoveredImages;
}

function loadCurrentImage() {
    if (currentIndex >= currentImages.length) {
        // Check if we need to move to phase 2
        if (currentPhase === 1 && phase2Images.length > 0) {
            startPhase2();
            return;
        } else {
            // Both phases complete - print results and download CSV, then show completion message
            printResultsToConsole();
            downloadCSV();
            showCompletionMessage();
            return;
        }
    }
    
    const currentImage = currentImages[currentIndex];
    
    // Set image source - handle CORS errors gracefully
    artworkImage.onerror = function() {
        console.warn(`Failed to load image: ${currentImage.path}`);
        // Try to continue anyway
        this.style.display = 'none';
    };
    artworkImage.onload = function() {
        this.style.display = 'block';
    };
    
    artworkImage.src = currentImage.path;
    
    // Update progress
    const progress = ((currentIndex + 1) / currentImages.length) * 100;
    progressFill.style.width = `${progress}%`;
    currentIndexSpan.textContent = currentIndex + 1;
    totalCountSpan.textContent = currentImages.length;
    
    // Reset card position
    artworkCard.style.transform = 'translate(0, 0) rotate(0deg)';
    artworkCard.style.opacity = '1';
    artworkCard.classList.remove('swipe-left', 'swipe-right');
    
    // Reset overlays
    document.querySelector('.like-overlay').classList.remove('active');
    document.querySelector('.dislike-overlay').classList.remove('active');
}

function startPhase2() {
    currentPhase = 2;
    currentIndex = 0;
    currentImages = [...phase2Images];
    shuffleArray(currentImages);
    
    // Initialize phase 2 cluster scores
    currentImages.forEach(img => {
        const clusterId = img.cluster;
        if (!phase2Scores[clusterId]) {
            phase2Scores[clusterId] = { likes: 0, dislikes: 0, total: 0, cluster_name: img.cluster_name };
        }
        phase2Scores[clusterId].total++;
    });
    
    // Load first image of phase 2 (no message to user)
    loadCurrentImage();
}

function handleSwipe(action) {
    if (currentIndex >= currentImages.length) return;
    
    const currentImage = currentImages[currentIndex];
    const clusterId = currentImage.cluster;
    
    // Record result per cluster for current phase
    const scores = currentPhase === 1 ? phase1Scores : phase2Scores;
    
    if (action === 'like') {
        scores[clusterId].likes++;
        artworkCard.classList.add('swipe-right');
    } else {
        scores[clusterId].dislikes++;
        artworkCard.classList.add('swipe-left');
    }
    
    // Move to next image after animation
    setTimeout(() => {
        currentIndex++;
        loadCurrentImage();
    }, 500);
}

function showCompletionMessage() {
    swipeScreen.classList.remove('active');
    summaryScreen.classList.add('active');
    
    // Show simple completion message without cluster details
    const totalLikes = Object.values(phase1Scores).reduce((sum, s) => sum + s.likes, 0) + 
                       Object.values(phase2Scores).reduce((sum, s) => sum + s.likes, 0);
    const totalDislikes = Object.values(phase1Scores).reduce((sum, s) => sum + s.dislikes, 0) + 
                          Object.values(phase2Scores).reduce((sum, s) => sum + s.dislikes, 0);
    
    // Update stats
    likesCountSpan.textContent = totalLikes;
    dislikesCountSpan.textContent = totalDislikes;
    
    // Show simple completion message
    likedImagesDiv.innerHTML = `
        <div style="width: 100%; text-align: center; padding: 40px 20px; box-sizing: border-box;">
            <div style="font-size: 3em; margin-bottom: 20px;">✨</div>
            <h2 style="color: #667eea; margin-bottom: 15px;">Thank you!</h2>
            <p style="color: #666; font-size: 1.1em; margin-bottom: 10px;">
                You've completed rating all images.
            </p>
            <p style="color: #999; font-size: 0.95em;">
                Results have been saved to CSV file and printed to console.
            </p>
        </div>
    `;
}

function downloadCSV() {
    // Combine scores from both phases
    const combinedScores = {};
    const allClusters = new Set([
        ...Object.keys(phase1Scores),
        ...Object.keys(phase2Scores)
    ]);
    
    allClusters.forEach(clusterId => {
        const p1 = phase1Scores[clusterId] || { likes: 0, dislikes: 0, total: 0, cluster_name: '' };
        const p2 = phase2Scores[clusterId] || { likes: 0, dislikes: 0, total: 0, cluster_name: '' };
        combinedScores[clusterId] = {
            likes: p1.likes + p2.likes,
            dislikes: p1.dislikes + p2.dislikes,
            total: p1.total + p2.total,
            cluster_name: p1.cluster_name || p2.cluster_name,
            phase1: { likes: p1.likes, dislikes: p1.dislikes, total: p1.total },
            phase2: { likes: p2.likes, dislikes: p2.dislikes, total: p2.total }
        };
    });
    
    // Calculate totals
    let totalLikes = 0;
    let totalDislikes = 0;
    Object.values(combinedScores).forEach(score => {
        totalLikes += score.likes;
        totalDislikes += score.dislikes;
    });
    
    // Sort clusters by combined score
    const sortedClusters = Object.entries(combinedScores)
        .sort((a, b) => {
            const scoreA = a[1].likes - a[1].dislikes;
            const scoreB = b[1].likes - b[1].dislikes;
            return scoreB - scoreA;
        });
    
    // Create CSV content
    const csvRows = [];
    
    // Header row
    csvRows.push('Cluster ID,Cluster Name,Part 1 Likes,Part 1 Dislikes,Part 1 Total,Part 1 Net Score,Part 2 Likes,Part 2 Dislikes,Part 2 Total,Part 2 Net Score,Combined Likes,Combined Dislikes,Combined Total,Combined Net Score,Percentage Liked');
    
    // Data rows
    sortedClusters.forEach(([clusterId, score]) => {
        const netScore1 = score.phase1.likes - score.phase1.dislikes;
        const netScore2 = score.phase2.likes - score.phase2.dislikes;
        const netScoreCombined = score.likes - score.dislikes;
        const percentage = score.total > 0 ? ((score.likes / score.total) * 100).toFixed(2) : '0.00';
        
        csvRows.push([
            clusterId,
            score.cluster_name,
            score.phase1.likes,
            score.phase1.dislikes,
            score.phase1.total,
            netScore1,
            score.phase2.likes,
            score.phase2.dislikes,
            score.phase2.total,
            netScore2,
            score.likes,
            score.dislikes,
            score.total,
            netScoreCombined,
            percentage
        ].join(','));
    });
    
    // Add summary row
    csvRows.push('');
    csvRows.push('Summary,Total Images Part 1,Total Images Part 2,Total Images,Total Likes,Total Dislikes');
    csvRows.push([
        'Totals',
        phase1Images.length,
        phase2Images.length,
        allImages.length,
        totalLikes,
        totalDislikes
    ].join(','));
    
    // Add timestamp
    csvRows.push('');
    csvRows.push(`Generated,${new Date().toISOString()}`);
    
    // Create CSV string
    const csvContent = csvRows.join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cluster_scores_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('CSV file downloaded successfully!');
}

function restart() {
    summaryScreen.classList.remove('active');
    welcomeScreen.classList.add('active');
    
    // Reset state
    currentIndex = 0;
    currentPhase = 1;
    phase1Scores = {};
    phase2Scores = {};
    shownImagePaths.clear();
}

function printResultsToConsole() {
    // Combine scores from both phases
    const combinedScores = {};
    const allClusters = new Set([
        ...Object.keys(phase1Scores),
        ...Object.keys(phase2Scores)
    ]);
    
    allClusters.forEach(clusterId => {
        const p1 = phase1Scores[clusterId] || { likes: 0, dislikes: 0, total: 0, cluster_name: '' };
        const p2 = phase2Scores[clusterId] || { likes: 0, dislikes: 0, total: 0, cluster_name: '' };
        combinedScores[clusterId] = {
            likes: p1.likes + p2.likes,
            dislikes: p1.dislikes + p2.dislikes,
            total: p1.total + p2.total,
            cluster_name: p1.cluster_name || p2.cluster_name,
            phase1: { likes: p1.likes, dislikes: p1.dislikes, total: p1.total },
            phase2: { likes: p2.likes, dislikes: p2.dislikes, total: p2.total }
        };
    });
    
    // Calculate totals
    let totalLikes = 0;
    let totalDislikes = 0;
    Object.values(combinedScores).forEach(score => {
        totalLikes += score.likes;
        totalDislikes += score.dislikes;
    });
    
    // Prepare cluster scores data
    const clusterData = Object.entries(combinedScores).map(([clusterId, score]) => {
        const netScore = score.likes - score.dislikes;
        const percentage = score.total > 0 ? ((score.likes / score.total) * 100).toFixed(1) : 0;
        return {
            cluster_id: parseInt(clusterId),
            cluster_name: score.cluster_name,
            phase1: {
                likes: score.phase1.likes,
                dislikes: score.phase1.dislikes,
                total: score.phase1.total,
                net_score: score.phase1.likes - score.phase1.dislikes
            },
            phase2: {
                likes: score.phase2.likes,
                dislikes: score.phase2.dislikes,
                total: score.phase2.total,
                net_score: score.phase2.likes - score.phase2.dislikes
            },
            combined: {
                likes: score.likes,
                dislikes: score.dislikes,
                total: score.total,
                net_score: netScore,
                percentage_liked: parseFloat(percentage)
            }
        };
    }).sort((a, b) => b.combined.net_score - a.combined.net_score);
    
    const data = {
        timestamp: new Date().toISOString(),
        total_images_phase1: phase1Images.length,
        total_images_phase2: phase2Images.length,
        total_images: allImages.length,
        total_likes: totalLikes,
        total_dislikes: totalDislikes,
        cluster_scores: clusterData
    };
    
    console.log('='.repeat(60));
    console.log('CLUSTER SCORE RESULTS (TWO-PHASE)');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${data.timestamp}`);
    console.log(`Phase 1 Images: ${data.total_images_phase1}`);
    console.log(`Phase 2 Images: ${data.total_images_phase2}`);
    console.log(`Total Images Rated: ${data.total_images}`);
    console.log(`Total Likes: ${data.total_likes}`);
    console.log(`Total Dislikes: ${data.total_dislikes}`);
    console.log('\n--- CLUSTER SCORES (sorted by combined net score) ---');
    clusterData.forEach((cluster, idx) => {
        console.log(`\n${idx + 1}. ${cluster.cluster_name} (Cluster ${cluster.cluster_id})`);
        console.log(`   Part 1: ❤️ ${cluster.phase1.likes} | 👎 ${cluster.phase1.dislikes} | Total: ${cluster.phase1.total} | Score: ${cluster.phase1.net_score > 0 ? '+' : ''}${cluster.phase1.net_score}`);
        console.log(`   Part 2: ❤️ ${cluster.phase2.likes} | 👎 ${cluster.phase2.dislikes} | Total: ${cluster.phase2.total} | Score: ${cluster.phase2.net_score > 0 ? '+' : ''}${cluster.phase2.net_score}`);
        console.log(`   Combined: ❤️ ${cluster.combined.likes} | 👎 ${cluster.combined.dislikes} | Total: ${cluster.combined.total}`);
        console.log(`   Net Score: ${cluster.combined.net_score > 0 ? '+' : ''}${cluster.combined.net_score} | ${cluster.combined.percentage_liked}% liked`);
    });
    console.log('\n--- FULL DATA (JSON) ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('='.repeat(60));
}

// Swipe functionality
function setupSwipeHandlers() {
    cardElement = artworkCard;
    
    // Touch events
    cardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    cardElement.addEventListener('touchmove', handleTouchMove, { passive: true });
    cardElement.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Mouse events
    cardElement.addEventListener('mousedown', handleMouseDown);
    cardElement.addEventListener('mousemove', handleMouseMove);
    cardElement.addEventListener('mouseup', handleMouseUp);
    cardElement.addEventListener('mouseleave', handleMouseUp);
}

function handleTouchStart(e) {
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isDragging = true;
}

function handleTouchMove(e) {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    currentX = touch.clientX - startX;
    currentY = touch.clientY - startY;
    
    updateCardPosition();
}

function handleTouchEnd(e) {
    if (!isDragging) return;
    
    const threshold = 100;
    const rotation = currentX * 0.1;
    
    if (Math.abs(currentX) > threshold) {
        if (currentX > 0) {
            handleSwipe('like');
        } else {
            handleSwipe('dislike');
        }
    } else {
        // Snap back
        resetCardPosition();
    }
    
    isDragging = false;
}

function handleMouseDown(e) {
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    e.preventDefault();
}

function handleMouseMove(e) {
    if (!isDragging) return;
    
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    
    updateCardPosition();
}

function handleMouseUp(e) {
    if (!isDragging) return;
    
    const threshold = 100;
    
    if (Math.abs(currentX) > threshold) {
        if (currentX > 0) {
            handleSwipe('like');
        } else {
            handleSwipe('dislike');
        }
    } else {
        resetCardPosition();
    }
    
    isDragging = false;
}

function updateCardPosition() {
    const rotation = currentX * 0.1;
    cardElement.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
    
    // Show overlay based on direction
    const likeOverlay = document.querySelector('.like-overlay');
    const dislikeOverlay = document.querySelector('.dislike-overlay');
    
    if (currentX > 50) {
        likeOverlay.classList.add('active');
        dislikeOverlay.classList.remove('active');
    } else if (currentX < -50) {
        dislikeOverlay.classList.add('active');
        likeOverlay.classList.remove('active');
    } else {
        likeOverlay.classList.remove('active');
        dislikeOverlay.classList.remove('active');
    }
}

function resetCardPosition() {
    currentX = 0;
    currentY = 0;
    cardElement.style.transform = 'translate(0, 0) rotate(0deg)';
    document.querySelector('.like-overlay').classList.remove('active');
    document.querySelector('.dislike-overlay').classList.remove('active');
}

// Utility functions
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
