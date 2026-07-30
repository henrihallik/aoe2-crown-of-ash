#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rmsPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(
      here,
      "../Crown of Ash/resources/_common/random-map-scripts/Crown of Ash.rms",
    );
const source = readFileSync(rmsPath, "utf8");

function stripComments(input) {
  let depth = 0;
  let output = "";

  for (let index = 0; index < input.length; index += 1) {
    const pair = input.slice(index, index + 2);
    if (pair === "/*") {
      depth += 1;
      output += "  ";
      index += 1;
    } else if (pair === "*/") {
      assert.ok(depth > 0, `stray comment terminator at offset ${index}`);
      depth -= 1;
      output += "  ";
      index += 1;
    } else {
      output += depth === 0 ? input[index] : input[index] === "\n" ? "\n" : " ";
    }
  }

  assert.equal(depth, 0, "unclosed block comment");
  return output;
}

function blocksFor(command, text, hasName = true) {
  const blocks = [];
  const pattern = hasName
    ? new RegExp(`\\b${command}\\s+([^\\s{}]+)\\s*\\{`, "g")
    : new RegExp(`\\b${command}\\s*\\{`, "g");
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const open = text.indexOf("{", match.index);
    let depth = 1;
    let cursor = open + 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "{") depth += 1;
      if (text[cursor] === "}") depth -= 1;
      cursor += 1;
    }
    assert.equal(depth, 0, `unclosed ${command} ${match[1]} block`);
    blocks.push({
      name: hasName ? match[1] : command,
      body: text.slice(open + 1, cursor - 1),
    });
    pattern.lastIndex = cursor;
  }
  return blocks;
}

function valuesFor(attribute, text) {
  return [
    ...text.matchAll(new RegExp(`\\b${attribute}\\s+([^\\s{}]+)`, "g")),
  ].map((match) => match[1]);
}

function countFor(name, blocks) {
  return blocks
    .filter((block) => block.name === name)
    .reduce((total, block) => {
      const value = valuesFor("number_of_objects", block.body)[0];
      return total + (value === undefined ? 0 : Number(value));
    }, 0);
}

const code = stripComments(source);

assert.ok(!code.includes("//"), "RMS does not support // comments");
assert.ok(!code.includes("#include"), "custom includes do not transfer in lobbies");

const braces = [...code].reduce((depth, character) => {
  const next = depth + (character === "{" ? 1 : character === "}" ? -1 : 0);
  assert.ok(next >= 0, "closing brace appears before an opening brace");
  return next;
}, 0);
assert.equal(braces, 0, "unbalanced braces");

const controlStack = [];
for (const match of code.matchAll(/\b(start_random|end_random|if|elseif|else|endif)\b/g)) {
  const token = match[1];
  if (token === "start_random" || token === "if") {
    controlStack.push(token);
  } else if (token === "end_random") {
    assert.equal(controlStack.pop(), "start_random", "end_random closes the wrong construct");
  } else if (token === "endif") {
    assert.equal(controlStack.pop(), "if", "endif closes the wrong construct");
  } else {
    assert.equal(controlStack.at(-1), "if", `${token} appears outside an if block`);
  }
}
assert.deepEqual(controlStack, [], "unclosed conditional or random block");

const actualSections = [...code.matchAll(/<([A-Z_]+)>/g)].map((match) => match[1]);
if (/\bbase_elevation\b/.test(code)) {
  assert.ok(
    actualSections.includes("ELEVATION_GENERATION"),
    "base_elevation requires an <ELEVATION_GENERATION> section",
  );
}
const expectedSections = [
  "PLAYER_SETUP",
  "LAND_GENERATION",
  "ELEVATION_GENERATION",
  "TERRAIN_GENERATION",
  "CONNECTION_GENERATION",
  "OBJECTS_GENERATION",
];
assert.deepEqual(actualSections, expectedSections, "sections are missing or out of order");

const constants = new Map();
for (const match of code.matchAll(/#const\s+([A-Z0-9_]+)\s+(-?\d+)/g)) {
  assert.ok(!constants.has(match[1]), `duplicate custom constant ${match[1]}`);
  constants.set(match[1], Number(match[2]));
}
assert.ok(constants.size >= 19, "expected explicit terrain, object, and identifier aliases");
for (const [name, value] of [
  ["CROWN_MONUMENT", 826],
  ["WARDEN_WOLF", 126],
  ["WARDEN_DIRE_WOLF", 89],
  ["WARDEN_JAGUAR", 812],
  ["CENTER_BONFIRE", 304],
  ["CENTER_CRACKS", 241],
  ["CENTER_SKELETON", 710],
]) {
  assert.equal(constants.get(name), value, `${name} must use DE object ID ${value}`);
}

const objectGroups = blocksFor("create_object_group", code);
assert.deepEqual(
  objectGroups.map((group) => group.name).sort(),
  ["CACHE_TREASURE", "CROWN_WARDEN", "START_HERDABLE"],
  "object group definitions changed unexpectedly",
);
for (const group of objectGroups) {
  const weights = [...group.body.matchAll(/\badd_object\s+\S+\s+(\d+)/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(weights.length >= 2, `${group.name} needs at least two variants`);
  assert.equal(
    weights.reduce((sum, weight) => sum + weight, 0),
    100,
    `${group.name} weights must total 100`,
  );
}

const landBlocks = [
  ...blocksFor("create_player_lands", code, false),
  ...blocksFor("create_land", code, false),
];
const definedLandIds = new Set(
  landBlocks.flatMap((block) => valuesFor("land_id", block.body)),
);
const referencedLandIds = new Set(valuesFor("place_on_specific_land_id", code));
for (const landId of referencedLandIds) {
  assert.ok(definedLandIds.has(landId), `unknown land id ${landId}`);
}
assert.equal(
  landBlocks.filter((block) => /\bgenerate_mode\s+1\b/.test(block.body)).length,
  4,
  "exactly four freely placed ash caches are required",
);
assert.match(code, /\bcreate_connect_land_zones\s+1\s+2\s*\{/, "missing Crown roads");

const actorProviders = new Set(valuesFor("actor_area", code));
for (const consumer of [
  ...valuesFor("actor_area_to_place_in", code),
  ...valuesFor("avoid_actor_area", code),
]) {
  assert.ok(actorProviders.has(consumer), `actor area ${consumer} has no provider`);
}

const objects = blocksFor("create_object", code);
const playerScoped = objects.filter((block) =>
  /\bset_place_for_every_player\b/.test(block.body),
);
for (const block of playerScoped) {
  assert.match(
    block.body,
    /\bavoid_other_land_zones\s+3\b/,
    `${block.name} can leak outside its player's land zone`,
  );
}

for (const required of ["TOWN_CENTER", "VILLAGER", "SCOUT", "KING", "CASTLE"]) {
  assert.ok(
    objects.some((block) => block.name === required),
    `missing required ${required} placement`,
  );
}

assert.equal(countFor("START_HERDABLE", objects), 8, "each player needs 8 herdables");
assert.equal(countFor("FORAGE", objects), 6, "each player needs 6 forage bushes");
assert.equal(countFor("BOAR", objects), 2, "each player needs 2 lureables");
assert.equal(countFor("DEER", objects), 4, "each player needs 4 deer");
assert.equal(countFor("START_PINE", objects), 5, "each player needs 5 straggler trees");
assert.equal(countFor("GOLD", playerScoped), 11, "each player needs 7+4 gold");
assert.equal(countFor("STONE", playerScoped), 5, "each player needs 5 stone");

assert.match(
  code,
  /\bguard_state\s+CROWN_MONUMENT\s+AMOUNT_GOLD\s+40\s+2\b/,
  "the Crown must grant 24 gold per minute while controlled",
);
assert.equal(
  [...code.matchAll(/\bguard_state\b/g)].length,
  1,
  "only one guard_state may be active",
);

const monument = objects.find((block) => block.name === "CROWN_MONUMENT");
assert.ok(monument, "missing capturable Crown Monument");
for (const attribute of [
  "set_gaia_object_only",
  "set_building_capturable",
  "make_indestructible",
  "ignore_terrain_restrictions",
  "find_closest_to_map_center",
]) {
  assert.match(
    monument.body,
    new RegExp(`\\b${attribute}\\b`),
    `Crown Monument is missing ${attribute}`,
  );
}
assert.match(
  monument.body,
  /\bactor_area\s+CROWN_MONUMENT_AREA\b/,
  "Crown Monument must provide its exclusion area",
);

const crownObjects = objects.filter((block) =>
  /\bplace_on_specific_land_id\s+CROWN_LAND_ID\b/.test(block.body),
);
assert.equal(countFor("GOLD", crownObjects), 10, "the Crown needs 10 gold mines");
assert.equal(countFor("STONE", crownObjects), 8, "the Crown needs 8 stone mines");
assert.equal(countFor("RELIC", crownObjects), 5, "the Crown needs 5 relics");

const crownGold = crownObjects.find((block) => block.name === "GOLD");
const crownStone = crownObjects.find((block) => block.name === "STONE");
assert.match(
  crownGold?.body ?? "",
  /\bresource_delta\s+200\b/,
  "Crown gold needs its +200 resource bonus",
);
assert.match(
  crownStone?.body ?? "",
  /\bresource_delta\s+150\b/,
  "Crown stone needs its +150 resource bonus",
);

const wardens = objects.filter((block) => block.name === "CROWN_WARDEN");
assert.equal(wardens.length, 2, "expected central and cache warden placements");
for (const warden of wardens) {
  assert.match(
    warden.body,
    /\bset_gaia_object_only\b[\s\S]*\bset_gaia_unconvertible\b/,
    "set_gaia_unconvertible must follow set_gaia_object_only",
  );
}
const centralWardens = wardens.find((block) =>
  /\bactor_area_to_place_in\s+CROWN_TREASURE_AREA\b/.test(block.body),
);
const cacheWardens = wardens.find((block) =>
  /\bterrain_to_place_on\s+CACHE_GROUND\b/.test(block.body),
);
assert.match(
  centralWardens?.body ?? "",
  /\bnumber_of_objects\s+7\b/,
  "the Crown needs seven wardens",
);
assert.match(
  cacheWardens?.body ?? "",
  /\bnumber_of_objects\s+1\b[\s\S]*\bnumber_of_groups\s+4\b/,
  "the four caches need one warden group each",
);

for (const [name, count] of [
  ["CENTER_BONFIRE", 4],
  ["CENTER_CRACKS", 6],
  ["CENTER_SKELETON", 5],
]) {
  assert.equal(countFor(name, crownObjects), count, `unexpected ${name} count`);
}

console.log(`PASS ${rmsPath}`);
console.log(`  ${source.split("\n").length} lines, ${source.length} bytes`);
console.log(`  ${landBlocks.length} land declarations`);
console.log(`  ${objects.length} object declarations`);
console.log(`  ${objectGroups.length} weighted object groups`);
console.log("  balanced starts: 8 herdables, 6 forage, 2 boar, 4 deer, 11 gold, 5 stone");
