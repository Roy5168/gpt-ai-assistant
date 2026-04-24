import crypto from 'crypto';
import express from 'express';
import config from '../config/index.js';
import stateStore from '../services/church-vote-state.js';

const router = express.Router();

const ADMIN_KEY = config.CHURCH_VOTE_ADMIN_KEY || 'church-admin-change-me';
const ADMIN_USERNAME = config.CHURCH_VOTE_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = config.CHURCH_VOTE_ADMIN_PASSWORD || 'ChangeMe123!';
const ADMIN_MFA_SECRET = config.CHURCH_VOTE_ADMIN_MFA_SECRET || 'CHURCH_VOTE_DEFAULT_SECRET';

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const toBase64Url = (text) => Buffer.from(text).toString('base64url');

const hmacSign = (text) => crypto.createHmac('sha256', ADMIN_KEY).update(text).digest('hex');

const generateTotp = (secret, unixSeconds = Math.floor(Date.now() / 1000), step = 30) => {
  const counter = Math.floor(unixSeconds / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1000000).padStart(6, '0');
};

const verifyTotp = (secret, code) => {
  const now = Math.floor(Date.now() / 1000);
  return [-30, 0, 30].some((drift) => generateTotp(secret, now + drift) === String(code));
};

const issueAdminToken = (username) => {
  const payload = {
    sub: username,
    exp: Date.now() + (12 * 60 * 60 * 1000),
    nonce: uuid(),
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = hmacSign(encoded);
  return `${encoded}.${sig}`;
};

const decodeAdminToken = (token) => {
  const [encoded, sig] = String(token || '').split('.');
  if (!encoded || !sig) return null;
  if (hmacSign(encoded) !== sig) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.exp || Date.now() > payload.exp) return null;
  return payload;
};

const withData = (handler) => async (req, res, next) => {
  try {
    const data = await stateStore.read();
    return await handler(req, res, next, data);
  } catch (error) {
    return next(error);
  }
};

const audit = (data, req, action, payload = {}) => {
  data.auditLogs.push({
    id: uuid(),
    action,
    payload,
    actor: req.headers['x-admin-user'] || 'admin',
    createdAt: nowIso(),
  });
};

const requireAdmin = (req, res, next) => {
  const legacyKey = req.headers['x-admin-key'];
  if (legacyKey && legacyKey === ADMIN_KEY) return next();

  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  const payload = decodeAdminToken(token);
  if (!payload) return res.status(401).json({ message: 'Unauthorized admin access' });
  req.admin = payload;
  return next();
};

const getElectionById = (data, electionId) => data.elections.find((row) => row.id === electionId);

const electionIsOpen = (election) => {
  const now = Date.now();
  return election?.status === 'active'
    && now >= new Date(election.startAt).getTime()
    && now <= new Date(election.endAt).getTime();
};

const getActiveCandidates = (data, electionId) => data.candidates
  .filter((candidate) => candidate.electionId === electionId && candidate.active)
  .sort((a, b) => a.sortOrder - b.sortOrder);

const sanitizeTokenRecord = (record) => ({
  id: record.id,
  electionId: record.electionId,
  voterId: record.voterId,
  issuedAt: record.issuedAt,
  expiresAt: record.expiresAt,
  usedAt: record.usedAt,
  revokedAt: record.revokedAt,
});

router.post('/api/v1/admin/auth/login', withData(async (req, res, _next, data) => {
  const { username, password, mfaCode } = req.body;
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'invalid admin credentials' });
  }
  if (!verifyTotp(ADMIN_MFA_SECRET, mfaCode)) {
    return res.status(401).json({ message: 'invalid mfa code' });
  }

  const token = issueAdminToken(username);
  data.adminSessions.push({ id: uuid(), username, tokenHash: sha256(token), issuedAt: nowIso() });
  audit(data, req, 'admin.login', { username });
  await stateStore.write(data);

  return res.json({ accessToken: token, tokenType: 'Bearer', expiresInSeconds: 43200 });
}));

// ----- Voter API -----
router.post('/api/v1/voter/verify-token', withData(async (req, res, _next, data) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'token required' });

  const tokenHash = sha256(token);
  const tokenRecord = data.votingTokens.find((row) => row.tokenHash === tokenHash);

  if (!tokenRecord) return res.status(400).json({ message: 'invalid token' });
  if (tokenRecord.revokedAt) return res.status(400).json({ message: 'token revoked' });
  if (tokenRecord.usedAt) return res.status(400).json({ message: 'token already used' });
  if (Date.now() > new Date(tokenRecord.expiresAt).getTime()) return res.status(400).json({ message: 'token expired' });

  const election = getElectionById(data, tokenRecord.electionId);
  if (!election) return res.status(400).json({ message: 'election not found' });
  if (!electionIsOpen(election)) return res.status(400).json({ message: 'election is not active' });

  return res.json({
    voteSessionToken: token,
    election,
    candidates: getActiveCandidates(data, election.id),
  });
}));

router.post('/api/v1/voter/ballots', withData(async (req, res, _next, data) => {
  const { voteSessionToken, selectedCandidateIds = [] } = req.body;
  if (!voteSessionToken) return res.status(400).json({ message: 'voteSessionToken required' });
  if (!Array.isArray(selectedCandidateIds)) return res.status(400).json({ message: 'selectedCandidateIds must be array' });

  const tokenHash = sha256(voteSessionToken);
  const tokenRecord = data.votingTokens.find((row) => row.tokenHash === tokenHash);
  if (!tokenRecord) return res.status(400).json({ message: 'invalid token' });
  if (tokenRecord.revokedAt) return res.status(400).json({ message: 'token revoked' });
  if (tokenRecord.usedAt) return res.status(400).json({ message: 'token already used' });

  const election = getElectionById(data, tokenRecord.electionId);
  if (!election || !electionIsOpen(election)) return res.status(400).json({ message: 'election is not active' });

  const candidates = getActiveCandidates(data, election.id);
  const candidateIdSet = new Set(candidates.map((row) => row.id));
  const uniq = [...new Set(selectedCandidateIds)];

  if (uniq.length > election.seats) return res.status(400).json({ message: `over selection: seats=${election.seats}` });
  if (uniq.some((candidateId) => !candidateIdSet.has(candidateId))) return res.status(400).json({ message: 'contains invalid candidate id' });

  const ballot = { id: uuid(), electionId: election.id, selectedCandidateIds: uniq, submittedAt: nowIso() };
  data.ballots.push(ballot);
  tokenRecord.usedAt = nowIso();

  await stateStore.write(data);
  return res.status(201).json({ ballotId: ballot.id, submittedAt: ballot.submittedAt });
}));

// ----- Admin API -----
router.post('/api/v1/admin/elections', requireAdmin, withData(async (req, res, _next, data) => {
  const { title, positionType, seats, startAt, endAt } = req.body;
  if (!title || !positionType || !seats || !startAt || !endAt) return res.status(400).json({ message: 'missing required fields' });
  if (!['elder', 'deacon'].includes(positionType)) return res.status(400).json({ message: 'positionType must be elder/deacon' });
  if (Number(seats) <= 0) return res.status(400).json({ message: 'seats must > 0' });
  if (new Date(startAt).getTime() >= new Date(endAt).getTime()) return res.status(400).json({ message: 'startAt must < endAt' });

  const election = { id: uuid(), title, positionType, seats: Number(seats), startAt, endAt, status: 'draft', createdAt: nowIso(), updatedAt: nowIso() };
  data.elections.push(election);
  audit(data, req, 'election.create', { electionId: election.id });
  await stateStore.write(data);
  return res.status(201).json(election);
}));

router.get('/api/v1/admin/elections', requireAdmin, withData(async (_req, res, _next, data) => {
  res.json(data.elections);
}));

router.post('/api/v1/admin/elections/:electionId/candidates', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  if (election.status !== 'draft') return res.status(400).json({ message: 'cannot change candidates after election starts' });

  const { name, bio = '', avatarUrl = '', sortOrder = 0, active = true } = req.body;
  if (!name) return res.status(400).json({ message: 'name required' });

  const candidate = { id: uuid(), electionId: election.id, name, bio, avatarUrl, sortOrder: Number(sortOrder), active: Boolean(active), createdAt: nowIso(), updatedAt: nowIso() };
  data.candidates.push(candidate);
  audit(data, req, 'candidate.create', { electionId: election.id, candidateId: candidate.id });
  await stateStore.write(data);
  res.status(201).json(candidate);
}));

router.get('/api/v1/admin/elections/:electionId/candidates', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  res.json(data.candidates.filter((row) => row.electionId === election.id).sort((a, b) => a.sortOrder - b.sortOrder));
}));

router.post('/api/v1/admin/voters/import', requireAdmin, withData(async (req, res, _next, data) => {
  const { voters = [] } = req.body;
  if (!Array.isArray(voters) || voters.length === 0) return res.status(400).json({ message: 'voters must be non-empty array' });

  const upserted = [];
  voters.forEach((row) => {
    if (!row.memberNo || !row.name) return;
    const existing = data.voters.find((voter) => voter.memberNo === row.memberNo);
    if (existing) {
      existing.name = row.name;
      existing.phone = row.phone || '';
      existing.email = row.email || '';
      existing.active = true;
      existing.updatedAt = nowIso();
      upserted.push(existing);
      return;
    }
    const entity = { id: uuid(), memberNo: row.memberNo, name: row.name, phone: row.phone || '', email: row.email || '', active: true, createdAt: nowIso(), updatedAt: nowIso() };
    data.voters.push(entity);
    upserted.push(entity);
  });

  audit(data, req, 'voter.import', { count: upserted.length });
  await stateStore.write(data);
  res.json({ count: upserted.length, voters: upserted });
}));

router.post('/api/v1/admin/tokens/generate', requireAdmin, withData(async (req, res, _next, data) => {
  const { electionId } = req.body;
  const election = getElectionById(data, electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  if (election.status !== 'draft') return res.status(400).json({ message: 'generate tokens only in draft stage' });

  data.votingTokens.forEach((tokenRow) => {
    if (tokenRow.electionId === election.id && !tokenRow.usedAt && !tokenRow.revokedAt) tokenRow.revokedAt = nowIso();
  });

  const generated = [];
  data.voters.filter((voter) => voter.active).forEach((voter) => {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const record = {
      id: uuid(), electionId: election.id, voterId: voter.id, tokenHash: sha256(rawToken),
      issuedAt: nowIso(), expiresAt: election.endAt, usedAt: null, revokedAt: null,
    };
    data.votingTokens.push(record);
    generated.push({ ...sanitizeTokenRecord(record), token: rawToken, qrLink: `/church-vote?voteToken=${rawToken}`, voterName: voter.name, memberNo: voter.memberNo });
  });

  audit(data, req, 'token.generate', { electionId: election.id, count: generated.length });
  await stateStore.write(data);
  res.json({ count: generated.length, tokens: generated });
}));

router.get('/api/v1/admin/elections/:electionId/tokens', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  res.json(data.votingTokens.filter((row) => row.electionId === election.id).map((row) => sanitizeTokenRecord(row)));
}));

router.post('/api/v1/admin/tokens/:tokenId/revoke', requireAdmin, withData(async (req, res, _next, data) => {
  const row = data.votingTokens.find((tokenRow) => tokenRow.id === req.params.tokenId);
  if (!row) return res.status(404).json({ message: 'token not found' });
  if (row.usedAt) return res.status(400).json({ message: 'used token cannot be revoked' });
  row.revokedAt = nowIso();
  audit(data, req, 'token.revoke', { tokenId: row.id, electionId: row.electionId });
  await stateStore.write(data);
  res.json(sanitizeTokenRecord(row));
}));

router.post('/api/v1/admin/elections/:electionId/start', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  if (election.status === 'ended') return res.status(400).json({ message: 'election already ended' });

  election.status = 'active';
  election.updatedAt = nowIso();
  audit(data, req, 'election.start', { electionId: election.id });
  await stateStore.write(data);
  res.json(election);
}));

router.post('/api/v1/admin/elections/:electionId/end', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  election.status = 'ended';
  election.endAt = nowIso();
  election.updatedAt = nowIso();
  audit(data, req, 'election.end', { electionId: election.id });
  await stateStore.write(data);
  res.json(election);
}));

router.get('/api/v1/admin/elections/:electionId/results', requireAdmin, withData(async (req, res, _next, data) => {
  const election = getElectionById(data, req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });

  const resultMap = new Map();
  data.candidates.filter((candidate) => candidate.electionId === election.id).forEach((candidate) => {
    resultMap.set(candidate.id, { candidateId: candidate.id, candidateName: candidate.name, votes: 0 });
  });

  data.ballots.filter((ballot) => ballot.electionId === election.id).forEach((ballot) => {
    ballot.selectedCandidateIds.forEach((candidateId) => {
      const tally = resultMap.get(candidateId);
      if (tally) tally.votes += 1;
    });
  });

  res.json({ electionId: election.id, electionStatus: election.status, totalBallots: data.ballots.filter((ballot) => ballot.electionId === election.id).length, candidateTallies: [...resultMap.values()].sort((a, b) => b.votes - a.votes) });
}));

router.get('/api/v1/admin/audit-logs', requireAdmin, withData(async (_req, res, _next, data) => {
  res.json(data.auditLogs.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
}));

router.get('/admin', (_req, res) => {
  res.sendFile('church-vote-admin.html', { root: 'api/public' });
});

router.get('/', (_req, res) => {
  res.sendFile('church-vote-voter.html', { root: 'api/public' });
});

export default router;
