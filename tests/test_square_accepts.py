"""The owner acceptances (tools/scenes/square_accepts.json) forgive one key on one square and
nothing else: the veto table, its SHA and every other square are untouched, and an acceptance
lapses the moment the picture changes."""
import importlib.util, json, os, sys, tempfile, unittest

SC = os.path.join(os.path.dirname(__file__), '..', 'tools', 'scenes')
sys.path.insert(0, SC)


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(SC, name + '.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod


sa = load('square_accepts'); gc = load('gate_check'); asa = load('apply_square_accepts')

VETO_TABLE_SHA_BEFORE_ACCEPTS = 'veto-v1-2026-10-23'


def write(dirpath, name, obj):
    path = os.path.join(dirpath, name)
    with open(path, 'w', encoding='utf-8') as handle:
        json.dump(obj, handle, ensure_ascii=False)
    return path


def accepts_file(dirpath, keys, **over):
    entry = {'reason': 'r', 'ref': 'Genesis 1:1', 'decidedBy': 'test', 'decidedAt': '2026-11-03',
             'keys': keys}
    entry.update(over)
    return write(dirpath, 'a.json', {'schema': 'square-accepts-v1', 'accepts': {'x-1-1': entry}})


class Data(unittest.TestCase):
    def test_veto_table_is_not_changed(self):
        self.assertEqual(gc.VETO_TABLE['version'], VETO_TABLE_SHA_BEFORE_ACCEPTS)
        self.assertEqual(len(gc.VETO_KEYS), 10)

    def test_shipped_file_loads_and_every_key_is_a_veto_key(self):
        for event_id in sa.load():
            keys = sa.accepted_keys(event_id, gc.VETO_KEYS)
            self.assertTrue(keys, event_id)
            for key in keys:
                self.assertIn(key, gc.VETO_KEYS)

    def test_an_unlisted_square_is_accepted_nothing(self):
        self.assertEqual(sa.accepted_keys('no-such-square-1-1', gc.VETO_KEYS), ())

    def test_a_key_outside_the_table_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = accepts_file(d, {'niceHair': 'because'})
            with self.assertRaises(ValueError):
                sa.accepted_keys('x-1-1', gc.VETO_KEYS, path)

    def test_an_empty_reason_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = accepts_file(d, {'mensHair': '  '})
            with self.assertRaises(ValueError):
                sa.accepted_keys('x-1-1', gc.VETO_KEYS, path)

    def test_a_missing_ruling_field_raises(self):
        with tempfile.TemporaryDirectory() as d:
            path = accepts_file(d, {'mensHair': 'ok'}, decidedBy='')
            with self.assertRaises(ValueError):
                sa.accepted_keys('x-1-1', gc.VETO_KEYS, path)


class Review(unittest.TestCase):
    """check_review with and without an acceptance, on the same written-fail review."""

    def review(self, answers, verdict='fail'):
        return {'schema': gc.REVIEW_SCHEMA, 'id': 'x-1-1', 'kind': 'square', 'verdict': verdict,
                'subject': {'sha256': 'deadbeef'},
                'veto': {k: {'answer': answers.get(k, 'pass'), 'note': 'n'} for k in gc.VETO_KEYS},
                'reviewer': {'model': 'm1', 'session': 's1'},
                'generator': {'model': 'm2', 'session': 's2'},
                'inputs': [{'kind': 'image', 'sha256': 'deadbeef'},
                           {'kind': 'factCard', 'sha256': 'cardsha'},
                           {'kind': 'vetoTable', 'sha256': gc.VETO_TABLE_SHA256}]}

    def run_check(self, answers, accepted=(), verdict='fail'):
        item = gc.Item('square', 'x-1-1')
        with tempfile.TemporaryDirectory() as d:
            path = write(d, 'r.json', self.review(answers, verdict))
            gc.check_review(None, item, path, 'image', 'deadbeef', 'cardsha',
                            registry_applies=False, accepted=accepted)
        return item

    def test_without_an_acceptance_the_fail_still_fails(self):
        item = self.run_check({'mensHair': 'fail'})
        self.assertIn('veto_failed', [r['code'] for r in item.reasons])

    def test_the_accepted_key_is_forgiven_and_recorded(self):
        item = self.run_check({'mensHair': 'fail'}, accepted=('mensHair',))
        self.assertEqual(item.reasons, [])
        self.assertEqual(item.measured['acceptedVetoes'], ['mensHair=fail'])
        self.assertIn('owner_accepted:mensHair=fail', item.warnings)

    def test_an_unaccepted_key_still_fails_beside_an_accepted_one(self):
        item = self.run_check({'mensHair': 'fail', 'modesty': 'fail'}, accepted=('mensHair',))
        codes = {r['code']: r.get('detail') for r in item.reasons}
        self.assertEqual(codes.get('veto_failed'), 'modesty=fail')
        self.assertIn('review_verdict_not_pass', codes)

    def test_accepting_a_key_the_reviewer_passed_changes_nothing(self):
        item = self.run_check({}, accepted=('mensHair',), verdict='pass')
        self.assertEqual(item.reasons, [])
        self.assertNotIn('acceptedVetoes', item.measured)


class Binding(unittest.TestCase):
    def binding(self, status, accepted=('mensHair',), sha='abc'):
        item = gc.Item('square', 'x-1-1')
        gc.check_accept_binding(item, status, accepted, sha)
        return [r['code'] for r in item.reasons]

    def good(self):
        return {'owner_accept': {'keys': ['mensHair'], 'live_sha256': 'abc', 'ruling': 'r',
                                 'decidedBy': 'who', 'decidedAt': '2026-11-03'}}

    def test_a_matching_block_passes(self):
        self.assertEqual(self.binding(self.good()), [])

    def test_no_block_fails(self):
        self.assertEqual(self.binding({}), ['owner_accept_missing'])

    def test_a_redrawn_picture_lapses_the_acceptance(self):
        self.assertEqual(self.binding(self.good(), sha='a-new-sha'), ['owner_accept_invalid'])

    def test_a_block_claiming_more_keys_than_the_file_fails(self):
        status = self.good(); status['owner_accept']['keys'] = ['mensHair', 'modesty']
        self.assertEqual(self.binding(status), ['owner_accept_invalid'])


class Apply(unittest.TestCase):
    ENTRY = {'reason': 'the passage requires it', 'ref': 'Genesis 1:1', 'decidedBy': 'test',
             'decidedAt': '2026-11-03', 'keys': {'mensHair': 'short crop at the collar'}}

    def test_plan_writes_state_and_a_bound_block(self):
        status = {'state': 'rework', 'status': 'rework', 'live_sha256': 'abc',
                  'independent_review': 'fail', 'escalated_three_strikes': True}
        changes, err = asa.plan_one('x-1-1', self.ENTRY, status, 'abc')
        self.assertIsNone(err)
        self.assertEqual(changes['state'], 'pass')
        self.assertEqual(changes['escalated_three_strikes'], False)
        self.assertEqual(changes['owner_accept']['live_sha256'], 'abc')
        self.assertEqual(changes['owner_accept']['keys'], ['mensHair'])
        self.assertNotIn('independent_review', changes)   # the reviewer's verdict is never rewritten

    def test_a_stale_status_sha_is_refused(self):
        status = {'state': 'rework', 'live_sha256': 'old'}
        changes, err = asa.plan_one('x-1-1', self.ENTRY, status, 'abc')
        self.assertEqual(changes, {})
        self.assertIn('live_sha256', err)


class RedrawNotes(unittest.TestCase):
    """build_rework_jobs adds the concrete note AFTER the reviewer's own words, never instead."""

    def setUp(self):
        self.brj = load('build_rework_jobs')

    def test_every_noted_square_is_one_we_redraw_not_one_we_accepted(self):
        notes = json.load(open(os.path.join(SC, 'square_redraw_notes.json'), encoding='utf-8'))
        self.assertEqual(notes['schema'], 'square-redraw-notes-v1')
        self.assertFalse(set(notes['notes']) & set(sa.load()))
        for event_id, note in notes['notes'].items():
            self.assertGreater(len(note), 60, event_id)
            self.assertEqual(self.brj.redraw_note(event_id), note.strip())

    def test_an_unlisted_square_gets_no_note(self):
        self.assertEqual(self.brj.redraw_note('no-such-square-1-1'), '')

    def test_a_bad_notes_file_is_ignored_not_fatal(self):
        with tempfile.TemporaryDirectory() as d:
            path = write(d, 'n.json', {'schema': 'something-else', 'notes': {'x-1-1': 'hi'}})
            self.assertEqual(self.brj.redraw_note('x-1-1', path), '')
            self.assertEqual(self.brj.redraw_note('x-1-1', os.path.join(d, 'gone.json')), '')


class SyncDoesNotRevert(unittest.TestCase):
    """The 30-minute promote loop must not drive an accepted square back to rework."""

    def setUp(self):
        self.sr = load('sync_reviews')

    def test_a_bound_acceptance_is_left_alone(self):
        event_id = sorted(sa.load())[0]
        keys = sorted(sa.accepted_keys(event_id, gc.VETO_KEYS))
        st = {'id': event_id, 'owner_accept': {'keys': keys, 'live_sha256': 'abc'}}
        self.assertTrue(self.sr.owner_accept_binds(st, 'abc'))

    def test_a_redrawn_picture_is_processed_normally_again(self):
        event_id = sorted(sa.load())[0]
        keys = sorted(sa.accepted_keys(event_id, gc.VETO_KEYS))
        st = {'id': event_id, 'owner_accept': {'keys': keys, 'live_sha256': 'abc'}}
        self.assertFalse(self.sr.owner_accept_binds(st, 'a-new-sha'))

    def test_a_square_with_no_acceptance_is_processed_normally(self):
        self.assertFalse(self.sr.owner_accept_binds({'id': 'no-such-square-1-1'}, 'abc'))


if __name__ == '__main__':
    unittest.main()
