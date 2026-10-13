import os
from PIL import Image, ImageDraw

def create_vvex_icon(size):
    # Create image with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    scale = size / 100.0

    # Colors
    bg_color = (20, 18, 15, 255)
    border_color = (217, 119, 6, 255)       # Amber/orange
    vvex_amber = (245, 158, 11, 255)        # VVEX gold/amber
    vvex_white = (244, 237, 226, 255)       # Off-white

    # Outer circle
    margin = 2 * scale
    draw.ellipse([margin, margin, size - margin, size - margin], fill=bg_color, outline=border_color, width=int(max(1.5, 2.5 * scale)))

    # Draw geometric VV monogram / compass
    # Left V: (28, 32) -> (42, 68) -> (50, 50)
    p1 = (28 * scale, 33 * scale)
    p2 = (41 * scale, 67 * scale)
    p3 = (50 * scale, 48 * scale)
    p4 = (59 * scale, 67 * scale)
    p5 = (72 * scale, 33 * scale)

    line_w = int(max(2, 5.5 * scale))

    # Left V in amber
    draw.line([p1, p2, p3], fill=vvex_amber, width=line_w, joint="curve")
    # Right V in crisp off-white
    draw.line([p3, p4, p5], fill=vvex_white, width=line_w, joint="curve")

    # Central Atlas Diamond / Star point at top
    diamond = [
        (50 * scale, 21 * scale),
        (53.5 * scale, 27 * scale),
        (50 * scale, 31 * scale),
        (46.5 * scale, 27 * scale)
    ]
    draw.polygon(diamond, fill=vvex_amber)

    return img

def main():
    public_dir = os.path.join(os.path.dirname(__file__), "..", "public")
    
    # Generate PNG icons
    for filename, sz in [
        ("icon.png", 100),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
        ("apple-touch-icon.png", 180)
    ]:
        dest = os.path.join(public_dir, filename)
        icon = create_vvex_icon(sz)
        icon.save(dest, "PNG")
        print(f"Generated {filename} ({sz}x{sz})")

    # Generate multi-size favicon.ico for public/
    fav_dest = os.path.join(public_dir, "favicon.ico")
    icon_48 = create_vvex_icon(48)
    icon_48.save(fav_dest, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Generated public/favicon.ico (16, 32, 48)")

    # Update Next.js App Router default icon at src/app/icon.png
    src_app_dir = os.path.join(os.path.dirname(__file__), "..", "src", "app")
    app_icon_dest = os.path.join(src_app_dir, "icon.png")
    icon_app = create_vvex_icon(100)
    icon_app.save(app_icon_dest, "PNG")
    print("Generated src/app/icon.png")

    # Also generate src/app/favicon.ico for Next.js App Router metadata fallback
    app_fav_dest = os.path.join(src_app_dir, "favicon.ico")
    icon_48.save(app_fav_dest, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("Generated src/app/favicon.ico")

    # Generate crisp SVG version
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="vvexBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1a16" />
      <stop offset="100%" stop-color="#0f0d0b" />
    </linearGradient>
    <linearGradient id="vvexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="50%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="47" fill="url(#vvexBg)" stroke="url(#vvexGrad)" stroke-width="2.5" />
  <polygon points="50,21 53.5,27 50,31 46.5,27" fill="#f59e0b" />
  <path d="M 28 33 L 41 67 L 50 48" fill="none" stroke="url(#vvexGrad)" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" />
  <path d="M 50 48 L 59 67 L 72 33" fill="none" stroke="#f4ede2" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>"""
    svg_dest = os.path.join(public_dir, "vvex-mark.svg")
    with open(svg_dest, "w") as f:
        f.write(svg_content)
    print("Generated vvex-mark.svg")

if __name__ == "__main__":
    main()
