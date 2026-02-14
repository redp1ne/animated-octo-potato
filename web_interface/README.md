# Artwork Swipe Interface 🎨

A cute and clean web interface for rating artworks using swipe gestures!

## Features

- ✨ Beautiful, modern UI with smooth animations
- 👆 Swipe left (dislike) or right (like) on images
- 📊 Summary screen with statistics
- 💾 Download results as JSON
- 📱 Responsive design for mobile and desktop

## Setup

1. **Generate the image list** (required before first use):
   ```bash
   python generate_image_list.py
   ```
   This script randomly selects one image from each cluster in `../clustered_artworks` and creates `images.json`.

2. **Open the interface**:
   - Option 1: Open `index.html` directly in a modern web browser
   - Option 2: Use a local web server (recommended):
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Then open: http://localhost:8000
     ```

## Usage

1. Click "Start Swiping" on the welcome screen
2. Swipe images left (👎) or right (❤️) using:
   - Touch gestures on mobile
   - Mouse drag on desktop
   - Or click the buttons at the bottom
3. View your summary at the end
4. Download results as JSON if desired
5. Start over to rate again!

## Files

- `index.html` - Main HTML structure
- `style.css` - Styling and animations
- `script.js` - Swipe logic and interactions
- `generate_image_list.py` - Script to generate image list from clusters
- `images.json` - Generated image list (created by Python script)

## Notes

- The interface randomly selects one image from each cluster
- Run `generate_image_list.py` again to get different random images
- Results are saved in JSON format with timestamps

Enjoy swiping! 🎉
