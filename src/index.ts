import type { Pool } from 'pg';
import type { Api } from './lib/api.ts';
import type { Credentials, Registration, Role } from './lib/contracts.ts';
import { createHash, timingSafeEqual } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ApiError, conflict } from './lib/api.ts';
import { env } from './lib/config.ts';
import { transaction } from './lib/db.ts';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

function digest(password: string) {
  return createHash('md5').update(password).digest('hex');
}

export async function seed(pool: Pool) {
  await transaction(pool, async (client) => {
    for (const [name, email, role] of [
      ['Organizador local', 'organizador@example.test', 'organizador'],
      ['Portero local', 'portero@example.test', 'portero'],
    ]) {
      await client.query(
        'INSERT INTO users (name, email, password_digest, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
        [name, email, digest('demo-entradasya'), role],
      );
      const { rows: [account] } = await client.query<Pick<User, 'role'>>(
        'SELECT role FROM users WHERE email = $1', [email],
      );
      if (account.role !== role) throw new Error(`La cuenta ficticia ${email} tiene otro rol.`);
    }
  });
}

export function mount(api: Api, { pool }: { pool: Pool }) {
  api.route<Registration>('register', {}, async (req, res) => {
    const { name, email, password } = req.body;
    const result = await pool.query<User>(
      `INSERT INTO users (name, email, password_digest, role)
       VALUES ($1, $2, $3, 'cliente') ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role`,
      [name, email.toLowerCase(), digest(password)],
    );
    if (result.rowCount === 0) throw conflict('EMAIL_IN_USE', 'El correo ya está registrado.');
    res.status(201).json(result.rows[0]);
  });

  api.route<Credentials>('login', {}, async (req, res) => {
    const { email, password } = req.body;
    const { rows: [record] } = await pool.query<User & { password_digest: string }>(
      'SELECT id, name, email, role, password_digest FROM users WHERE email = $1', [email.toLowerCase()],
    );
    if (!record || !timingSafeEqual(Buffer.from(record.password_digest), Buffer.from(digest(password)))) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Credenciales incorrectas.');
    }
    const { id, name, role } = record;
    const token = jwt.sign({ role }, env('JWT_SECRET'), { subject: id, expiresIn: '1h', algorithm: 'HS256' });
    res.json({ token, user: { id, name, email: record.email, role } });
  });
}
