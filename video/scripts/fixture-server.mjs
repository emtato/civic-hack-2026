// Video-only staging API. No database, external writes, or real accounts.
// The app itself runs unchanged on a separate Vite port.
import http from 'node:http';
import fs from 'node:fs/promises';
import ts from 'typescript';

async function loadTypescript(relativePath) {
  const source = await fs.readFile(new URL(relativePath, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022},
  }).outputText.replace(/export \* from ['"].*?['"];?/g, '');
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const {proposals} = await loadTypescript('../../frontend/src/data/proposals.ts');
const {applyFeedbackToAggregate} = await loadTypescript('../../frontend/src/data/proposalFeedbackDTO.ts');
const responses = new Map();
const demoDate = '2026-11-13T18:00:00Z';
const before = 'Accessible passenger pickup is available until 6 p.m.';
const after = 'Accessible passenger pickup is available until 8 p.m.';
const fixtureDiff = {
  id: 'video-demo-diff', proposal_id: 'kensington',
  before_snapshot_id: 'video-before', after_snapshot_id: 'video-after',
  compared_at: demoDate, classification: 'unclassified', review_required: true,
  is_demo: true, demo_label: 'Fictional before and after wording for the video draft.',
  changes: [{path: 'description', operation: 'changed', before, after, text_diff: null}],
};

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5174');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  const send = (value, status = 200) => {res.writeHead(status); res.end(JSON.stringify(value));};
  if (req.method === 'OPTIONS') return send({});
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path === '/api/auth/login') return send({access_token: 'fictional-video-session', username: 'demo-resident'});
  if (path === '/api/auth/me') return send({username: 'demo-resident'});
  if (path === '/api/following') return send([]);
  if (path.startsWith('/api/notifications')) return send({items: [], unread_count: 0});
  if (path === '/api/proposals') return send(proposals);
  const match = path.match(/^\/api\/proposals\/([^/]+)(.*)$/);
  if (!match) return send({detail: 'No video fixture for this path'}, 404);
  const proposal = proposals.find(p => p.id === match[1]);
  if (!proposal) return send({}, 404);
  const tail = match[2];
  if (!tail) return send(proposal);
  if (tail === '/aggregate') return send(proposal.community_aggregate);
  if (tail === '/follow') return send({});
  if (tail === '/updates') return send({
    proposal_id: proposal.id, checked_at: demoDate, snapshot_id: 'video-after',
    snapshot_sequence: 2, snapshot_created: false, source_status: 'ready',
    diffs: proposal.id === 'kensington' ? [fixtureDiff] : [],
  });
  if (tail.startsWith('/snapshots/')) {
    const id = tail.split('/').pop();
    return send({id, proposal_id: proposal.id, sequence: id === 'video-before' ? 1 : 2,
      captured_at: demoDate, source_urls: [], is_demo: true,
      demo_label: 'Fictional video fixture', content: {description: id === 'video-before' ? before : after}});
  }
  if (tail === '/feedback' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const submission = {...JSON.parse(body), participant_id: 'demo-resident', submitted_at: demoDate};
    proposal.community_aggregate = applyFeedbackToAggregate(proposal.community_aggregate, submission, responses.get(proposal.id));
    responses.set(proposal.id, submission);
    return send({status: 'success', feedback: submission, community_aggregate: proposal.community_aggregate}, 201);
  }
  if (tail === '/feedback') return send([]);
  if (tail.startsWith('/feedback/')) return responses.has(proposal.id) ? send(responses.get(proposal.id)) : send({}, 404);
  return send({detail: 'No video fixture for this path'}, 404);
}).listen(8011, '127.0.0.1', () => console.log('Video fixture API: http://127.0.0.1:8011 (memory only)'));
