import { loadConfig } from '../config';
import { Database } from './db';
import { runMigrations } from './migrate';

async function main() {
  const db = new Database(loadConfig());
  await runMigrations(db.primaryPool);
  await db.close();
  console.log('migrations applied');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
