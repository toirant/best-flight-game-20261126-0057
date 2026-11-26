// Kestrel Courier — the entrypoint for make.fun's best flight game bounty.
// Node 22, standard library only. It hands the game in: it copies the
// playable static files (game/) and the screenshots (screenshots/) from
// beside this file into the output directory, then writes the dossier the
// judge reads, built from those exact files with the vendored make.fun
// library (vendor/makefun-game.ts, copied from the kit unchanged).
//
// The grader runs this twice and compares the outputs, so everything here
// is deterministic: same files in, same files out. Outside the grader,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory itself is never removed: the grader mounts it and
// deleting it would fail the run. Only its known contents are refreshed.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps, from the competition's own gate: game/ holds at most
// 993 files and directories and 48 MiB, screenshots/ at most 4 files of
// 256 KiB each, and the dossier text at most 160 KiB.
const DOSSIER_OPTIONS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function refreshDir(source, target) {
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true, force: true });
}

function main() {
  mkdirSync(outDir, { recursive: true });

  // Refresh game/ and screenshots/ in place; stale files from an earlier
  // run of this program in the same directory are cleared first so the
  // output holds exactly what the repository holds.
  for (const dir of ['game', 'screenshots']) {
    const target = join(outDir, dir);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  refreshDir(join(repoRoot, 'game'), join(outDir, 'game'));
  if (existsSync(join(repoRoot, 'screenshots'))) {
    refreshDir(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));
  } else {
    mkdirSync(join(outDir, 'screenshots'), { recursive: true });
  }

  const dossier = buildDossier(outDir, DOSSIER_OPTIONS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  console.log(`Kestrel Courier handed in to ${outDir} (dossier ${dossier.length} bytes)`);
}

main();
