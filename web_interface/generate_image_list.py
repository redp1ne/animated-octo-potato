import os
import json
import random
import glob

# Configuration
CLUSTERS_DIR = '../clustered_artworks'
OUTPUT_FILE = 'images.json'

def get_images_from_clusters():
    """Get all images from each cluster (for both phases)"""
    images = []
    
    # Find all cluster directories
    cluster_dirs = glob.glob(os.path.join(CLUSTERS_DIR, 'cluster_*'))
    cluster_dirs = [d for d in cluster_dirs if os.path.isdir(d)]
    
    if not cluster_dirs:
        print(f"No cluster directories found in {CLUSTERS_DIR}")
        return []
    
    # Supported image extensions
    image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.gif', '*.webp', '*.bmp']
    
    for cluster_dir in sorted(cluster_dirs):
        cluster_name = os.path.basename(cluster_dir)
        cluster_num = cluster_name.replace('cluster_', '')
        
        # Find all images in this cluster
        cluster_images = []
        for ext in image_extensions:
            cluster_images.extend(glob.glob(os.path.join(cluster_dir, ext)))
            cluster_images.extend(glob.glob(os.path.join(cluster_dir, ext.upper())))
        
        if cluster_images:
            # Remove duplicates (in case same file was found multiple times)
            seen_paths = set()
            unique_images = []
            for img_path in cluster_images:
                if img_path not in seen_paths:
                    seen_paths.add(img_path)
                    unique_images.append(img_path)
            
            # Get all images from this cluster (for both phases)
            selected_images = unique_images
            
            for selected_image in selected_images:
                # Get relative path for web access
                # Path should be relative to web_interface directory
                # Since web_interface is sibling to clustered_artworks
                relative_path = os.path.relpath(selected_image, start='..')
                # For web interface, use forward slashes
                web_path = relative_path.replace('\\', '/')
                
                # If running from web_interface directory, path should start with ../
                if not web_path.startswith('../'):
                    web_path = '../' + web_path
                
                images.append({
                    'path': web_path,
                    'cluster': int(cluster_num),
                    'filename': os.path.basename(selected_image),
                    'cluster_name': cluster_name
                })
                print(f"Selected from {cluster_name}: {os.path.basename(selected_image)}")
    
    return images

def main():
    print("Generating image list for web interface...")
    
    # Get all images (for both phases)
    all_images = get_images_from_clusters()  # Get all images
    
    if not all_images:
        print("No images found!")
        return
    
    # Create output data with all images
    output_data = {
        'images': all_images,
        'total': len(all_images),
        'clusters': len(set(img['cluster'] for img in all_images))
    }
    
    # Write to JSON file (for backup)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    # Also generate JavaScript file with embedded data (avoids CORS)
    js_file = 'images_data.js'
    with open(js_file, 'w', encoding='utf-8') as f:
        f.write('// Auto-generated image data (avoids CORS issues)\n')
        f.write('window.IMAGE_DATA = ')
        json.dump(output_data, f, indent=2)
        f.write(';\n')
    
    print(f"\n[OK] Generated {OUTPUT_FILE} and {js_file}")
    print(f"  Total images: {len(all_images)}")
    print(f"  Clusters: {output_data['clusters']}")
    print("\nYou can now open index.html in a web browser!")

if __name__ == "__main__":
    main()
