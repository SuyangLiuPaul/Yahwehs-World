import hashlib, importlib.util, json, os, tempfile, unittest

SPEC = importlib.util.spec_from_file_location(
    'build_rework_jobs', os.path.join(os.path.dirname(__file__), '..', 'tools', 'scenes', 'build_rework_jobs.py'))
brj = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(brj)


def h(b): return hashlib.sha256(b).hexdigest()


class PendingCandidate(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.R = self.t.name
        os.makedirs(f'{self.R}/candidates-codex'); os.makedirs(f'{self.R}/archive-rework')
    def tearDown(self): self.t.cleanup()
    def cand(self, data, id='x-1'):
        open(f'{self.R}/candidates-codex/{id}.png', 'wb').write(data)
    def pending(self, st): return brj.pending_candidate('x-1', st, R=self.R)

    def test_live_equals_candidate(self):
        self.cand(b'live'); self.assertFalse(self.pending({'live_sha256': h(b'live')}))

    def test_status_candidate_sha(self):
        self.cand(b'c'); self.assertFalse(self.pending({'live_sha256': h(b'other'), 'candidate_sha256': h(b'c')}))

    def test_stale_archived_failed_picture(self):
        self.cand(b'old')
        open(f'{self.R}/archive-rework/x-1-{h(b"old")[:12]}.png', 'wb').write(b'old')
        self.assertFalse(self.pending({'live_sha256': h(b'new')}))

    def test_unprocessed_new_candidate_blocks(self):
        self.cand(b'fresh'); self.assertTrue(self.pending({'live_sha256': h(b'new')}))

    def test_rejected_candidate(self):
        self.cand(b'bad')
        json.dump({'x-1': h(b'bad')}, open(f'{self.R}/candidates-codex/promote-rejected.json', 'w'))
        self.assertFalse(self.pending({'live_sha256': h(b'new')}))


class PromptRules(unittest.TestCase):
    def test_emblem_faketext_blanks_icon_pages(self):
        st = {'rework_reason': 'veto.fakeText=fail(The top-left scroll emblem contains rows of writing-like strokes)'}
        self.assertIs(brj.icon_sentence(st), brj.ICON_BLANK)

    def test_other_reasons_keep_icon(self):
        self.assertIs(brj.icon_sentence({'rework_reason': 'veto.mensHair=fail(long hair)'}), brj.ICON_KEEP)
        self.assertIs(brj.icon_sentence({'rework_reason': 'veto.fakeText=fail(glyphs on the wall)'}), brj.ICON_KEEP)

    def test_extra_adds_notext_and_registry(self):
        brj.REG['x-1'] = 'Show five loaves'
        try:
            e = brj.extra_for('x-1', {'failed_vetoes': ['fakeText']})
            self.assertIn('glyph-like', e); self.assertIn('Show five loaves', e)
            self.assertEqual(brj.extra_for('y-2', {'failed_vetoes': ['mensHair']}), '')
        finally: del brj.REG['x-1']


if __name__ == '__main__': unittest.main()
