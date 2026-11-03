import importlib.util, json, os, sys, tempfile, types, unittest

import numpy as np
from PIL import Image

SC = os.path.join(os.path.dirname(__file__), '..', 'tools', 'scenes')
sys.path.insert(0, SC)


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(SC, name + '.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod


sx = load('square_exceptions'); ci = load('composite_inscription'); gc = load('gate_check'); brj = load('build_rework_jobs')

# Daniel 5:25 as the owner gave it: Mene, Mene, Tekel, Upharsin (pointed text, codepoints spelled out)
VERSE = 'מְנֵא מְנֵא תְּקֵל וּפַרְסִין'
# the same words as the 22 Imperial Aramaic letters, written as codepoints (right-to-left reading order, logical)
EXPECT_LINES = [
    [0x1084c, 0x1084d, 0x10840, 0x20, 0x1084c, 0x1084d, 0x10840],            # MNA MNA
    [0x10855, 0x10852, 0x1084b, 0x20, 0x10845, 0x10850, 0x10853, 0x1084e, 0x10849, 0x1084d],  # TQL WPRSYN
]
FONT = sx.get('daniel-5-1')['render']['font_path']
needs_font = unittest.skipUnless(os.path.isfile(FONT), 'Noto Sans Imperial Aramaic not installed')


class ExceptionData(unittest.TestCase):
    def test_only_daniel_5_1_has_an_exception(self):
        self.assertEqual(set(sx.load()), {'daniel-5-1'})

    def test_verse_text_is_the_owner_text(self):
        self.assertEqual(sx.get('daniel-5-1')['text_he_pointed'], VERSE)
        self.assertEqual(sx.get('daniel-5-1')['verse_s'], 27005025)

    def test_validates(self):
        self.assertTrue(sx.validate(sx.get('daniel-5-1')))

    def test_rendered_codepoints_equal_verse_text(self):
        lines = sx.render_lines(sx.get('daniel-5-1'))
        self.assertEqual([[ord(c) for c in l] for l in lines], EXPECT_LINES)
        back = ' '.join(sx.from_imperial(l) for l in lines)
        self.assertEqual(back, sx.strip_points(VERSE))   # pointed verse minus vowel points, final nun folded

    def test_inconsistent_text_is_rejected(self):
        bad = json.loads(json.dumps(sx.get('daniel-5-1'))); bad['text_he_consonants'] = 'מנא מנא תקל ופרסים'
        with self.assertRaises(ValueError): sx.validate(bad)

    def test_fake_text_veto_is_unchanged(self):
        rule = next(i for i in gc.VETO_TABLE['items'] if i['key'] == 'fakeText')['rule']
        self.assertEqual(rule, 'No letters, pseudo-writing or text-like strokes anywhere, including on tablets and scrolls.')
        self.assertEqual(gc.VETO_TABLE['version'], 'veto-v1-2026-10-23')


class Jobs(unittest.TestCase):
    def test_generator_is_never_asked_for_letters(self):
        st = {'rework_reason': 'veto.mensHair=fail(hair to the collar); veto.fakeText=fail(luminous strokes); veto.registryFix=fail(no letters formed)'}
        self.assertEqual(brj.reason_for('daniel-5-1', st), 'veto.mensHair=fail(hair to the collar)')
        extra = brj.extra_for('daniel-5-1', st)
        self.assertIn('EMPTY', extra); self.assertNotIn('luminous Aramaic', extra)

    def test_other_squares_keep_their_notes(self):
        st = {'rework_reason': 'veto.fakeText=fail(glyphs)'}
        self.assertEqual(brj.reason_for('genesis-9-18', st), st['rework_reason'])


@needs_font
class Composite(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = self.t.name
        self.base = f'{self.d}/live.png'
        rng = np.random.default_rng(1)
        arr = np.full((540, 960, 3), (196, 170, 130), np.uint8)
        arr[:, :, :] += rng.integers(0, 3, arr.shape, dtype=np.uint8)
        arr[380:, :, :] = rng.integers(0, 255, arr[380:].shape, dtype=np.uint8)   # busy floor
        Image.fromarray(arr).save(self.base)
        self.out = f'{self.d}/inscribed/daniel-5-1.png'
    def tearDown(self): self.t.cleanup()

    def test_inscription_evidence_and_unchanged_outside(self):
        before = open(self.base, 'rb').read()
        ev = ci.inscribe('daniel-5-1', self.base, self.out)
        self.assertEqual(open(self.base, 'rb').read(), before)               # text-free base untouched
        self.assertEqual([[int(c, 16) for c in l] for l in ev['rendered_codepoints']], EXPECT_LINES)
        self.assertEqual(ev['glyphs_drawn'], 15)
        a, b = np.asarray(Image.open(self.base)), np.asarray(Image.open(self.out))
        x0, y0, x1, y1 = ev['changed_bbox_xyxy']
        self.assertGreater(int((a != b).any(axis=2).sum()), 500)
        mask = np.ones(a.shape[:2], bool); mask[y0:y1, x0:x1] = False
        self.assertFalse((a[mask] != b[mask]).any())
        self.assertLess(y1, 380)                                                  # stayed off the busy floor

    def test_refuses_busy_box_and_overwrite(self):
        with self.assertRaises(SystemExit): ci.inscribe('daniel-5-1', self.base, self.out, box_norm=[0.2, 0.75, 0.8, 0.98])
        ci.inscribe('daniel-5-1', self.base, self.out)
        with self.assertRaises(SystemExit): ci.inscribe('daniel-5-1', self.base, self.out)

    def test_gate_accepts_good_and_rejects_tampered_evidence(self):
        ci.inscribe('daniel-5-1', self.base, f'{self.d}/sq/inscribed/daniel-5-1.png')
        ctx = types.SimpleNamespace(square_root=f'{self.d}/sq', exceptions_path=sx.EXCEPTIONS_PATH)
        live = ci.sha256(self.base)
        item = gc.Item('square', 'daniel-5-1'); gc.check_inscription(ctx, item, live)
        self.assertEqual(item.reasons, [])
        item = gc.Item('square', 'daniel-5-1'); gc.check_inscription(ctx, item, 'f' * 64)
        self.assertIn('base_sha_not_live', item.reasons[0]['detail'])
        p = f'{self.d}/sq/inscribed/daniel-5-1.inscription.json'
        ev = json.load(open(p)); ev['rendered_lines'][0] = ev['rendered_lines'][0][:-1]
        json.dump(ev, open(p, 'w'))
        item = gc.Item('square', 'daniel-5-1'); gc.check_inscription(ctx, item, live)
        self.assertIn('text_mismatch', item.reasons[0]['detail'])
        os.remove(p)
        item = gc.Item('square', 'daniel-5-1'); gc.check_inscription(ctx, item, live)
        self.assertEqual(item.reasons[0]['code'], 'inscription_evidence_missing')


if __name__ == '__main__':
    unittest.main()
