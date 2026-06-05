#!/usr/bin/env python3
"""
Remove edge-connected bright backgrounds from food icons.

The previous version seeded flood-fill from only the four corners. Most files
already had transparent corners, so reruns could not reach the remaining opaque
white panel. This version detects the dominant bright neutral background from
edge/transparent-boundary samples, then removes only matching pixels connected
to existing transparency or to the true image border.
"""

from __future__ import annotations

from collections import Counter, deque
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image


ICON_DIR = Path(__file__).resolve().parents[1] / "public" / "food-icons"
MIN_CONNECTED_BACKGROUND_PIXELS = 100


@dataclass
class RemovalStats:
    filename: str
    removed_pixels: int
    transparent_before: int
    transparent_after: int
    background_color: tuple[int, int, int] | None
    issue: str | None = None


def shifted(mask: np.ndarray, dy: int, dx: int) -> np.ndarray:
    """Return mask shifted by dy/dx without wrapping around image edges."""
    h, w = mask.shape
    out = np.zeros_like(mask, dtype=bool)

    src_y0 = max(0, -dy)
    src_y1 = h - max(0, dy)
    src_x0 = max(0, -dx)
    src_x1 = w - max(0, dx)

    dst_y0 = max(0, dy)
    dst_y1 = h - max(0, -dy)
    dst_x0 = max(0, dx)
    dst_x1 = w - max(0, -dx)

    out[dst_y0:dst_y1, dst_x0:dst_x1] = mask[src_y0:src_y1, src_x0:src_x1]
    return out


def pixels_adjacent_to_transparency(alpha: np.ndarray) -> np.ndarray:
    transparent = alpha == 0
    adjacent = np.zeros_like(transparent, dtype=bool)
    for dy, dx in (
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1),
        (-1, -1),
        (-1, 1),
        (1, -1),
        (1, 1),
    ):
        adjacent |= shifted(transparent, dy, dx)
    return adjacent


def image_border_mask(height: int, width: int) -> np.ndarray:
    border = np.zeros((height, width), dtype=bool)
    border[0, :] = True
    border[-1, :] = True
    border[:, 0] = True
    border[:, -1] = True
    return border


def edge_band_mask(height: int, width: int) -> np.ndarray:
    band_width = max(6, min(height, width) // 6)
    edge = np.zeros((height, width), dtype=bool)
    edge[:band_width, :] = True
    edge[-band_width:, :] = True
    edge[:, :band_width] = True
    edge[:, -band_width:] = True
    return edge


def detect_background_color(
    rgb: np.ndarray,
    visible: np.ndarray,
    adjacent_transparent: np.ndarray,
    border: np.ndarray,
) -> tuple[int, int, int] | None:
    height, width = visible.shape
    sample_mask = visible & (
        adjacent_transparent | border | edge_band_mask(height, width)
    )
    samples = rgb[sample_mask]
    if len(samples) < 10:
        return None

    channel_max = samples.max(axis=1)
    channel_min = samples.min(axis=1)
    bright_neutral = (channel_min >= 185) & ((channel_max - channel_min) <= 65)
    candidates = samples[bright_neutral]
    if len(candidates) < 10:
        return None

    # Quantize to find the dominant edge/background cluster, then use the
    # median of nearby unquantized pixels for a stable representative color.
    quantized = (candidates // 8) * 8
    top_bin = np.array(Counter(map(tuple, quantized.tolist())).most_common(1)[0][0])
    nearby = np.linalg.norm(candidates - top_bin, axis=1) <= 28
    cluster = candidates[nearby] if nearby.any() else candidates
    color = np.median(cluster, axis=0).round().astype(np.uint8)
    return tuple(int(v) for v in color)


def background_candidate_mask(
    rgb: np.ndarray,
    alpha: np.ndarray,
    background_color: tuple[int, int, int],
) -> np.ndarray:
    bg = np.array(background_color, dtype=np.int16)
    rgb16 = rgb.astype(np.int16)

    channel_max = rgb16.max(axis=2)
    channel_min = rgb16.min(axis=2)
    channel_spread = channel_max - channel_min
    diff = np.abs(rgb16 - bg)
    euclidean = np.linalg.norm(rgb16 - bg, axis=2)

    visible = alpha > 0
    bright = channel_min >= 175
    neutral = channel_spread <= 70
    close_to_background = (diff.max(axis=2) <= 72) | (euclidean <= 108)

    return visible & bright & neutral & close_to_background


def flood_fill_background(candidates: np.ndarray, seeds: np.ndarray) -> np.ndarray:
    height, width = candidates.shape
    visited = np.zeros_like(candidates, dtype=bool)
    seed_points = np.argwhere(candidates & seeds)
    queue: deque[tuple[int, int]] = deque()

    for row, col in seed_points:
        visited[row, col] = True
        queue.append((int(row), int(col)))

    while queue:
        row, col = queue.popleft()
        for dr, dc in (
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1),
            (-1, -1),
            (-1, 1),
            (1, -1),
            (1, 1),
        ):
            nr = row + dr
            nc = col + dc
            if (
                0 <= nr < height
                and 0 <= nc < width
                and candidates[nr, nc]
                and not visited[nr, nc]
            ):
                visited[nr, nc] = True
                queue.append((nr, nc))

    return visited


def remove_background(img: Image.Image, filename: str = "") -> tuple[Image.Image, RemovalStats]:
    rgba = img.convert("RGBA")
    data = np.array(rgba)
    height, width = data.shape[:2]
    rgb = data[:, :, :3]
    alpha = data[:, :, 3]

    transparent_before = int((alpha == 0).sum())
    visible = alpha > 0
    adjacent_transparent = pixels_adjacent_to_transparency(alpha)
    border = image_border_mask(height, width)

    background_color = detect_background_color(rgb, visible, adjacent_transparent, border)
    if background_color is None:
        stats = RemovalStats(
            filename=filename,
            removed_pixels=0,
            transparent_before=transparent_before,
            transparent_after=transparent_before,
            background_color=None,
        )
        return rgba, stats

    candidates = background_candidate_mask(rgb, alpha, background_color)
    # Seed only from real exterior contact points. The edge band helps identify
    # the color, but it is intentionally not used as a seed because food whites
    # can appear inside the icon artwork.
    seeds = adjacent_transparent | border
    remove_mask = flood_fill_background(candidates, seeds)
    if int(remove_mask.sum()) < MIN_CONNECTED_BACKGROUND_PIXELS:
        remove_mask[:, :] = False

    cleaned = data.copy()
    cleaned[remove_mask, 3] = 0
    removed_pixels = int(remove_mask.sum())
    transparent_after = int((cleaned[:, :, 3] == 0).sum())

    stats = RemovalStats(
        filename=filename,
        removed_pixels=removed_pixels,
        transparent_before=transparent_before,
        transparent_after=transparent_after,
        background_color=background_color,
    )
    return Image.fromarray(cleaned, "RGBA"), stats


def process_folder(folder: Path = ICON_DIR) -> list[RemovalStats]:
    files = sorted(folder.glob("*.png"))
    print(f"Processing {len(files)} icons in {folder}")

    all_stats: list[RemovalStats] = []
    for index, path in enumerate(files, start=1):
        with Image.open(path) as img:
            cleaned, stats = remove_background(img, path.name)
        cleaned.save(path, "PNG")
        all_stats.append(stats)

        if index % 20 == 0 or index == len(files):
            print(f"  {index}/{len(files)} done")

    removed_total = sum(stats.removed_pixels for stats in all_stats)
    issue_files = [stats for stats in all_stats if stats.issue]
    print(f"Done. {len(files)} icons updated; {removed_total} pixels made transparent.")
    if issue_files:
        print("Files with issues:")
        for stats in issue_files:
            print(f"  {stats.filename}: {stats.issue}")

    return all_stats


if __name__ == "__main__":
    process_folder()
