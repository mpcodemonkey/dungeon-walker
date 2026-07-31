import 'dotenv/config';
import express from 'express';
import { env } from './lib/env';
import { authRouter } from './routes/auth';
import { meRouter } from './routes/me';
import { activityRouter } from './routes/activity';
import { encountersRouter } from './routes/encounters';
import { tilesRouter } from './routes/tiles';

const app = express();

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRouter);
app.use('/me', meRouter);
app.use('/activity', activityRouter);
app.use('/encounters', encountersRouter);
app.use('/tiles', tilesRouter);

app.listen(env.port, () => {
  console.log(`Dungeon Walker API listening on port ${env.port}`);
});
