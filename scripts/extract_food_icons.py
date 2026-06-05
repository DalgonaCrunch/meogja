#!/usr/bin/env python3
"""
Food icon extractor: sprite sheets → individual icon PNG files.
Detects grid boundaries automatically per row, then crops icon areas.
Usage: python3 scripts/extract_food_icons.py
"""

from PIL import Image
import numpy as np
import os

# ── Labels per image, per row ─────────────────────────────────────────────
# Duplicates across images get _2, _3 suffix.
LABELS = {
    'KakaoTalk_20260605_215539867.png': [
        ['고기', '한식', '일식', '중식', '양식', '치킨', '햄버거', '피자'],
        ['밥덮밥', '비빔밥', '분식', '라면', '찌개', '만두', '샐러드', '샌드위치'],
        ['타코', '브리또', '핫도그', '꼬치', '감자튀김', '핫바', '어니언링', '스낵'],
        ['케이크', '도넛', '쿠키', '아이스크림', '버블티', '커피', '주스', '우유'],
    ],
    'KakaoTalk_20260605_223526866.png': [
        ['회', '샐러드_2', '파스타', '카레', '초밥', '우동', '소바', '떡볶이', '김치'],
        ['삼겹살', '불고기', '잡채', '보쌈', '짜장면', '짜장밥', '짬뽕', '마파두부', '야채볶음'],
        ['김치찌개', '된장찌개', '곰탕', '갈비탕', '닭갈비', '삼계탕', '부대찌개', '국수', '떡국'],
        ['만두_2', '김밥', '주먹밥', '비빔국수', '냉면', '막국수', '파전', '전복죽', '회덮밥'],
        ['감자튀김_2', '어니언링_2', '치즈스틱', '나초', '팝콘', '군고구마', '붕어빵', '빙수', '마카롱', '츄러스'],
    ],
    'KakaoTalk_20260605_223526866_01.png': [
        ['생선구이', '초밥사시미', '규동', '텐동', '돈카스', '오므라이스', '마끼', '우동_2', '소바_2', '돌솥비빔밥'],
        ['떡볶이_2', '치즈떡볶이', '볶음밥', '김치볶음밥', '로제떡볶이', '불고기_2', '제육볶음', '장어덮밥', '카레라이스', '하이라이스'],
        ['짬뽕_2', '간짜장', '탕수육', '깐풍새우', '마라탕', '마라샹궈', '사오마이', '춘권', '북경오리', '라조기'],
        ['피자_2', '크림파스타', '토마토파스타', '오일파스타', '그라탕', '스테이크', '로스트치킨', '슈니첼', '스프', '마늘빵'],
        ['새우튀김', '굴요리', '홍합요리', '시저샐러드', '웨지감자', '어니언링_3', '나초_2', '콘치즈', '치즈플레이트', '카프레제'],
        ['팥빙수', '브라우니', '티라미수', '초코케이크', '치즈케이크', '마카롱_2', '푸딩', '소프트아이스크림', '츄러스_2', '버블티_2', '아메리카노', '핫초코'],
    ],
}

def find_icon_rows(img_path):
    """Detect icon row y-boundaries.
    Top boundary = midpoint of separator above (captures icon pixels that bleed into separator).
    Bottom boundary = midpoint of small separator below (icon-label gap).
    """
    img = Image.open(img_path).convert('RGB')
    arr = np.array(img)
    h = arr.shape[0]
    white = (arr[:,:,0] > 245) & (arr[:,:,1] > 245) & (arr[:,:,2] > 245)
    row_white = white.mean(axis=1)

    is_sep = row_white > 0.90
    # Build full band list (alternating sep / content)
    in_sep = bool(is_sep[0])
    start = 0
    bands = []
    for i in range(1, h):
        if bool(is_sep[i]) != in_sep:
            bands.append(('sep' if in_sep else 'cnt', start, i))
            start = i
            in_sep = bool(is_sep[i])
    bands.append(('sep' if in_sep else 'cnt', start, h))

    icon_rows = []
    for i, (kind, s, e) in enumerate(bands):
        if kind != 'cnt' or (e - s) <= 80:
            continue

        # Top: midpoint of the separator immediately above this icon band
        top_bound = s
        if i > 0 and bands[i - 1][0] == 'sep':
            sep_s, sep_e = bands[i - 1][1], bands[i - 1][2]
            top_bound = (sep_s + sep_e) // 2

        # Bottom: midpoint of the separator immediately below (icon-label gap)
        bot_bound = e
        if i + 1 < len(bands) and bands[i + 1][0] == 'sep':
            sep_s, sep_e = bands[i + 1][1], bands[i + 1][2]
            bot_bound = (sep_s + sep_e) // 2

        icon_rows.append((top_bound, bot_bound))

    return icon_rows


def find_col_boundaries(icon_arr, min_content=30, threshold=0.88):
    """Detect column boundaries: find white separator bands, return content areas between them."""
    white = (icon_arr[:,:,0] > 245) & (icon_arr[:,:,1] > 245) & (icon_arr[:,:,2] > 245)
    col_white = white.mean(axis=0)
    w = icon_arr.shape[1]

    is_sep = col_white > threshold

    # Find content bands = contiguous runs of non-separator columns
    in_content = False
    content_bands = []
    start = 0
    for i in range(w):
        if not is_sep[i] and not in_content:
            start = i
            in_content = True
        elif is_sep[i] and in_content:
            content_bands.append((start, i))
            in_content = False
    if in_content:
        content_bands.append((start, w))

    return [(s, e) for s, e in content_bands if e - s >= min_content]


def extract_icons(src_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    total = 0
    errors = []

    for filename, label_grid in LABELS.items():
        img_path = os.path.join(src_dir, filename)
        if not os.path.exists(img_path):
            print(f"  SKIP (not found): {filename}")
            continue

        img = Image.open(img_path).convert('RGBA')
        arr = np.array(img.convert('RGB'))
        icon_rows = find_icon_rows(img_path)

        print(f"\n{filename}: {len(icon_rows)} icon rows detected")

        if len(icon_rows) != len(label_grid):
            print(f"  WARNING: detected {len(icon_rows)} rows but labels have {len(label_grid)} rows")

        for row_idx, (iy1, iy2) in enumerate(icon_rows):
            if row_idx >= len(label_grid):
                print(f"  Row {row_idx}: no labels defined, skipping")
                continue

            row_labels = label_grid[row_idx]
            icon_strip = arr[iy1:iy2]
            cols = find_col_boundaries(icon_strip)

            if len(cols) != len(row_labels):
                print(f"  Row {row_idx}: detected {len(cols)} cols but {len(row_labels)} labels — adjusting")
                # If off by 1-2, take the minimum
                n = min(len(cols), len(row_labels))
                cols = cols[:n]
                row_labels = row_labels[:n]

            for col_idx, ((cx1, cx2), label) in enumerate(zip(cols, row_labels)):
                # Small fixed side padding (row top/bottom already uses sep midpoints)
                pad = 3
                x1 = max(0, cx1 - pad)
                x2 = min(img.width, cx2 + pad)
                y1 = max(0, iy1)
                y2 = min(img.height, iy2)

                crop = img.crop((x1, y1, x2, y2))

                # Make square by padding shorter side with white
                w, h = crop.size
                size = max(w, h)
                square = Image.new('RGBA', (size, size), (255, 255, 255, 0))
                square.paste(crop, ((size - w) // 2, (size - h) // 2))

                # Resize to 200×200 for consistent icon size
                icon = square.resize((200, 200), Image.LANCZOS)

                out_path = os.path.join(out_dir, f"{label}.png")
                icon.save(out_path, 'PNG')
                total += 1

            print(f"  Row {row_idx}: {len(cols)} icons → {[l for l in row_labels]}")

    print(f"\n✓ Total: {total} icons extracted to {out_dir}")
    return total


if __name__ == '__main__':
    src = 'public/foods'
    out = 'public/food-icons'
    extract_icons(src, out)
