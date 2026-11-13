"""Render full-length 16:9 examples with the same trajectories used by browser JS.
No graphics in output; diagnostic contact sheets are separate. Original files untouched.
"""
import argparse, json, pathlib, subprocess
import cv2
import numpy as np
import imageio_ffmpeg

p=argparse.ArgumentParser();p.add_argument('--out',default='artifacts/auto-camera');args=p.parse_args()
out=pathlib.Path(args.out)
for item in json.loads((out/'inventory.json').read_text()):
    records=json.loads((out/(item['id']+'.trajectory.json')).read_text())
    cap=cv2.VideoCapture(item['file']);w,h=item['width'],item['height'];samples=[]
    target=out/(item['id']+'.auto.mp4')
    command=[imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-f','rawvideo','-pix_fmt','bgr24','-s','960x540','-r',str(item['fps']),'-i','-','-an','-c:v','libx264','-preset','veryfast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(target)]
    proc=subprocess.Popen(command,stdin=subprocess.PIPE)
    for frame,r in enumerate(records):
        ok,image=cap.read()
        if not ok: raise RuntimeError('Incomplete decode during render')
        cw,ch=int(w*r.get('cropWidth',1/r['zoom'])),int(h*r.get('cropHeight',1/r['zoom']));x=max(0,min(w-cw,round(r['x']*w-cw/2)));y=max(0,min(h-ch,round(r['y']*h-ch/2)))
        cropped=cv2.resize(image[y:y+ch,x:x+cw],(960,540));proc.stdin.write(cropped.tobytes())
        if len(samples)<8 and frame>=len(samples)*item['frames']/8:
            annotated=image.copy()
            for t in r['tracks']:
                bx,by,bw,bh=t['box'];cv2.rectangle(annotated,(int(bx*w),int(by*h)),(int((bx+bw)*w),int((by+bh)*h)),(255,255,0),2)
            cv2.rectangle(annotated,(x,y),(x+cw,y+ch),(0,255,255),3)
            row=np.hstack([cv2.resize(annotated,(640,360)),cv2.resize(cropped,(640,360))])
            cv2.putText(row,f"{r['time']:.2f}s {r['trackingState']} conf={r['confidence']:.2f}",(10,25),cv2.FONT_HERSHEY_SIMPLEX,.55,(255,255,255),1)
            samples.append(row)
    cap.release();proc.stdin.close()
    if proc.wait()!=0:raise RuntimeError('FFmpeg failed')
    verify=cv2.VideoCapture(str(target));count=int(verify.get(cv2.CAP_PROP_FRAME_COUNT));width=int(verify.get(3));height=int(verify.get(4));verify.release()
    if count!=item['frames'] or (width,height)!=(960,540):raise RuntimeError('Rendered video verification failed')
    cv2.imwrite(str(out/(item['id']+'.review.jpg')),np.vstack(samples))
    print(json.dumps(dict(id=item['id'],renderedFrames=count,output=str(target))),flush=True)
