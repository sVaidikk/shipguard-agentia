// ALL calls into Copado Agentia CLI live in this single file.
// The Agentia Headless CLI is in beta: if a command name or flag changes,
// this is the only file you need to update. Verify names at developer.copado.com.
import { spawnSync } from 'node:child_process';

export function agentiaAvailable() {
  const r = spawnSync('agentia', ['--version'], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Run `agentia <args> --json` and parse the result (returns null if unavailable). */
export function agentiaJson(args) {
  const r = spawnSync('agentia', [...args, '--json'], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

/** Attach the ShipGuard summary to a Copado user story (command name: verify in docs). */
export function attachToUserStory(userStory, note) {
  return agentiaJson(['cicd', 'work', 'update', '--user-story', userStory, '--note', note]);
}

/** Run an arbitrary command (used by `shipguard gate`), inheriting stdio. */
export function runCommand(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  return r.status ?? 1;
}
