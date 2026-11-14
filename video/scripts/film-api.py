"""Video-only adapter: real demo domain logic, memory storage, no external services."""
from pathlib import Path
import copy,json,sys
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'backend'))
from persistence.test_persistence import MockMongoCollection
from service import labatt_demo as labatt
from service.service import to_display_proposal
from proposals_DTO import ProposalFeedbackSubmissionDTO

out=ROOT/'video/public/v2'
raw=json.loads((ROOT/'backend/data/labatt-demo.json').read_text())
# Make the existing delivery-noise resident the returning participant for filming.
for r in raw['versions'][0]['responses']:
    if r['participant_id']=='demo-resident': r['participant_id']='film-pickup-resident'
    elif r['participant_id']=='labatt-demo-p02': r['participant_id']='demo-resident'
raw['versions'][1]['responses']=[r for r in raw['versions'][1]['responses'] if r['participant_id']!='labatt-demo-p02']
(out/'delivery-fixture.json').write_text(json.dumps(raw,indent=2))
seed=labatt.load_seed(out/'delivery-fixture.json')
labatt.bundled_seed=lambda:seed
collection=MockMongoCollection()
records=json.loads((ROOT/'backend/data/proposals.formatted.json').read_text())
if isinstance(records,dict): records=records.get('proposals',list(records.values()))
proposals=[to_display_proposal(r).model_dump(mode='json') for r in records]
base=labatt.build_journey(seed,{})
(out/'journey-before.json').write_text(base.model_dump_json(indent=2))
(out/'journey-after.json').write_text(base.model_dump_json(indent=2))

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def send(self,data,status=200):
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Access-Control-Allow-Origin','http://localhost:5174')
        self.send_header('Access-Control-Allow-Headers','Content-Type, Authorization, Accept, X-Proviso-Demo-Session')
        self.send_header('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS')
        self.end_headers();self.wfile.write(json.dumps(data).encode())
    def do_OPTIONS(self):self.send({})
    def run_request(self):
        path=urlparse(self.path).path
        token=self.headers.get('X-Proviso-Demo-Session','f'*64)
        demo=labatt.LabattDemo(collection,token)
        body=json.loads(self.rfile.read(int(self.headers.get('Content-Length',0))) or '{}')
        if path=='/api/proposals':return self.send(proposals)
        if path=='/api/demos/labatt':return self.send(demo.read().model_dump(mode='json'))
        if path=='/api/demos/labatt/feedback/preview':return self.send([])
        if path=='/api/demos/labatt/response':
            journey=demo.save(body['revision'],ProposalFeedbackSubmissionDTO.model_validate(body['response']))
            (out/'journey-after.json').write_text(journey.model_dump_json(indent=2))
            return self.send(journey.model_dump(mode='json'))
        if path=='/api/demos/labatt/reset':return self.send(demo.reset(body['revision']).model_dump(mode='json'))
        if path.endswith('/updates'):
            return self.send(dict(proposal_id=path.split('/')[3],checked_at=None,snapshot_id=None,snapshot_sequence=0,snapshot_created=False,diffs=[],source_status='pending'))
        if path.endswith('/aggregate'):
            p=next((p for p in proposals if p['id']==path.split('/')[3]),None)
            return self.send(p['community_aggregate'] if p else {},200 if p else 404)
        if path.endswith('/feedback'):return self.send([])
        if path=='/api/following':return self.send([])
        if path=='/api/auth/me':return self.send({},401)
        return self.send({},404)
    def do_GET(self):self.run_request()
    def do_POST(self):self.run_request()
    def do_PUT(self):self.run_request()
print('Filming API http://127.0.0.1:8012 — memory storage only',flush=True)
ThreadingHTTPServer(('127.0.0.1',8012),Handler).serve_forever()
