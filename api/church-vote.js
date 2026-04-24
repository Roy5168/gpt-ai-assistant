import crypto from 'crypto';
import express from 'express';
import config from '../config/index.js';

const router = express.Router();

const store = {
  elections: new Map(),
  candidates: new Map(),
  voters: new Map(),
  tokens: new Map(),
  ballots: [],
};

const nowIso = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const adminKey = config.CHURCH_VOTE_ADMIN_KEY || 'church-admin-change-me';

const requireAdmin = (req, res, next) => {
  if (req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ message: 'Unauthorized admin key' });
  }
  return next();
};

const isElectionActive = (election) => {
  const now = Date.now();
  return election.status === 'active'
    && now >= new Date(election.startAt).getTime()
    && now <= new Date(election.endAt).getTime();
};

const toPublicToken = ({ id, electionId, voterId, issuedAt, usedAt, revokedAt, expiresAt }) => ({
  id,
  electionId,
  voterId,
  issuedAt,
  usedAt,
  revokedAt,
  expiresAt,
});

// ----- Voter APIs -----
router.post('/api/v1/voter/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: 'token required' });

  const tokenHash = sha256(token);
  const tokenRecord = store.tokens.get(tokenHash);

  if (!tokenRecord) return res.status(400).json({ message: 'invalid token' });
  if (tokenRecord.revokedAt) return res.status(400).json({ message: 'token revoked' });
  if (tokenRecord.usedAt) return res.status(400).json({ message: 'token already used' });
  if (Date.now() > new Date(tokenRecord.expiresAt).getTime()) return res.status(400).json({ message: 'token expired' });

  const election = store.elections.get(tokenRecord.electionId);
  if (!election) return res.status(400).json({ message: 'election not found' });
  if (!isElectionActive(election)) return res.status(400).json({ message: 'election is not active' });

  const candidates = [...store.candidates.values()]
    .filter((candidate) => candidate.electionId === election.id && candidate.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return res.json({
    voteSessionToken: token,
    election,
    candidates,
  });
});

router.post('/api/v1/voter/ballots', (req, res) => {
  const { voteSessionToken, selectedCandidateIds = [] } = req.body;

  if (!voteSessionToken) return res.status(400).json({ message: 'voteSessionToken required' });
  if (!Array.isArray(selectedCandidateIds)) return res.status(400).json({ message: 'selectedCandidateIds must be array' });

  const tokenHash = sha256(voteSessionToken);
  const tokenRecord = store.tokens.get(tokenHash);

  if (!tokenRecord) return res.status(400).json({ message: 'invalid token' });
  if (tokenRecord.usedAt) return res.status(400).json({ message: 'token already used' });
  if (tokenRecord.revokedAt) return res.status(400).json({ message: 'token revoked' });

  const election = store.elections.get(tokenRecord.electionId);
  if (!election || !isElectionActive(election)) return res.status(400).json({ message: 'election is not active' });

  const candidateList = [...store.candidates.values()]
    .filter((candidate) => candidate.electionId === election.id && candidate.active);
  const candidateIdSet = new Set(candidateList.map((candidate) => candidate.id));

  if (selectedCandidateIds.length > election.seats) {
    return res.status(400).json({ message: `over selection: seats=${election.seats}` });
  }

  const uniq = [...new Set(selectedCandidateIds)];
  if (uniq.some((candidateId) => !candidateIdSet.has(candidateId))) {
    return res.status(400).json({ message: 'contains invalid candidate id' });
  }

  const ballot = {
    id: uuid(),
    electionId: election.id,
    selectedCandidateIds: uniq,
    submittedAt: nowIso(),
  };

  store.ballots.push(ballot);
  tokenRecord.usedAt = nowIso();

  return res.status(201).json({
    ballotId: ballot.id,
    submittedAt: ballot.submittedAt,
  });
});

// ----- Admin APIs -----
router.post('/api/v1/admin/elections', requireAdmin, (req, res) => {
  const {
    title,
    positionType,
    seats,
    startAt,
    endAt,
  } = req.body;

  if (!title || !positionType || !seats || !startAt || !endAt) {
    return res.status(400).json({ message: 'missing required fields' });
  }

  const election = {
    id: uuid(),
    title,
    positionType,
    seats: Number(seats),
    startAt,
    endAt,
    status: 'draft',
    createdAt: nowIso(),
  };

  store.elections.set(election.id, election);
  return res.status(201).json(election);
});

router.get('/api/v1/admin/elections', requireAdmin, (req, res) => {
  res.json([...store.elections.values()]);
});

router.post('/api/v1/admin/elections/:electionId/candidates', requireAdmin, (req, res) => {
  const { electionId } = req.params;
  const election = store.elections.get(electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });

  const {
    name,
    bio = '',
    avatarUrl = '',
    sortOrder = 0,
    active = true,
  } = req.body;

  if (!name) return res.status(400).json({ message: 'name required' });

  const candidate = {
    id: uuid(),
    electionId,
    name,
    bio,
    avatarUrl,
    sortOrder,
    active,
  };

  store.candidates.set(candidate.id, candidate);
  res.status(201).json(candidate);
});

router.get('/api/v1/admin/elections/:electionId/candidates', requireAdmin, (req, res) => {
  const { electionId } = req.params;
  const candidates = [...store.candidates.values()]
    .filter((candidate) => candidate.electionId === electionId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  res.json(candidates);
});

router.post('/api/v1/admin/voters/import', requireAdmin, (req, res) => {
  const { voters = [] } = req.body;
  if (!Array.isArray(voters)) return res.status(400).json({ message: 'voters must be array' });

  const created = voters.map((voter) => {
    const entity = {
      id: uuid(),
      memberNo: voter.memberNo,
      name: voter.name,
      phone: voter.phone || '',
      email: voter.email || '',
      active: true,
    };
    store.voters.set(entity.id, entity);
    return entity;
  });

  res.json({ count: created.length, voters: created });
});

router.post('/api/v1/admin/tokens/generate', requireAdmin, (req, res) => {
  const { electionId } = req.body;
  const election = store.elections.get(electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });

  const tokens = [...store.voters.values()]
    .filter((voter) => voter.active)
    .map((voter) => {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = sha256(rawToken);
      const record = {
        id: uuid(),
        electionId,
        voterId: voter.id,
        issuedAt: nowIso(),
        expiresAt: election.endAt,
        usedAt: null,
        revokedAt: null,
      };
      store.tokens.set(tokenHash, record);
      return {
        ...toPublicToken(record),
        token: rawToken,
        qrLink: `/church-vote?voteToken=${rawToken}`,
        voter,
      };
    });

  res.json({ count: tokens.length, tokens });
});

router.post('/api/v1/admin/elections/:electionId/start', requireAdmin, (req, res) => {
  const election = store.elections.get(req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  election.status = 'active';
  res.json(election);
});

router.post('/api/v1/admin/elections/:electionId/end', requireAdmin, (req, res) => {
  const election = store.elections.get(req.params.electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });
  election.status = 'ended';
  election.endAt = nowIso();
  res.json(election);
});

router.get('/api/v1/admin/elections/:electionId/results', requireAdmin, (req, res) => {
  const { electionId } = req.params;
  const election = store.elections.get(electionId);
  if (!election) return res.status(404).json({ message: 'election not found' });

  const resultMap = new Map();
  [...store.candidates.values()]
    .filter((candidate) => candidate.electionId === electionId)
    .forEach((candidate) => {
      resultMap.set(candidate.id, { candidateId: candidate.id, candidateName: candidate.name, votes: 0 });
    });

  const ballots = store.ballots.filter((ballot) => ballot.electionId === electionId);
  ballots.forEach((ballot) => {
    ballot.selectedCandidateIds.forEach((candidateId) => {
      const row = resultMap.get(candidateId);
      if (row) row.votes += 1;
    });
  });

  res.json({
    electionId,
    totalBallots: ballots.length,
    candidateTallies: [...resultMap.values()].sort((a, b) => b.votes - a.votes),
  });
});

router.get('/admin', (req, res) => {
  res.sendFile('church-vote-admin.html', { root: 'api/public' });
});

router.get('/', (req, res) => {
  res.sendFile('church-vote-voter.html', { root: 'api/public' });
});

export default router;
