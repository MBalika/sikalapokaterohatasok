import sys, glob
from PIL import Image
# sheet.py "glob" out cols [scale]
fs = sorted(glob.glob(sys.argv[1])); out = sys.argv[2]; cols = int(sys.argv[3]); sc = float(sys.argv[4]) if len(sys.argv) > 4 else 1
ims = [Image.open(f) for f in fs]
ims = [im.resize((int(im.width*sc), int(im.height*sc))) for im in ims]
w, h = ims[0].size; rows = (len(ims)+cols-1)//cols
o = Image.new('RGB', (w*cols + 8*(cols-1), h*rows + 8*(rows-1)), '#888')
for k, im in enumerate(ims): o.paste(im, ((k % cols)*(w+8), (k//cols)*(h+8)))
o.save(out, quality=80); print(out, o.size)
