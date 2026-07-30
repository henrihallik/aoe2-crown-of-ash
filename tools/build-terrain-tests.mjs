#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const baselinePath = join(
  root,
  "Crown of Ash",
  "resources",
  "_common",
  "random-map-scripts",
  "Crown of Ash.rms",
);
const outputDir = join(root, "diagnostics", "generated-terrain");
const instructionsPath = join(
  root,
  "diagnostics",
  "terrain-isolation",
  "TEST-INSTRUCTIONS.txt",
);

const baseline = readFileSync(baselinePath, "utf8");
assert.match(baseline, /Crown of Ash v1\.0\.2/, "tests require the v1.0.2 baseline");

const FLOWER_ALIAS = "#const FLOWER_GROUND 122\n";
const FLOWER_BLOCK = `/* Small flowered patches add readable visual texture away from each TC. */
create_terrain FLOWER_GROUND {
    base_terrain START_GROUND
    land_percent 6
    number_of_clumps 3
    clumping_factor 12
    set_scale_by_size
    set_avoid_player_start_areas 8
}
`;

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `missing ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `duplicate ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function diagnosticHeader(source, id, title) {
  let result = replaceOnce(
    source,
    "Crown of Ash v1.0.2",
    `Crown of Ash diagnostic ${id}: ${title}`,
    "version header",
  );
  result = replaceOnce(
    result,
    "/* Compatibility: Definitive Edition */\n",
    `/* Compatibility: Definitive Edition */
/*
    DIAGNOSTIC VARIANT ONLY.
    Known-crashing base: v1.0.2.
    Terrain test: ${title}.
*/
`,
    "compatibility header",
  );
  return result;
}

const variants = [
  {
    id: "R01",
    title: "No Unused Terrain 122",
    build(source) {
      let result = replaceOnce(source, FLOWER_ALIAS, "", "FLOWER_GROUND alias");
      result = replaceOnce(result, FLOWER_BLOCK, "", "FLOWER_GROUND block");
      return result;
    },
    expectedPatchCount: 0,
    expectedTerrain122Count: 0,
    expectedTerrain41Count: 0,
  },
  {
    id: "R02",
    title: "Valid Savannah Patches",
    build(source) {
      return replaceOnce(
        source,
        FLOWER_ALIAS,
        "#const FLOWER_GROUND 41\n",
        "FLOWER_GROUND alias",
      );
    },
    expectedPatchCount: 1,
    expectedTerrain122Count: 0,
    expectedTerrain41Count: 1,
  },
];

mkdirSync(outputDir, { recursive: true });
const expectedFiles = [];

for (const variant of variants) {
  const fileName = `Crown Ash ${variant.id} ${variant.title}.rms`;
  const source = diagnosticHeader(variant.build(baseline), variant.id, variant.title);

  assert.notEqual(source, baseline, `${variant.id} did not change the baseline`);
  assert.equal(
    [...source.matchAll(/\bcreate_terrain\s+FLOWER_GROUND\b/g)].length,
    variant.expectedPatchCount,
    `${variant.id} has the wrong FLOWER_GROUND block count`,
  );
  assert.equal(
    [...source.matchAll(/#const\s+FLOWER_GROUND\s+122\b/g)].length,
    variant.expectedTerrain122Count,
    `${variant.id} still contains unused terrain 122`,
  );
  assert.equal(
    [...source.matchAll(/#const\s+FLOWER_GROUND\s+41\b/g)].length,
    variant.expectedTerrain41Count,
    `${variant.id} has the wrong Savannah alias count`,
  );
  assert.equal(
    [...source.matchAll(/\bplace_on_specific_land_id\s+CROWN_LAND_ID\b/g)].length,
    3,
    `${variant.id} unexpectedly changed the Crown resources`,
  );

  const outputPath = join(outputDir, fileName);
  writeFileSync(outputPath, source);
  expectedFiles.push(fileName);
  console.log(`Built ${outputPath}`);
}

copyFileSync(instructionsPath, join(outputDir, "TEST-INSTRUCTIONS.txt"));
expectedFiles.push("TEST-INSTRUCTIONS.txt");

assert.deepEqual(
  readdirSync(outputDir).sort(),
  expectedFiles.sort(),
  `${outputDir} contains stale or missing files`,
);

console.log(`PASS ${variants.length} terrain isolation variants`);
