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


if __name__ == '__main__': unittest.main()
