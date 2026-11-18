"""Conservative jersey evidence, not a trained role/team classifier.

Only a low-saturation torso with repeated vertical light/dark bands supplies
official evidence. A plain black/white jersey or an unresolved crop stays unknown.
Hue is diagnostic only; no particular team colours are required.
"""
import cv2
import numpy as np


def jersey_evidence(image, box):
    x1, y1, x2, y2 = box
    width, height = x2-x1, y2-y1
    torso = image[max(0, int(y1+.17*height)):int(y1+.62*height),
                  max(0, int(x1+.15*width)):int(x2-.15*width)]
    empty = dict(officialEvidence=0., playerEvidence=0., stripeTransitions=0, colourFraction=0.)
    if torso.shape[0] < 8 or torso.shape[1] < 7:
        return empty
    hsv = cv2.cvtColor(torso, cv2.COLOR_BGR2HSV)
    colour = (hsv[:, :, 1] > 65) & (hsv[:, :, 2] > 45)
    fraction = float(np.mean(colour))
    gray = cv2.cvtColor(torso, cv2.COLOR_BGR2GRAY).astype(np.float32)
    # Median over rows suppresses numbers, logos and horizontal jersey bands.
    profile = np.median(gray, axis=0)
    # A median can equal an entire light/dark band and erase half the signs.
    centered = profile-float((np.percentile(profile,10)+np.percentile(profile,90))/2)
    signs = np.sign(centered[np.abs(centered) > 10])
    transitions = int(np.count_nonzero(signs[1:] != signs[:-1]))
    dark, light = float(np.mean(gray < 95)), float(np.mean(gray > 155))
    contrast = float(np.std(profile))
    dx = float(np.mean(np.abs(np.diff(gray, axis=1))))
    dy = float(np.mean(np.abs(np.diff(gray, axis=0))))
    bands = np.clip((transitions-2)/3, 0, 1)
    contrast_score = np.clip((contrast-14)/24, 0, 1)
    balance = min(1., dark/.13, light/.13)
    vertical = np.clip((dx/(dy+1)-.8)/.9, 0, 1)
    official = float(bands*contrast_score*balance*(.55+.45*vertical)*np.clip(1-fraction/.25, 0, 1))
    player = float(np.clip((fraction-.08)/.35, 0, 1))
    return dict(officialEvidence=official, playerEvidence=player,
                stripeTransitions=transitions, colourFraction=fraction)
