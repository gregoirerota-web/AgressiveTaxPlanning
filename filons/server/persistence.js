import pg from "pg";

const { Pool } = pg;

export function normalizeRoom(room) {
  return {
    ...room,
    players: room.players.map(p => ({
      ...p, connected: false, socketId: null, ready: p.ready
    }))
  };
}

export function createRoomStore(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    return {
      enabled: false,
      async initialize() {},
      async loadAll() { return []; },
      async save() {},
      async delete() {},
      async close() {}
    };
  }

  const pool = new Pool({
    connectionString,
    max: 3,
    connectionTimeoutMillis: 10000,
    ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: true }
  });

  return {
    enabled: true,
    async initialize() {
      await pool.query(`CREATE TABLE IF NOT EXISTS filons_rooms (
        code varchar(6) PRIMARY KEY,
        snapshot jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    },
    async loadAll() {
      const { rows } = await pool.query("SELECT snapshot FROM filons_rooms");
      return rows.map(({ snapshot }) => normalizeRoom(snapshot));
    },
    async save(room) {
      const snapshot = normalizeRoom(room);
      await pool.query(
        `INSERT INTO filons_rooms (code, snapshot, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (code) DO UPDATE
         SET snapshot=excluded.snapshot, updated_at=now()`,
        [room.code, JSON.stringify(snapshot)]
      );
    },
    async delete(code) {
      await pool.query("DELETE FROM filons_rooms WHERE code=$1", [code]);
    },
    async close() { await pool.end(); }
  };
}
