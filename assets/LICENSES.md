# DREVOFORM scene asset credits

These files are local assets. The website does not request Poly Haven or the
listed GitHub mirrors at runtime. The original photographic textures and sky
are dedicated to the public domain under **CC0 1.0**.

Official license: <https://polyhaven.com/license>
CC0 legal code: <https://creativecommons.org/publicdomain/zero/1.0/>

| Local files | Original asset and creators | Retrieval mirror | Processing |
| --- | --- | --- | --- |
| `soil-color.jpg`, `soil-roughness.jpg`, `soil-height.jpg`, `soil-normal.jpg` | [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01), Rob Tuytel | `hen31/TankDestroyer`, `Game/forrest_ground_01_diff_1k.jpg`; `marvinrunge/mtg-pentagon-tower-defense`, `assets/textures/forest/textures/forrest_ground_01_rough_1k.jpg`; `TaladeogoA/haunted-house`, `static/floor/forrest_ground_01_1k/forrest_ground_01_disp_1k.jpg` | Color, roughness and height are original photographic maps. OpenGL normal is calculated from the original displacement map with wraparound central differences. It is not the original scanned normal map. |
| `wood-*.jpg`, `wood-grain-*.jpg` | [Wooden Planks](https://polyhaven.com/a/wooden_planks), Charlotte Baglioni and Dario Barresi | `FloppyPancakeMedia/FPSTest`, `Textures/wooden_planks_{diff,nor_gl,rough}_1k.jpg` | Runtime maps crop a single plank interior, pixel rectangle `(0,83,1024,128)`, resized to 1024 x 64. Grain follows U. Building geometry supplies the board joints. |
| `bark-color.jpg`, `bark-roughness.jpg`, `bark-height.jpg`, `bark-normal.jpg` | [Pine Bark](https://polyhaven.com/a/pine_bark), Dimitrios Savva | `hwcgames/snald`, `textures/pine_bark_1k/textures/pine_bark_{diff,rough,disp}_1k.jpg` | OpenGL normal is calculated from the original displacement. It is not the original scanned normal map. |
| `moss-color.jpg`, `moss-roughness.jpg`, `moss-normal.jpg` | [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock), Rob Tuytel | `hen31/TankDestroyer`, `Game/aerial_grass_rock_diff_1k.jpg`; `blackears/terrain_layered_shader`, `godot/art/textures/aerial_grass_rock_1k.blend/textures/aerial_grass_rock_rough_1k.jpg` | A photographed moss, grass and rock surface used as a terrain blend layer. Neutral generated normal `(128,128,255)`; ground microdetail comes from the soil map. The neutral map is original material data, not a photographic map. |
| `rock-color.webp`, `rock-normal.webp`, `rock-roughness.webp` | [Rock Boulder Dry](https://polyhaven.com/a/rock_boulder_dry), Dimitrios Savva and Rico Cilliers | `danielesteban/unsatisfactory`, `src/textures/rock_boulder_dry_{diff,nor_gl,rough}_1k.webp` | WebP versions of the original CC0 PBR maps. |
| `fir-photo.png`, `fir-alpha.png`, `fir-normal.jpg` | [Fir Tree 01](https://polyhaven.com/a/fir_tree_01), Rob Tuytel and Rico Cilliers | `kkellerman/bastion-front`, `assets/textures/fir_twig_packed.png` and `assets/textures/polyhaven/fir_twig/` | Photographic twig atlas. The mirror packed original diffuse and cutout alpha into RGBA. Source provenance: [ASSET_ATTRIBUTION.md](https://github.com/kkellerman/bastion-front/blob/master/ASSET_ATTRIBUTION.md). |
| `fern-photo.png`, `fern-alpha.png`, `fern-normal.jpg` | [Fern 02](https://polyhaven.com/a/fern_02), Rob Tuytel and Rico Cilliers | `kkellerman/bastion-front`, `assets/textures/fern_packed.png` and `assets/textures/polyhaven/ground_plants/` | Photographic frond atlas. The mirror packed original diffuse and cutout alpha into RGBA. |
| `grass-photo.png` | [Grass Medium 01](https://polyhaven.com/a/grass_medium_01), Rob Tuytel and Rico Cilliers | `kkellerman/bastion-front`, `assets/textures/grass_packed.png` | Photographic grass atlas, packed diffuse and cutout alpha. |
| `morning-sky.hdr` | [Spruit Sunrise](https://polyhaven.com/a/spruit_sunrise), Greg Zaal | Derived locally from `spruit-sunrise-2k.jpg` | Valid 512 x 256 linear RGBE reconstruction from the SDR photograph. sRGB decoded to linear and multiplied by 1.2, with a synthetic warm Gaussian sun peak 20 at direction `(-45,45,38)`, matched to the scene directional sun. This is **not calibrated captured HDR**. `prepare-environment.py` documents and reproduces the conversion. |
| `spruit-sunrise-2k.jpg` | [Spruit Sunrise](https://polyhaven.com/a/spruit_sunrise), Greg Zaal | `mrdoob/three.js`, tag `r186`, `examples/textures/equirectangular/spruit_sunrise_2k.hdr.jpg` | Original photographed SDR panorama used to derive the runtime reconstructed RGBE environment. The JPEG source remains SDR. |

`prepare-assets.py` and `prepare-environment.py` are original processing code for this project. They perform no
network access and preserve the attribution of their inputs. `credits.json`
records source URLs, byte sizes and SHA-256 hashes for the packaged maps.

JPEG maps have been recompressed for delivery, with no chroma subsampling and
quality 90 for color/roughness/height or 93 for normals. Their dimensions and
orientation are preserved. This is a compact web adaptation, not the original
uncompressed source package.

Only texture maps from tree and fern models are used; original heavy tree meshes
are not included. No commercial asset service, API key or subscription is needed.

## Color and scale

Diffuse color and RGBA photographic foliage: sRGB. Normal, roughness and cutout
alpha: linear / NoColorSpace. Reconstructed RGBE environment: linear. Normal convention: OpenGL.

Soil tile: 2 m. Pine bark tile: about 2 m. Rock tile: about 1.8 m. Aerial
grass/moss-rock tile: 15 m. Cropped wood grain tile: 2 m along U, about 0.09 m
along V. Use material copies with UV rotation for vertical façade boards.
