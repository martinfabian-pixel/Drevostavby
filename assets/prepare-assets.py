"""Compact runtime maps derived from credited CC0 photographic PBR sources.

No image downloads occur here. Normal maps derive only from original height maps.
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np
import json

HERE = Path(__file__).resolve().parent

def normal_from_height(name, strength):
    height = Image.open(HERE / f'{name}-height.jpg').convert('L')
    height = height.filter(ImageFilter.GaussianBlur(.45))
    h = np.asarray(height, dtype=np.float32) / 255
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * .5
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * .5
    n = np.stack((-dx * strength, dy * strength, np.ones_like(h)), axis=-1)
    n /= np.maximum(np.linalg.norm(n, axis=-1, keepdims=True), 1e-6)
    Image.fromarray(np.uint8(np.clip(n * .5 + .5, 0, 1) * 255)).save(HERE / f'{name}-normal.jpg', quality=92, subsampling=0, optimize=True)

normal_from_height('soil', 7)
normal_from_height('bark', 10)

# One complete plank's interior. Grain runs along U. Real board seams are geometry.
for channel in ('color', 'normal', 'roughness'):
    im = Image.open(HERE / f'wood-{channel}.jpg')
    im = im.crop((0, 83, 1024, 128)).resize((1024, 64), Image.Resampling.LANCZOS)
    im.save(HERE / f'wood-grain-{channel}.jpg', quality=93, subsampling=0, optimize=True)

# Aerial moss/grass-rock layer has a deliberately neutral normal until a
# matching compact photogrammetric map is supplied. Soil supplies microdetail.
Image.new('RGB', (64, 64), (128, 128, 255)).save(HERE / 'moss-normal.jpg', quality=100, subsampling=0)

manifest = {
  'version': 1,
  'soil': {'color':'assets/soil-color.jpg','normal':'assets/soil-normal.jpg','roughness':'assets/soil-roughness.jpg','height':'assets/soil-height.jpg','tileMeters':2,'normalProvenance':'Derived from original Poly Haven displacement, not diffuse.'},
  'moss': {'color':'assets/moss-color.jpg','normal':'assets/moss-normal.jpg','roughness':'assets/moss-roughness.jpg','tileMeters':15,'normalProvenance':'Neutral normal; soil normal used for ground microdetail.'},
  'wood': {'color':'assets/wood-grain-color.jpg','normal':'assets/wood-grain-normal.jpg','roughness':'assets/wood-grain-roughness.jpg','grainDirection':'U','tileMeters':[2,.09],'cropPixels':[0,83,1024,128]},
  'bark': {'color':'assets/bark-color.jpg','normal':'assets/bark-normal.jpg','roughness':'assets/bark-roughness.jpg','tileMeters':2,'normalProvenance':'Derived from original Poly Haven displacement, not diffuse.'},
  'rock': {'color':'assets/rock-color.webp','normal':'assets/rock-normal.webp','roughness':'assets/rock-roughness.webp','tileMeters':1.8},
  'environment': {'file':'assets/morning-sky.hdr','source':'https://polyhaven.com/a/spruit_sunrise','resolution':[512,256],'license':'CC0-1.0','format':'linear RGBE reconstruction','provenance':'Reconstructed from an SDR photograph with a synthetic sun; not calibrated captured HDR.','sunDirection':[-45,45,38],'sunPeakRadiance':20,'sdrPhoto':'assets/spruit-sunrise-2k.jpg'},
  'foliage': {'firPhoto':'assets/fir-photo.png','fernPhoto':'assets/fern-photo.png','firAlpha':'assets/fir-alpha.png','firNormal':'assets/fir-normal.jpg','fernAlpha':'assets/fern-alpha.png','fernNormal':'assets/fern-normal.jpg','grassPhoto':'assets/grass-photo.png'},
  'colorManagement': {'color':'sRGB','normal':'linear / NoColorSpace','roughness':'linear / NoColorSpace','alpha':'linear / NoColorSpace','environment':'linear HDR'},
}
(HERE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print('Prepared local PBR maps and manifest.')
