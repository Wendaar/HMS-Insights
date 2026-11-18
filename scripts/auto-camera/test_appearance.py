import unittest
import numpy as np
from appearance import jersey_evidence
from colour_motion import ColourMotion

class AppearanceTests(unittest.TestCase):
    def test_vertical_stripes_supply_official_evidence(self):
        image=np.zeros((120,60,3),np.uint8)
        for x in range(0,60,8): image[:,x:x+4]=220
        self.assertGreater(jersey_evidence(image,[0,0,60,120])['officialEvidence'],.65)

    def test_plain_dark_white_and_horizontal_jerseys_stay_unknown(self):
        for colour in [30,220]:
            image=np.full((120,60,3),colour,np.uint8)
            self.assertEqual(jersey_evidence(image,[0,0,60,120])['officialEvidence'],0)
        image=np.zeros((120,60,3),np.uint8)
        for y in range(0,120,8): image[y:y+4]=220
        self.assertEqual(jersey_evidence(image,[0,0,60,120])['officialEvidence'],0)

    def test_coloured_and_unresolved_jerseys_are_not_excluded(self):
        image=np.full((120,60,3),(10,20,210),np.uint8)
        r=jersey_evidence(image,[0,0,60,120]);self.assertEqual(r['officialEvidence'],0);self.assertGreater(r['playerEvidence'],.9)
        self.assertEqual(jersey_evidence(image,[0,0,6,10])['officialEvidence'],0)

    def test_moving_jersey_requires_three_observations_and_has_velocity(self):
        tracker=ColourMotion();result=[]
        for i in range(7):
            image=np.full((200,400,3),200,np.uint8);image[100:112,100+i*9:110+i*9]=(0,0,220)
            result=tracker.update(image,i*.25,[])
            if i<3:self.assertEqual(result,[])
        self.assertEqual(len(result),1);self.assertGreater(result[0]['vx'],.05);self.assertLess(result[0]['id'],0)

    def test_static_jersey_and_camera_shake_cannot_produce_motion_tracks(self):
        tracker=ColourMotion();image=np.full((200,400,3),200,np.uint8);image[100:112,100:110]=(0,0,220)
        for i in range(8):self.assertEqual(tracker.update(image,i*.25,[]),[])
        self.assertEqual(tracker.update(np.full_like(image,(0,0,220)),3,[]),[])

    def test_motion_already_inside_person_box_does_not_duplicate_detection(self):
        tracker=ColourMotion()
        for i in range(8):
            image=np.full((200,400,3),200,np.uint8);x=100+i*9;image[100:112,x:x+10]=(0,0,220)
            self.assertEqual(tracker.update(image,i*.25,[[x-5,90,x+15,130]]),[])

    def test_motion_history_does_not_survive_a_long_gap(self):
        tracker=ColourMotion()
        for i in range(6):
            image=np.full((200,400,3),200,np.uint8);image[100:112,100+i*9:110+i*9]=(0,0,220);tracker.update(image,i*.25,[])
        image=np.full((200,400,3),200,np.uint8);image[100:112,160:170]=(0,0,220)
        self.assertEqual(tracker.update(image,10,[]),[])

if __name__=='__main__':unittest.main()
