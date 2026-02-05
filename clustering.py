import os
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import shutil

# Number of clusters
n = 3

# Directory containing images
artworks_dir = "artworks"
output_dir = "clustered_artworks"

def extract_image_features(image_path):
    """
    Extract features from an image based on RGB pixel data.
    Returns a feature vector combining average RGB, color histogram, and dominant colors.
    """
    try:
        # Load image
        img = Image.open(image_path)
        
        # Convert to RGB if necessary
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize to standard size for consistent feature extraction
        img = img.resize((256, 256))
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Flatten the image to get all pixels
        pixels = img_array.reshape(-1, 3)
        
        # Feature 1: Average RGB values
        avg_rgb = np.mean(pixels, axis=0)
        
        # Feature 2: Standard deviation of RGB values
        std_rgb = np.std(pixels, axis=0)
        
        # Feature 3: Color histogram (binned RGB values)
        hist_r = np.histogram(pixels[:, 0], bins=16, range=(0, 256))[0]
        hist_g = np.histogram(pixels[:, 1], bins=16, range=(0, 256))[0]
        hist_b = np.histogram(pixels[:, 2], bins=16, range=(0, 256))[0]
        
        # Feature 4: Dominant colors (using KMeans on a sample of pixels)
        sample_pixels = pixels[np.random.choice(len(pixels), min(1000, len(pixels)), replace=False)]
        if len(sample_pixels) > 0:
            kmeans_temp = KMeans(n_clusters=3, random_state=42, n_init=10)
            kmeans_temp.fit(sample_pixels)
            dominant_colors = kmeans_temp.cluster_centers_.flatten()
        else:
            dominant_colors = np.zeros(9)
        
        # Combine all features
        features = np.concatenate([
            avg_rgb,           # 3 features
            std_rgb,           # 3 features
            hist_r,            # 16 features
            hist_g,            # 16 features
            hist_b,            # 16 features
            dominant_colors    # 9 features
        ])
        
        return features
    
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return None

def cluster_images(n_clusters, artworks_dir, output_dir):
    """
    Cluster images in the artworks directory into n_clusters groups.
    """
    # Get all image files
    image_extensions = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp'}
    image_files = []
    
    for filename in os.listdir(artworks_dir):
        if any(filename.lower().endswith(ext) for ext in image_extensions):
            image_files.append(os.path.join(artworks_dir, filename))
    
    if len(image_files) == 0:
        print(f"No images found in {artworks_dir} directory!")
        return
    
    print(f"Found {len(image_files)} images. Extracting features...")
    
    # Extract features from all images
    features_list = []
    valid_files = []
    
    for img_path in image_files:
        features = extract_image_features(img_path)
        if features is not None:
            features_list.append(features)
            valid_files.append(img_path)
    
    if len(features_list) == 0:
        print("No valid images could be processed!")
        return
    
    # Convert to numpy array
    X = np.array(features_list)
    
    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # Perform clustering
    print(f"Clustering {len(valid_files)} images into {n_clusters} clusters...")
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_labels = kmeans.fit_predict(X_scaled)
    
    # Create output directory structure
    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
    os.makedirs(output_dir)
    
    # Organize images into cluster folders
    for i in range(n_clusters):
        cluster_folder = os.path.join(output_dir, f"cluster_{i}")
        os.makedirs(cluster_folder, exist_ok=True)
    
    # Copy images to their respective cluster folders
    cluster_counts = {}
    for img_path, cluster_id in zip(valid_files, cluster_labels):
        filename = os.path.basename(img_path)
        cluster_folder = os.path.join(output_dir, f"cluster_{cluster_id}")
        dest_path = os.path.join(cluster_folder, filename)
        shutil.copy2(img_path, dest_path)
        
        if cluster_id not in cluster_counts:
            cluster_counts[cluster_id] = 0
        cluster_counts[cluster_id] += 1
    
    # Print summary
    print("\nClustering complete!")
    print(f"Results saved in '{output_dir}' directory:")
    for cluster_id in sorted(cluster_counts.keys()):
        print(f"  Cluster {cluster_id}: {cluster_counts[cluster_id]} images")
    
    # Save cluster mapping to a text file
    mapping_file = os.path.join(output_dir, "cluster_mapping.txt")
    with open(mapping_file, 'w') as f:
        f.write("Image Clustering Results\n")
        f.write("=" * 50 + "\n\n")
        for img_path, cluster_id in zip(valid_files, cluster_labels):
            f.write(f"{os.path.basename(img_path)} -> Cluster {cluster_id}\n")

if __name__ == "__main__":
    cluster_images(n, artworks_dir, output_dir)
