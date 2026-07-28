import 'dotenv/config';
import express from 'express';
import { env } from './lib/env';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/me', meRouter);

app.listen(env.port, () => {
  console.log(`Dungeon Walker API listening on port ${env.port}`);
});
