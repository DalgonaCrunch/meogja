#!/usr/bin/env python3
"""
Remove white background from food icons using corner flood-fill.
Preserves white pixels that are part of the actual icon design.
"""

from PIL import Image
import numpy as np
from collections import deque
import os

def remove_white_bg(img: Image.Image, tolerance: int = 20) -> Image.Image:
    """
    Flood-fill from all 4 corners to mark background white pixels,
    then set them transparent. Preserves internal white in the icon.
    """
    img = img.convert("RGBA")
    data = np.array(img)
    h, w = data.shape[:2]

    # Mask of near-white pixels (potential background)
    r, g, b = data[:,:,0], data[:,:,1], data[:,:,2]
    near_white = (r >= 255 - tolerance) & (g >= 255 - tolerance) & (b >= 255 - tolerance)

    # BFS from 4 corners to find connected background region
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()

    for start in [(0,0), (0,w-1), (h-1,0), (h-1,w-1)]:
        r0, c0 = start
        if near_white[r0, c0] and not visited[r0, c0]:
            queue.append((r0, c0))
            visited[r0, c0] = True

    while queue:
        row, col = queue.popleft()
        for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
            nr, nc = row+dr, col+dc
            if 0 <= nr < h and 0 <= nc < w and not visited[nr, nc] and near_white[nr, nc]:
                visited[nr, nc] = True
                queue.append((nr, nc))

    # Set background pixels transparent
    result = data.copy()
    result[visited, 3] = 0

    return Image.fromarray(result, "RGBA")


def process_folder(folder: str):
    files = [f for f in os.listdir(folder) if f.endswith(".png")]
    print(f"Processing {len(files)} icons in {folder}")
    for i, fname in enumerate(files):
        path = os.path.join(folder, fname)
        img = Image.open(path)
        cleaned = remove_white_bg(img)
        cleaned.save(path, "PNG")
        if (i+1) % 20 == 0:
            print(f"  {i+1}/{len(files)} done")
    print(f"✓ Done. {len(files)} icons updated.")


if __name__ == "__main__":
    process_folder("public/food-icons")
