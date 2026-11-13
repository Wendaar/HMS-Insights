"""Local validation only; never deploys or contacts HERO/production services."""
import argparse, pathlib, subprocess, sys, json
import cv2
import numpy as np
p=argparse.ArgumentParser();p.add_argument('--out',default='artifacts/auto-camera-v2');p.add_argument('--baseline',default='artifacts/auto-camera-baseline-a692b16');args=p.parse_args()
if not (pathlib.Path(args.baseline)/'inventory.json').exists():p.error('Baseline output is missing; supply --baseline from revision a692b16')
subprocess.run([sys.executable,'scripts/auto-camera/test_appearance.py'],check=True)
out=pathlib.Path(args.out)
for item in json.loads((out/'inventory.json').read_text()):
    cap=cv2.VideoCapture(item['file']);images=[]
    for k in range(16):
        frame=round(k*(item['frames']-1)/15);cap.set(cv2.CAP_PROP_POS_FRAMES,frame);ok,image=cap.read()
        if not ok:raise ValueError('Cannot review frame')
        image=cv2.resize(image,(480,270));cv2.putText(image,f"{item['id']} {frame/item['fps']:.2f}s",(8,22),cv2.FONT_HERSHEY_SIMPLEX,.6,(255,255,255),1);images.append(image)
    cap.release();cv2.imwrite(str(out/(item['id']+'.scenes.jpg')),np.vstack([np.hstack(images[i:i+4]) for i in range(0,16,4)]))
subprocess.run([sys.executable,'scripts/auto-camera/render.py','--out',args.out,'--baseline',args.baseline],check=True)
