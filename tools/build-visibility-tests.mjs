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
const outputDir = join(root, "diagnostics", "generated-visibility");
const instructionsPath = join(
  root,
  "diagnostics",
  "visibility-isolation",
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
const CACHE_MARKER =
  "/* Four mixed treasure clusters reward exploration beyond the main roads. */";

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `missing ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `duplicate ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function commandBlocks(source, command) {
  const blocks = [];
  const pattern = new RegExp(`^[ \\t]*${command}\\b([^\\n{]*)\\{`, "gm");
  let match;

  while ((match = pattern.exec(source)) !== null) {
    const open = source.indexOf("{", match.index);
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === "{") depth += 1;
      if (source[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    assert.equal(depth, 0, `unclosed ${command} block at ${match.index}`);
    const close = cursor - 1;
    if (source[cursor] === "\r") cursor += 1;
    if (source[cursor] === "\n") cursor += 1;
    blocks.push({
      start: match.index,
      end: cursor,
      argument: match[1].trim(),
      body: source.slice(open + 1, close),
    });
    pattern.lastIndex = cursor;
  }

  return blocks;
}

function removeBlocks(source, command, predicate) {
  const matches = commandBlocks(source, command).filter(predicate);
  let result = source;
  for (const block of matches.reverse()) {
    result = `${result.slice(0, block.start)}${result.slice(block.end)}`;
  }
  return result;
}

function insertBefore(source, marker, addition) {
  return replaceOnce(source, marker, `${addition.trimEnd()}\n\n${marker}`, marker);
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
    Failed control: R01, derived from v1.0.2.
    Visibility test: ${title}.
*/
`,
    "compatibility header",
  );
  return result;
}

function withoutFlowerPatches(source) {
  let result = replaceOnce(source, FLOWER_ALIAS, "", "FLOWER_GROUND alias");
  result = replaceOnce(result, FLOWER_BLOCK, "", "FLOWER_GROUND block");
  return result;
}

function withoutCacheObjects(source) {
  let result = removeBlocks(
    source,
    "create_object_group",
    (block) => block.argument === "CACHE_TREASURE",
  );
  result = removeBlocks(
    result,
    "create_object",
    (block) => block.argument === "CACHE_TREASURE",
  );
  return result;
}

function withoutCrownObjects(source, keep = new Set()) {
  return removeBlocks(
    source,
    "create_object",
    (block) =>
      block.body.includes("place_on_specific_land_id CROWN_LAND_ID") &&
      !keep.has(block.argument),
  );
}

function withoutNeutralObjects(source) {
  return withoutCrownObjects(withoutCacheObjects(source));
}

function playerLandsOnly(source) {
  let result = withoutNeutralObjects(source);
  result = removeBlocks(
    result,
    "create_land",
    (block) =>
      block.body.includes("land_id CROWN_LAND_ID") ||
      block.body.includes("land_id CACHE_LAND_"),
  );
  result = removeBlocks(result, "create_connect_land_zones", () => true);
  return result;
}

function barePlayerStarts(source) {
  let result = playerLandsOnly(source);
  result = removeBlocks(
    result,
    "create_object_group",
    (block) => block.argument === "START_HERDABLE",
  );
  result = removeBlocks(
    result,
    "create_object",
    (block) =>
      !new Set(["TOWN_CENTER", "VILLAGER", "SCOUT", "CASTLE", "KING"]).has(
        block.argument,
      ),
  );
  return result;
}

function fixedGoldCaches(source) {
  return insertBefore(
    withoutNeutralObjects(source),
    CACHE_MARKER,
    `/* Diagnostic cache control: ordinary gold without create_object_group. */
create_object GOLD {
    number_of_objects 4
    number_of_groups 4
    group_placement_radius 2
    set_tight_grouping
    set_gaia_object_only
    terrain_to_place_on CACHE_GROUND
    temp_min_distance_group_placement 16
}`,
  );
}

const base = withoutFlowerPatches(baseline);
const variants = [
  {
    id: "V00",
    title: "Bare Player Starts",
    build: barePlayerStarts,
    expected: {
      crownObjects: 0,
      cacheObjects: 0,
      cacheGroups: 0,
      startGroups: 0,
      crownLands: 0,
      cacheLands: 0,
      crownConnections: 0,
    },
  },
  {
    id: "V01",
    title: "Player Lands Only",
    build: playerLandsOnly,
    expected: {
      crownObjects: 0,
      cacheObjects: 0,
      cacheGroups: 0,
      crownLands: 0,
      cacheLands: 0,
      crownConnections: 0,
    },
  },
  {
    id: "V02",
    title: "Empty Neutral Lands",
    build: withoutNeutralObjects,
    expected: { crownObjects: 0, cacheObjects: 0, cacheGroups: 0 },
  },
  {
    id: "V03",
    title: "Crown Resources Only",
    build: withoutCacheObjects,
    expected: { crownObjects: 3, cacheObjects: 0, cacheGroups: 0 },
  },
  {
    id: "V04",
    title: "Randomized Caches Only",
    build: withoutCrownObjects,
    expected: { crownObjects: 0, cacheObjects: 1, cacheGroups: 1 },
  },
  {
    id: "V05",
    title: "Crown Gold Only",
    build: (source) => withoutCrownObjects(withoutCacheObjects(source), new Set(["GOLD"])),
    expected: { crownObjects: 1, cacheObjects: 0, cacheGroups: 0 },
  },
  {
    id: "V06",
    title: "Crown Stone Only",
    build: (source) => withoutCrownObjects(withoutCacheObjects(source), new Set(["STONE"])),
    expected: { crownObjects: 1, cacheObjects: 0, cacheGroups: 0 },
  },
  {
    id: "V07",
    title: "Crown Relics Only",
    build: (source) => withoutCrownObjects(withoutCacheObjects(source), new Set(["RELIC"])),
    expected: { crownObjects: 1, cacheObjects: 0, cacheGroups: 0 },
  },
  {
    id: "V08",
    title: "Fixed Gold Caches",
    build: fixedGoldCaches,
    expected: { crownObjects: 0, cacheObjects: 1, cacheGroups: 0 },
  },
];

function measurements(source) {
  const objectBlocks = commandBlocks(source, "create_object");
  const landBlocks = commandBlocks(source, "create_land");
  return {
    crownObjects: objectBlocks.filter((block) =>
      block.body.includes("place_on_specific_land_id CROWN_LAND_ID"),
    ).length,
    cacheObjects: objectBlocks.filter((block) =>
      block.body.includes("terrain_to_place_on CACHE_GROUND"),
    ).length,
    cacheGroups: commandBlocks(source, "create_object_group").filter(
      (block) => block.argument === "CACHE_TREASURE",
    ).length,
    startGroups: commandBlocks(source, "create_object_group").filter(
      (block) => block.argument === "START_HERDABLE",
    ).length,
    crownLands: landBlocks.filter((block) =>
      block.body.includes("land_id CROWN_LAND_ID"),
    ).length,
    cacheLands: landBlocks.filter((block) =>
      block.body.includes("land_id CACHE_LAND_"),
    ).length,
    crownConnections: commandBlocks(source, "create_connect_land_zones").length,
  };
}

const defaults = {
  crownObjects: 3,
  cacheObjects: 1,
  cacheGroups: 1,
  startGroups: 1,
  crownLands: 1,
  cacheLands: 4,
  crownConnections: 1,
};

mkdirSync(outputDir, { recursive: true });
const expectedFiles = [];

for (const variant of variants) {
  const fileName = `Crown Ash ${variant.id} ${variant.title}.rms`;
  const source = diagnosticHeader(variant.build(base), variant.id, variant.title);
  const actual = measurements(source);

  assert.notEqual(source, baseline, `${variant.id} did not change the baseline`);
  assert.doesNotMatch(source, /\bFLOWER_GROUND\b/, `${variant.id} diverged from R01`);
  for (const [measurement, defaultValue] of Object.entries(defaults)) {
    assert.equal(
      actual[measurement],
      variant.expected[measurement] ?? defaultValue,
      `${variant.id} ${measurement} count`,
    );
  }

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

console.log(`PASS ${variants.length} visibility isolation variants`);
