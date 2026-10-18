"""Generate the 32px Cacic portrait. Use --apply to publish approved game art."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parent / 'art-review'
out.mkdir(exist_ok=True)
rects = []
def r(color, x, y, w, h):
    rects.append((color, x, y, w, h))

r('#1b1b4a', 0, 0, 32, 32)
r('#22345a', 6, 19, 20, 13)
r('#16243f', 6, 23, 4, 9)
r('#16243f', 22, 23, 4, 9)
r('#afc9e1', 13, 19, 7, 13)
r('#344a70', 10, 19, 3, 4)
r('#344a70', 20, 19, 3, 4)
r('#14213b', 15, 21, 2, 11)
r('#14213b', 14, 20, 4, 2)
r('#d7a180', 13, 16, 7, 4)
r('#e6b493', 10, 5, 13, 10)
r('#e6b493', 11, 15, 11, 2)
r('#d7a180', 12, 17, 9, 1)
r('#d7a180', 9, 9, 1, 5)
r('#d7a180', 23, 9, 1, 5)
r('#775e4c', 11, 3, 11, 1)
r('#594332', 10, 4, 13, 1)
r('#6c503c', 10, 5, 2, 2)
r('#6c503c', 21, 5, 2, 2)
r('#594332', 10, 7, 1, 2)
r('#594332', 22, 7, 1, 2)
r('#75513c', 12, 9, 3, 1)
r('#75513c', 18, 9, 3, 1)
r('#f5e7d8', 12, 10, 3, 1)
r('#f5e7d8', 18, 10, 3, 1)
r('#527c98', 13, 10, 1, 1)
r('#527c98', 19, 10, 1, 1)
r('#cc9677', 16, 10, 1, 3)
r('#8a6150', 15, 14, 3, 1)  # Smaller, softer mouth line; flat inspection expression.
# Silver shoulders, badge and tiny ribbon rows on dress blues.
r('#aeb8c6', 7, 19, 3, 1)
r('#aeb8c6', 23, 19, 3, 1)
r('#cdd6dd', 19, 22, 3, 1)
r('#cdd6dd', 20, 21, 1, 3)
for y, colors in [(25, ['#bb4856','#e4ca72','#567eae']), (26, ['#80a0c2','#cd4b52','#e4ca72'])]:
    for i, c in enumerate(colors): r(c, 18+i, y, 1, 1)
r('#c4b895', 10, 25, 3, 1)
# Keep the familiar inspection clipboard silhouette.
r('#c0c0c0', 24, 14, 8, 12)
r('#8b5a2b', 26, 13, 3, 2)
for y in [17,19,21,23]: r('#42434b', 25, y, 6, 1)
r('#e6b493', 22, 21, 3, 3)

sprite = Image.new('RGB', (32,32))
d = ImageDraw.Draw(sprite)
for c,x,y,w,h in rects: d.rectangle((x,y,x+w-1,y+h-1), fill=c)
sprite.resize((512,512), Image.Resampling.NEAREST).save(out / 'cacic-draft.png')
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">' + ''.join(f'<rect fill="{c}" x="{x}" y="{y}" width="{w}" height="{h}"/>' for c,x,y,w,h in rects) + '</svg>'
(out / 'cacic-draft.svg').write_text(svg, encoding='utf-8')
if '--apply' in sys.argv:
    root = Path(__file__).resolve().parent.parent
    (root / 'inspector-general.svg').write_text(svg + '\n', encoding='utf-8')
    # Generate both renderers from the same rectangles to keep their art identical.
    player = root / 'player.js'
    source = player.read_text(encoding='utf-8')
    start = source.index('function drawBoss(cv) {')
    end = source.index('\n/* ---------------- render ---------------- */', start)
    canvas = "function drawBoss(cv) {\n  if (!cv) return;\n  const x = cv.getContext('2d'), R = (c, a, b, w, h) => { x.fillStyle = c; x.fillRect(a, b, w, h); };\n  x.clearRect(0, 0, 32, 32);\n  // Approved Cacic portrait; matches inspector-general.svg.\n"
    canvas += ''.join(f"  R('{c}', {x}, {y}, {w}, {h});\n" for c,x,y,w,h in rects)
    canvas += '}\n'
    player.write_text(source[:start] + canvas + source[end:], encoding='utf-8')
print(out / 'cacic-draft.png')
