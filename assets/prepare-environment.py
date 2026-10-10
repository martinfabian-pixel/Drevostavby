"""Create valid local RGBE environment from CC0 Spruit Sunrise SDR photo.

This is a reconstruction with a synthetic solar disk, not calibrated captured HDR.
No network requests; Pillow and NumPy are used only for offline asset preparation.
"""
from pathlib import Path
from PIL import Image
import numpy as np
import json
import hashlib

root = Path(__file__).resolve().parent
w, h = 512, 256
photo = np.asarray(Image.open(root / 'spruit-sunrise-2k.jpg').convert('RGB').resize((w,h), Image.Resampling.LANCZOS), dtype=np.float64) / 255.0
linear = np.where(photo <= 0.04045, photo / 12.92, ((photo + 0.055) / 1.055) ** 2.4) * 1.2
# Equirectangular file rows run from north/top to south/bottom; HDRLoader flips Y.
u, v = np.meshgrid((np.arange(w) + 0.5) / w, (np.arange(h) + 0.5) / h)
longitude = (u - 0.5) * (2 * np.pi)
latitude = (0.5 - v) * np.pi
direction = np.stack([np.cos(latitude)*np.cos(longitude), np.sin(latitude), np.cos(latitude)*np.sin(longitude)], axis=-1)
sun = np.array([-45.0,45.0,38.0]); sun /= np.linalg.norm(sun)
angle = np.arccos(np.clip(direction @ sun, -1.0, 1.0))
disk = 20.0 * np.exp(-0.5 * (angle / np.deg2rad(0.8)) ** 2)
halo = 0.14 * np.exp(-0.5 * (angle / np.deg2rad(7.0)) ** 2)
linear += (disk + halo)[...,None] * np.array([1.0,0.89,0.72])
# Standard Radiance RGBE: mantissa bytes share an exponent with bias 128.
peak = np.max(linear, axis=-1)
mantissa, exponent = np.frexp(peak)
scale = np.divide(mantissa*256.0, peak, out=np.zeros_like(peak), where=peak>1e-32)
rgbe = np.zeros((h,w,4), dtype=np.uint8)
rgbe[...,:3] = np.clip(np.floor(linear*scale[...,None]),0,255).astype(np.uint8)
rgbe[...,3] = np.where(peak>1e-32, exponent+128, 0).astype(np.uint8)
assert tuple(rgbe[0,0,:2]) != (2,2), 'Raw scanline must not trigger RLE sentinel'
header = b'#?RADIANCE\n# Reconstructed SDR photograph with synthetic sun; not captured HDR\nFORMAT=32-bit_rle_rgbe\n\n-Y 256 +X 512\n'
(root / 'morning-sky.hdr').write_bytes(header+rgbe.tobytes())
# Independently decode using the Three HDRLoader RGBE formula and check half data.
decoded = rgbe[...,:3].astype(np.float64) * (2.0**(rgbe[...,3].astype(np.int16)-128)/255.0)[...,None]
assert decoded.shape == (256,512,3) and np.isfinite(decoded).all()
assert 1.0 < decoded.max() < 32.0 and not np.any(decoded>=65504)
assert np.isfinite(decoded.astype(np.float16)).all()
manifest = json.loads((root/'manifest.json').read_text(encoding='utf-8'))
manifest['environment'] = {
    'file':'assets/morning-sky.hdr', 'source':'https://polyhaven.com/a/spruit_sunrise',
    'resolution':[w,h], 'license':'CC0-1.0',
    'format':'linear RGBE reconstruction',
    'provenance':'Reconstructed from an SDR photograph with a synthetic sun; not calibrated captured HDR.',
    'sunDirection':[-45,45,38], 'sunPeakRadiance':20,
    'sdrPhoto':'assets/spruit-sunrise-2k.jpg'
}
(root/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n', encoding='utf-8')
credits = json.loads((root/'credits.json').read_text(encoding='utf-8'))
for entry in credits['sources']:
    if entry['group'] == 'environment':
        entry.update(asset='spruit_sunrise',source='https://polyhaven.com/a/spruit_sunrise',creator='Greg Zaal',
            mirrorFiles=['https://github.com/mrdoob/three.js/blob/r186/examples/textures/equirectangular/spruit_sunrise_2k.hdr.jpg'],
            processing='Reconstructed 512x256 linear RGBE from the SDR photograph, sRGB decoded to linear and multiplied by 1.2; synthetic warm Gaussian sun peak 20 at direction (-45,45,38), matched to the scene directional sun. Not calibrated captured HDR.')
    elif entry['group'] == 'spare-environment':
        entry['processing']='Original SDR panorama used to derive the runtime reconstructed RGBE environment.'
credits['files'] = [{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(root.iterdir()) if p.suffix.lower() in ('.jpg','.png','.webp','.hdr')]
(root/'credits.json').write_text(json.dumps(credits,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'fileBytes':(root/'morning-sky.hdr').stat().st_size,'pixelBytes':rgbe.nbytes,'decodedMin':float(decoded.min()),'decodedMax':float(decoded.max()),'halfFinite':bool(np.isfinite(decoded.astype(np.float16)).all()),'firstPixel':rgbe[0,0].tolist()}))
