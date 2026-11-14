"""Local YOLOX Tiny/Nano ONNX (Apache-2.0) + Supervision ByteTrack (MIT).
No images are sent to HERO servers. No new detector is trained here.
"""
import argparse, json, time, pathlib, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import cv2
import numpy as np
import supervision as sv
from appearance import jersey_evidence
from colour_motion import ColourMotion
if not hasattr(sv, 'ByteTrack'):
    raise RuntimeError('ByteTrack unavailable: install requirements.txt in a clean environment (supervision==0.27.0)')

class Analyzer:
    def __init__(self, model, fps=4, colour_motion=True):
        cv2.setNumThreads(2)
        self.net=cv2.dnn.readNetFromONNX(str(model))
        self.detector='YOLOX-Tiny' if 'tiny' in str(model).lower() else 'YOLOX-Nano'
        self.motion=ColourMotion() if colour_motion else None
        self.tracker=sv.ByteTrack(frame_rate=fps, track_activation_threshold=.25, minimum_consecutive_frames=2)
        self.previous={}; self.last_time=None
        grids=[]; strides=[]
        for stride in (8,16,32):
            yy,xx=np.meshgrid(np.arange(416//stride),np.arange(416//stride),indexing='ij')
            grids.append(np.stack((xx,yy),axis=-1).reshape(-1,2))
            strides.append(np.full((xx.size,1),stride))
        self.grid=np.concatenate(grids); self.stride=np.concatenate(strides)

    def reset(self):
        self.tracker.reset(); self.previous={}; self.last_time=None
        if self.motion:self.motion=ColourMotion()

    def analyze(self, image, timestamp):
        started=time.perf_counter(); height,width=image.shape[:2]; boxes=[]; scores=[]
        # Overlapping tiles retain small distant people; source geometry is intact.
        for left,right in [(0,.45),(.275,.725),(.55,1)]:
            x0=int(left*width); y0=int(.25*height)
            tile=image[y0:int(.82*height),x0:int(right*width)]
            h,w=tile.shape[:2]; ratio=min(416/w,416/h)
            pad=np.full((416,416,3),114,dtype=np.uint8)
            pad[:int(h*ratio),:int(w*ratio)]=cv2.resize(tile,(int(w*ratio),int(h*ratio)))
            self.net.setInput(cv2.dnn.blobFromImage(pad,1,(416,416),swapRB=False))
            pred=self.net.forward()[0]
            pred[:,:2]=(pred[:,:2]+self.grid)*self.stride
            pred[:,2:4]=np.exp(pred[:,2:4])*self.stride
            person=pred[:,4]*pred[:,5]
            for row,score in zip(pred[person>.12],person[person>.12]):
                cx,cy,bw,bh=row[:4]/ratio
                boxes.append([float(cx-bw/2+x0),float(cy-bh/2+y0),float(bw),float(bh)])
                scores.append(float(score))
        keep=cv2.dnn.NMSBoxes(boxes,scores,.12,.45); xyxy=[]; confidence=[]
        for k in np.asarray(keep).reshape(-1):
            x,y,w,h=boxes[k]
            if w>0 and h>0:
                clipped=[max(0,x),max(0,y),min(width,x+w),min(height,y+h)]
                if clipped[2]<=clipped[0] or clipped[3]<=clipped[1]: continue
                xyxy.append(clipped)
                confidence.append(scores[k])
        detections=sv.Detections(xyxy=np.array(xyxy,dtype=np.float32).reshape(-1,4),
            confidence=np.array(confidence,dtype=np.float32),class_id=np.zeros(len(confidence),dtype=int))
        tracked=self.tracker.update_with_detections(detections)
        tracks=[]; current={}; dt=max(.05,timestamp-self.last_time) if self.last_time is not None else .25
        for box,score,tid in zip(tracked.xyxy,tracked.confidence,tracked.tracker_id):
            x1,y1,x2,y2=box; x=float((x1+x2)/2/width); y=float(y2/height)
            old=self.previous.get(int(tid)); vx=vy=0.; age=1
            evidence=jersey_evidence(image,box)
            official=evidence['officialEvidence']; player=evidence['playerEvidence']
            if old:
                vx=.5*old['vx']+.5*(x-old['x'])/dt; vy=.5*old['vy']+.5*(y-old['y'])/dt; age=old['age']+1
                official=.65*old['officialScore']+.35*official
                player=.65*old['playerScore']+.35*player
            track=dict(id=int(tid),x=x,y=y,vx=vx,vy=vy,age=age,confidence=float(score),
                box=[float(x1/width),float(y1/height),float((x2-x1)/width),float((y2-y1)/height)],
                officialScore=official,playerScore=player,appearance=evidence,
                role='official_candidate' if official>=.55 and player<.35 else 'player' if player>=.45 else 'unknown')
            tracks.append(track); current[int(tid)]=track
        self.previous=current; self.last_time=timestamp
        assisted=self.motion.update(image,timestamp,tracked.xyxy) if self.motion else []
        tracks.extend(assisted)
        return dict(time=timestamp,tracks=tracks,analysisMs=(time.perf_counter()-started)*1000,
                    detector=self.detector+' COCO / ByteTrack + jersey evidence',colourMotionCandidates=len(assisted),width=width,height=height)

def offline(args):
    out=pathlib.Path(args.out); out.mkdir(parents=True,exist_ok=True); inventory=[]
    paths=sorted(pathlib.Path(args.videos).glob('*.mp4'))
    if not paths: raise ValueError('No MP4 videos found')
    for i,path in enumerate(paths):
        try:
            cap=cv2.VideoCapture(str(path)); fps=cap.get(5); count=int(cap.get(7)); w=int(cap.get(3)); h=int(cap.get(4)); codec=int(cap.get(6))
            if fps<=0: raise ValueError('Video cannot be decoded')
            analyzer=Analyzer(args.model,args.fps,not args.no_colour_motion); records=[]; samples=[]; step=max(1,round(fps/args.fps)); frame=0
            while True:
                ok,image=cap.read()
                if not ok: break
                if frame%step==0:
                    result=analyzer.analyze(image,frame/fps); records.append(result)
                    if len(samples)<6 and frame>=len(samples)*count/6:
                        annotated=image.copy()
                        for t in result['tracks']:
                            x,y,bw,bh=t['box']; colour=(0,0,255) if t['role']=='official_candidate' else (0,255,0)
                            cv2.rectangle(annotated,(int(x*w),int(y*h)),(int((x+bw)*w),int((y+bh)*h)),colour,2)
                        samples.append(cv2.resize(annotated,(640,360)))
                frame+=1
            cap.release(); stem=f'{i+1:02d}'
            if frame != count: raise ValueError(f'Incomplete decode: {frame}/{count}')
            (out/(stem+'.detections.json')).write_text(json.dumps(records))
            if samples: cv2.imwrite(str(out/(stem+'.contact.jpg')),np.vstack(samples))
            inventory.append(dict(id=stem,file=str(path),fps=fps,width=w,height=h,frames=count,decodedFrames=frame,duration=count/fps,
                codec=''.join(chr(codec>>8*k&255) for k in range(4)),samples=len(records),
                meanAnalysisMs=float(np.mean([r['analysisMs'] for r in records])),meanTracks=float(np.mean([len(r['tracks']) for r in records]))))
            print(json.dumps(inventory[-1]),flush=True)
        except Exception as e:
            inventory.append(dict(file=str(path),error=str(e))); print(str(e),flush=True)
    (out/'inventory.json').write_text(json.dumps(inventory,indent=2))
    if any('error' in item for item in inventory): raise SystemExit(1)

def serve(args):
    analyzer=Analyzer(args.model,colour_motion=not args.no_colour_motion); lock=threading.Lock(); allowed=set(args.origin)
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if not self.authorized() or self.path!='/health': self.send_error(403); return
            self.reply_headers(200); self.wfile.write(json.dumps(dict(status='ready',supervision=sv.__version__,opencv=cv2.__version__)).encode())
        def authorized(self):
            return self.headers.get('Origin') in allowed and self.headers.get('Host') in {f'127.0.0.1:{args.port}',f'localhost:{args.port}'}
        def reply_headers(self,status):
            self.send_response(status); self.send_header('Access-Control-Allow-Origin',self.headers.get('Origin',''))
            self.send_header('Vary','Origin'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Type','application/json')
            self.send_header('Access-Control-Allow-Headers','Content-Type, X-Camera-Reset'); self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network','true'); self.end_headers()
        def do_OPTIONS(self):
            if not self.authorized(): self.send_error(403); return
            self.reply_headers(204)
        def do_POST(self):
            if not self.authorized() or self.path!='/analyze': self.send_error(403); return
            try: size=int(self.headers.get('Content-Length',0))
            except ValueError: self.send_error(400); return
            if self.headers.get('Content-Type')!='image/jpeg': self.send_error(415); return
            if not 0<size<4_000_000: self.send_error(413); return
            if not lock.acquire(False): self.send_error(429); return
            try:
                image=cv2.imdecode(np.frombuffer(self.rfile.read(size),np.uint8),cv2.IMREAD_COLOR)
                if image is None or max(image.shape[:2])>4096: raise ValueError('Invalid frame')
                if self.headers.get('X-Camera-Reset')=='1': analyzer.reset()
                result=analyzer.analyze(image,time.monotonic()); self.reply_headers(200); self.wfile.write(json.dumps(result).encode())
            except Exception:
                self.reply_headers(400); self.wfile.write(b'{"error":"Frame analysis failed"}')
            finally: lock.release()
        def log_message(self,*args): pass
    print(f'Local analyzer: http://127.0.0.1:{args.port}; allowed origins: {allowed}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()

if __name__=='__main__':
    p=argparse.ArgumentParser(); p.add_argument('command',choices=['analyze','serve']); p.add_argument('--model',required=True)
    p.add_argument('--videos'); p.add_argument('--out',default='artifacts/auto-camera'); p.add_argument('--fps',type=int,default=4)
    p.add_argument('--port',type=int,default=8766); p.add_argument('--origin',action='append',default=['http://localhost:3015','http://127.0.0.1:3015'])
    p.add_argument('--no-colour-motion',action='store_true',help='Disable experimental fixed-camera jersey motion assistance')
    args=p.parse_args(); offline(args) if args.command=='analyze' else serve(args)
