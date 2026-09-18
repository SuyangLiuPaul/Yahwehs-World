# Motion capture sources

Every `.bvh` in this folder is a trimmed copy (the T-pose frame plus the frames
a clip uses, at 60 fps) of a take from the **CMU Graphics Lab Motion Capture
Database**, in Bruce Hahne's BVH conversion. `clips.txt` maps each of our clip
names to its file; `tools/autorig/mocap.py` retargets them onto a figure.

## The data and its terms

- **Database:** Carnegie Mellon University Graphics Lab Motion Capture Database,
  http://mocap.cs.cmu.edu/ — captured with a 12-camera Vicon system at 120 Hz,
  41 markers. Created with funding from NSF EIA-0196217.
- **Terms, from the database's own FAQ (http://mocap.cs.cmu.edu/faqs.php, read
  2026-09-18):** *"How can I use this data? The motion capture data may be
  copied, modified, or redistributed without permission."* Their stated wish,
  not a condition: if you publish results obtained using the data, send them
  the citation and add *"The data used in this project was obtained from
  mocap.cs.cmu.edu. The database was created with funding from NSF
  EIA-0196217."* to your acknowledgments.
- **BVH conversion:** the "Motionbuilder-friendly BVH conversion release" by
  Bruce Hahne (cgspeed.com), 2010, converted from CMU's ASF/AMC. His
  READMEFIRST (v1.1, 2010-06-26) says the CMU data is *"free for use in
  research and commercial projects worldwide"* and places no further terms on
  the conversion; joints are renamed to MotionBuilder's names and a T-pose is
  added as frame 0, the motion itself is untouched.
- **Where the files came from:** the GitHub mirror of that release,
  https://github.com/una-dinosauria/cmu-mocap (`data/<subject>/<trial>.bvh`,
  fetched one file at a time on 2026-09-18), which also carries the
  READMEFIRST and the motion index. No account, no download of the whole set.

No Mixamo, no Meshy, nothing with an account or a ToS behind it.

## Which take drives which clip

| clip | CMU trial | description in the CMU index | frames used (of the 120 fps take) | why this one |
|---|---|---|---|---|
| idle | 139_02 | "Shifting Weight" | 60–912, looped | a man standing still and staying alive: weight shifts, the head settles. The takes actually labelled "Idle" (140_06, 140_07) are a crouched ready-stance for a game, not a man in a court |
| walk | 37_01 | "slow walk" | 120–276, one stride, looped | the only walk slow enough for a robe. 02_01 and 141_19 at a normal pace tear the robe's front panel open at the stride; 143_32 and 139_28 turn round |
| look | 40_11 | "wait for bus" | 1–480, looped | stands and looks down the road both ways. Every take called "looking around" (77_01, 77_04, 139_01, 139_03/04, 139_26/27) is a stealth crouch |
| speak | 19_08 | "conversation – explain with hand gestures (2 subjects – subject B)" | 1250–1720, looped, arms at 0.75 | one hand forward, open, explaining. Subject B talks with his whole arm — one gesture flings both hands above the head — so the arm motion is scaled to three quarters (`arms=0.75` in clips.txt), which keeps the timing and brings the hands down to chest height. The giving-directions take (139_25) is a crouching pantomime |
| carry | 69_69 | "walk forward and pick up object, carry back object" | 450–598, looped | the still moment of holding the thing in both hands before he turns to carry it. The "walk and carry" takes (111_36, 113_26) hold a box well but walk and turn, and the walking tears the robe |
| pray | — | — | — | **hand-keyed, autorig_clips.py.** Nothing in the CMU index is a man standing with hands lifted (1 Kgs 8:22); the "stretch and yawn" and "range of motion" takes are not that |

The exact end frames are chosen by `mocap.py` at run time (the frame nearest
the asked end whose pose best matches the start), so the numbers above are
what the trimmed files contain, and `clips.txt` addresses them as 1..n.
