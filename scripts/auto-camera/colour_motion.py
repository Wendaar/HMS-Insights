"""Optional motion/jersey assistance for a fixed panoramic camera.

Colour components are NOT neural person detections. Require motion and three
consecutive observations; match hue and predicted position; omit camera shake.
Plain/white uniforms still rely on YOLOX. No particular team hue is hardcoded.
"""
import cv2
import numpy as np


class ColourMotion:
    def __init__(self):
        self.previous=None;self.tracks={};self.next_id=-1

    def update(self, image, timestamp, people):
        h,w=image.shape[:2];gray=cv2.cvtColor(image,cv2.COLOR_BGR2GRAY)
        previous=self.previous;self.previous=gray
        if previous is None or previous.shape!=gray.shape:return []
        motion=cv2.absdiff(gray,previous)>18
        roi=motion[int(.30*h):int(.76*h),int(.07*w):int(.95*w)]
        if float(np.mean(roi))>.16:
            self.tracks={};return []
        hsv=cv2.cvtColor(image,cv2.COLOR_BGR2HSV)
        colour=(hsv[:,:,1]>85)&(hsv[:,:,2]>60)
        motion=cv2.dilate(motion.astype(np.uint8),np.ones((5,5),np.uint8))
        mask=(colour&motion.astype(bool)).astype(np.uint8)
        mask[:int(.30*h)]=0;mask[int(.76*h):]=0;mask[:,:int(.07*w)]=0;mask[:,int(.95*w):]=0
        mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
        _,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
        proposals=[]
        for label,(x,y,bw,bh,area) in enumerate(stats[1:],1):
            if area<max(8,w*h*.000004) or area>w*h*.002 or bh<3 or bw<2 or bw>w*.07 or bh>h*.12:continue
            cx=x+bw/2;cy=y+bh/2
            if any(x1<=cx<=x2 and y1<=cy<=y2 for x1,y1,x2,y2 in people):continue
            pixels=hsv[y:y+bh,x:x+bw][labels[y:y+bh,x:x+bw]==label]
            # Circular hue mean handles red wrapping at 179/0.
            angle=pixels[:,0].astype(float)*np.pi/90
            hue=float(np.arctan2(np.mean(np.sin(angle)),np.mean(np.cos(angle)))*90/np.pi%180)
            body_h=bh/.45;box=[max(0.,x-.25*bw),max(0.,y-.17*body_h),min(float(w),x+1.25*bw),min(float(h),y+.83*body_h)]
            proposals.append(dict(x=cx/w,y=box[3]/h,hue=hue,box=[box[0]/w,box[1]/h,(box[2]-box[0])/w,(box[3]-box[1])/h]))
        # Greedy global one-to-one matching, independent from the person tracker.
        pairs=[]
        for index,p in enumerate(proposals):
            for tid,old in self.tracks.items():
                gap=timestamp-old['at'];dh=abs(p['hue']-old['hue']);dh=min(dh,180-dh)
                distance=np.hypot(p['x']-(old['x']+old['vx']*gap),1.5*(p['y']-(old['y']+old['vy']*gap)))
                if 0<gap<=.8 and dh<13 and distance<.07:pairs.append((float(distance+dh*.001),index,tid))
        used=set();matched=set();assignment={}
        for _,index,tid in sorted(pairs):
            if index not in used and tid not in matched:assignment[index]=tid;used.add(index);matched.add(tid)
        current={};result=[]
        for index,p in enumerate(proposals):
            tid=assignment.get(index)
            if tid is None:tid=self.next_id;self.next_id-=1
            old=self.tracks.get(tid);vx=vy=0.;age=1
            if old:
                dt=max(.05,timestamp-old['at']);vx=.4*old['vx']+.6*(p['x']-old['x'])/dt;vy=.4*old['vy']+.6*(p['y']-old['y'])/dt
                age=old['age']+1 if dt<.55 else 1
            current[tid]={**p,'vx':vx,'vy':vy,'age':age,'at':timestamp}
            if age>=3:result.append(dict(id=tid,**p,vx=vx,vy=vy,age=age,confidence=.42,playerScore=.8,officialScore=0.,role='jersey_motion_candidate',source='colour_motion'))
        self.tracks={**{tid:t for tid,t in self.tracks.items() if timestamp-t['at']<.5 and tid not in current},**current}
        return result
