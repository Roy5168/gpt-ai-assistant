import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

const emptyData = () => ({
  elections: [],
  candidates: [],
  voters: [],
  votingTokens: [],
  ballots: [],
  auditLogs: [],
  adminSessions: [],
});

class FileStateStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  ensureFile() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, JSON.stringify(emptyData(), null, 2));
    }
  }

  async read() {
    this.ensureFile();
    try {
      const text = fs.readFileSync(this.filePath, 'utf8');
      return { ...emptyData(), ...JSON.parse(text) };
    } catch {
      return emptyData();
    }
  }

  async write(data) {
    this.ensureFile();
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }
}

class PgStateStore {
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.pool = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;
    if (!this.pool) {
      const pgModule = await import('pg');
      const { Pool } = pgModule;
      this.pool = new Pool({ connectionString: this.connectionString });
    }
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS church_vote_state (
        id SMALLINT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(
      `INSERT INTO church_vote_state (id, payload)
       VALUES (1, $1::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [JSON.stringify(emptyData())],
    );
    this.ready = true;
  }

  async read() {
    await this.init();
    const { rows } = await this.pool.query('SELECT payload FROM church_vote_state WHERE id = 1');
    return { ...emptyData(), ...(rows[0]?.payload || {}) };
  }

  async write(data) {
    await this.init();
    await this.pool.query(
      'UPDATE church_vote_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1',
      [JSON.stringify(data)],
    );
  }
}

const stateStore = config.CHURCH_VOTE_DB_URL
  ? new PgStateStore(config.CHURCH_VOTE_DB_URL)
  : new FileStateStore(config.CHURCH_VOTE_DATA_FILE || 'storage/church-vote.json');

export default stateStore;
export { emptyData };
