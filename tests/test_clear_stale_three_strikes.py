import importlib.util, json, os, tempfile, unittest

SPEC = importlib.util.spec_from_file_location(
    'cst', os.path.join(os.path.dirname(__file__), '..', 'tools', 'scenes', 'clear_stale_three_strikes.py'))
cst = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(cst)


class Clear(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory(); self.d = self.t.name
        def st(id, state, flag=True): json.dump({'id': id, 'state': state, 'escalated_three_strikes': flag}, open(f'{self.d}/{id}.json', 'w'))
        st('a', 'pass'); st('b', 'rework'); st('c', 'pass')
        rec = lambda id, kind='square', esc=True: {'kind': kind, 'id': id, 'strikes': [1, 2, 3], 'escalated': esc}
        self.doc = {'items': {'square:a': rec('a'), 'square:b': rec('b'), 'square:c': rec('c'), 'still:s': rec('s', 'still'), 'square:z': rec('z', esc=False)},
                    'escalatedIds': ['square:a', 'square:b', 'square:c', 'still:s']}
    def tearDown(self): self.t.cleanup()

    def test_clears_only_passing_squares(self):
        cleared, kept, writes = cst.clear(self.doc, self.d, lambda id: id != 'c', 'T')
        self.assertEqual(cleared, ['a']); self.assertEqual(sorted(kept), ['b', 'c'])
        self.assertEqual(self.doc['escalatedIds'], ['square:b', 'square:c', 'still:s'])
        self.assertEqual(len(self.doc['items']['square:a']['strikes']), 3)   # history kept
        self.assertFalse(list(writes.values())[0]['escalated_three_strikes'])
        self.assertEqual(list(writes), [f'{self.d}/a.json'])

    def test_failing_gate_on_pass_state_is_kept(self):
        cleared, kept, _ = cst.clear(self.doc, self.d, lambda id: False, 'T')
        self.assertEqual(cleared, [])

if __name__ == '__main__': unittest.main()
