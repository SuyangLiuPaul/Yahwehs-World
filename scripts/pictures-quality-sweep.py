#!/usr/bin/env python3
"""How the served picture quality was chosen (docs/evidence/gallery-2026-11/pictures-quality-sweep.md).

  python3 -I scripts/pictures-quality-sweep.py

40 random gate-passed squares (seed 7) from the T7 live folder are resized exactly as scripts/lib/pictures_convert.py does
(Lanczos, 1344 px and 480 px wide), encoded as WebP (method 6) at quality 78 down to 64, and compared with the resized
original: bytes, mean and minimum SSIM (skimage, per-channel) and PSNR. It reads only; it writes nothing.
Needs Pillow with WebP, numpy and scikit-image.
"""
import io, json, random, sys
import numpy as np
from PIL import Image
from skimage.metrics import structural_similarity as ssim, peak_signal_noise_ratio as psnr
ids=list(json.load(open('/Volumes/androidbuild/globe-integrate/data/gallery/pictures.json'))['p'])
random.seed(7); sample=random.sample(ids,40)
LIVE='/Volumes/T7/yahwehs-globe-scenes/no-text-derivatives-v2/live/'
def enc(im,q,**kw):
    b=io.BytesIO(); im.save(b,'WEBP',quality=q,method=6,**kw); return b.getvalue()
def dec(b): return np.asarray(Image.open(io.BytesIO(b)).convert('RGB'))
for width in (1344,480):
    print('width',width)
    res={}
    for id in sample:
        im=Image.open(LIVE+id+'.png').convert('RGB'); h=round(im.height*width/im.width)
        r=im.resize((width,h),Image.LANCZOS); ref=np.asarray(r)
        for q in (78,76,74,72,70,68,66,64):
            b=enc(r,q); d=dec(b)
            s=ssim(ref,d,channel_axis=2); p=psnr(ref,d)
            res.setdefault(q,[]).append((len(b),s,p))
    base=np.mean([x[0] for x in res[78 if width==1344 else 76]])
    for q,v in sorted(res.items(),reverse=True):
        a=np.array(v); print(q,'KB %.1f'%(a[:,0].mean()/1024),'rel %.3f'%(a[:,0].mean()/base),'ssim %.4f (min %.4f)'%(a[:,1].mean(),a[:,1].min()),'psnr %.2f'%a[:,2].mean())
