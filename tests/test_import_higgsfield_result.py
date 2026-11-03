import os, sys, tempfile, importlib, json
from PIL import Image
def test_stage_and_place(tmp_path, monkeypatch):
    monkeypatch.setenv('SCENES_ROOT', str(tmp_path))
    os.makedirs(tmp_path / 'hf-redraw'); os.makedirs(tmp_path / 'no-text-derivatives-v2/candidates-higgsfield')
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools', 'scenes'))
    import import_higgsfield_result as m; importlib.reload(m)
    ok = tmp_path / 'a.png'; Image.new('RGB', (1920, 1080), 'red').save(ok)
    bad = tmp_path / 'b.png'; Image.new('RGB', (1000, 1000), 'red').save(bad)
    p1 = m.stage('x-1-1', str(ok), 'job1', 2.75); p2 = m.stage('x-1-1', str(ok), 'job2', 2.75)
    assert p1.endswith('x-1-1-1.png') and p2.endswith('x-1-1-2.png')
    try: m.stage('x-1-1', str(bad)); assert False
    except ValueError: pass
    d = m.place('x-1-1'); assert d.endswith('candidates-higgsfield/x-1-1.png') and json.load(open(d + '.json'))['n'] == 2
    m.place('x-1-1'); assert json.load(open(d + '.json'))['n'] == 1
    assert len(open(tmp_path / 'hf-redraw/spend.jsonl').read().splitlines()) == 2
