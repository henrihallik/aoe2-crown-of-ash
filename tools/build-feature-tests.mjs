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
const outputDir = join(root, "diagnostics", "generated");
const instructionsPath = join(
  root,
  "diagnostics",
  "feature-isolation",
  "TEST-INSTRUCTIONS.txt",
);

const baseline = readFileSync(baselinePath, "utf8");
assert.match(baseline, /Crown of Ash v1\.0\.2/, "diagnostics require the stable v1.0.2 baseline");

const ALIAS_MARKER = "/* Stable identifiers used by placement constraints. */";
const PLAYER_SETUP_MARKER = "ai_info_map_type BLACK_FOREST 0 0 0\n";
const CACHE_GROUP_MARKER = "create_object_group CACHE_TREASURE {";
const CENTER_MARKER = "/* Central mines: valuable enough to matter, exposed enough to contest. */";
const CACHE_MARKER = "/* Four mixed treasure clusters reward exploration beyond the main roads. */";

function replaceOnce(source, needle, replacement, label = needle) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `missing marker: ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `duplicate marker: ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function insertBefore(source, marker, addition) {
  return replaceOnce(source, marker, `${addition.trimEnd()}\n\n${marker}`, marker);
}

function insertAfter(source, marker, addition) {
  return replaceOnce(source, marker, `${marker}${addition}`, marker);
}

function replaceAfter(source, marker, needle, replacement, label) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `missing section marker: ${marker}`);
  const targetIndex = source.indexOf(needle, markerIndex + marker.length);
  assert.notEqual(targetIndex, -1, `missing ${label}`);
  return `${source.slice(0, targetIndex)}${replacement}${source.slice(targetIndex + needle.length)}`;
}

function addAliases(source, aliases) {
  return insertBefore(source, ALIAS_MARKER, aliases);
}

function addMonument(source, attributes = []) {
  let result = addAliases(source, "#const TEST_CROWN_MONUMENT 826");
  const attributeLines = attributes.map((attribute) => `    ${attribute}\n`).join("");
  const block = `/* Diagnostic feature: Monument object. */
create_object TEST_CROWN_MONUMENT {
    place_on_specific_land_id CROWN_LAND_ID
    set_gaia_object_only
${attributeLines}    ignore_terrain_restrictions
    find_closest_to_map_center
}`;
  result = insertBefore(result, CENTER_MARKER, block);
  return result;
}

function addResourceDelta(source) {
  let result = replaceAfter(
    source,
    CENTER_MARKER,
    "    find_closest_to_map_center\n",
    "    find_closest_to_map_center\n    resource_delta 200\n",
    "central gold placement",
  );
  result = replaceAfter(
    result,
    CENTER_MARKER,
    `create_object STONE {
    number_of_objects 8
    number_of_groups 1
    group_placement_radius 10
    set_loose_grouping
    set_gaia_object_only
    place_on_specific_land_id CROWN_LAND_ID
`,
    `create_object STONE {
    number_of_objects 8
    number_of_groups 1
    group_placement_radius 10
    set_loose_grouping
    set_gaia_object_only
    place_on_specific_land_id CROWN_LAND_ID
    resource_delta 150
`,
    "central stone placement",
  );
  return result;
}

function addWardens(source, unconvertible) {
  let result = addAliases(
    source,
    `#const TEST_WARDEN_WOLF 126
#const TEST_WARDEN_DIRE_WOLF 89
#const TEST_WARDEN_JAGUAR 812
#const TEST_CROWN_TREASURE_AREA 9002`,
  );
  result = insertBefore(
    result,
    CACHE_GROUP_MARKER,
    `create_object_group TEST_CROWN_WARDEN {
    add_object TEST_WARDEN_WOLF 55
    add_object TEST_WARDEN_JAGUAR 30
    add_object TEST_WARDEN_DIRE_WOLF 15
}`,
  );
  result = replaceAfter(
    result,
    CENTER_MARKER,
    "    temp_min_distance_group_placement 2\n}",
    `    temp_min_distance_group_placement 2
    actor_area TEST_CROWN_TREASURE_AREA
    actor_area_radius 12
}`,
    "central gold actor area",
  );
  const gaiaFlag = unconvertible ? "    set_gaia_unconvertible\n" : "";
  result = insertBefore(
    result,
    CACHE_MARKER,
    `/* Diagnostic feature: exotic Gaia wardens. */
create_object TEST_CROWN_WARDEN {
    number_of_objects 7
    set_gaia_object_only
${gaiaFlag}    actor_area_to_place_in TEST_CROWN_TREASURE_AREA
    temp_min_distance_group_placement 2
}

create_object TEST_CROWN_WARDEN {
    number_of_objects 1
    number_of_groups 4
    set_gaia_object_only
${gaiaFlag}    terrain_to_place_on CACHE_GROUND
    temp_min_distance_group_placement 16
}`,
  );
  return result;
}

function addBonfire(source) {
  let result = addAliases(source, "#const TEST_CENTER_BONFIRE 304");
  result = insertBefore(
    result,
    CACHE_MARKER,
    `/* Diagnostic feature: animated Bonfire objects. */
create_object TEST_CENTER_BONFIRE {
    number_of_objects 4
    set_gaia_object_only
    place_on_specific_land_id CROWN_LAND_ID
    min_distance_group_placement 5
}`,
  );
  return result;
}

function addStaticDecorations(source) {
  let result = addAliases(
    source,
    `#const TEST_CENTER_CRACKS 241
#const TEST_CENTER_SKELETON 710`,
  );
  result = insertBefore(
    result,
    CACHE_MARKER,
    `/* Diagnostic feature: non-animated center decorations. */
create_object TEST_CENTER_CRACKS {
    number_of_objects 6
    set_gaia_object_only
    place_on_specific_land_id CROWN_LAND_ID
    min_distance_group_placement 3
}

create_object TEST_CENTER_SKELETON {
    number_of_objects 5
    set_gaia_object_only
    place_on_specific_land_id CROWN_LAND_ID
    min_distance_group_placement 3
}`,
  );
  return result;
}

function addGuardState(source) {
  let result = addMonument(source, [
    "set_building_capturable",
    "make_indestructible",
  ]);
  result = insertAfter(
    result,
    PLAYER_SETUP_MARKER,
    "\n/* Diagnostic feature: live Crown resource trickle. */\nguard_state TEST_CROWN_MONUMENT AMOUNT_GOLD 40 2\n",
  );
  return result;
}

function diagnosticHeader(source, id, title) {
  let result = replaceOnce(
    source,
    "Crown of Ash v1.0.2",
    `Crown of Ash diagnostic ${id}: ${title}`,
    "version header",
  );
  result = insertAfter(
    result,
    "/* Compatibility: Definitive Edition */\n",
    `/*
    DIAGNOSTIC VARIANT ONLY.
    Stable base: v1.0.2.
    Restored feature: ${title}.
*/\n`,
  );
  return result;
}

const variants = [
  {
    id: "T01",
    title: "Static Monument",
    build: (source) => addMonument(source),
    expected: { monument: 1 },
  },
  {
    id: "T02",
    title: "Indestructible Monument",
    build: (source) => addMonument(source, ["make_indestructible"]),
    expected: { monument: 1, indestructible: 1 },
  },
  {
    id: "T03",
    title: "Capturable Monument",
    build: (source) => addMonument(source, ["set_building_capturable"]),
    expected: { monument: 1, capturable: 1 },
  },
  {
    id: "T04",
    title: "Capturable and Indestructible Monument",
    build: (source) =>
      addMonument(source, ["set_building_capturable", "make_indestructible"]),
    expected: { monument: 1, capturable: 1, indestructible: 1 },
  },
  {
    id: "T05",
    title: "Resource Delta",
    build: addResourceDelta,
    expected: { resourceDelta: 2 },
  },
  {
    id: "T06",
    title: "Exotic Wardens",
    build: (source) => addWardens(source, false),
    expected: { wardenGroup: 1, wardens: 2 },
  },
  {
    id: "T07",
    title: "Exotic Wardens and Gaia Flag",
    build: (source) => addWardens(source, true),
    expected: { wardenGroup: 1, wardens: 2, gaiaFlag: 2 },
  },
  {
    id: "T08",
    title: "Bonfire",
    build: addBonfire,
    expected: { bonfire: 1 },
  },
  {
    id: "T09",
    title: "Cracks and Skeletons",
    build: addStaticDecorations,
    expected: { cracks: 1, skeletons: 1 },
  },
  {
    id: "T10",
    title: "Guard State",
    build: addGuardState,
    expected: {
      monument: 1,
      capturable: 1,
      indestructible: 1,
      guardState: 1,
    },
  },
  {
    id: "T11",
    title: "All Except Guard State",
    build: (source) => {
      let result = addMonument(source, [
        "set_building_capturable",
        "make_indestructible",
      ]);
      result = addResourceDelta(result);
      result = addWardens(result, true);
      result = addBonfire(result);
      return addStaticDecorations(result);
    },
    expected: {
      monument: 1,
      capturable: 1,
      indestructible: 1,
      resourceDelta: 2,
      wardenGroup: 1,
      wardens: 2,
      gaiaFlag: 2,
      bonfire: 1,
      cracks: 1,
      skeletons: 1,
    },
  },
];

const featurePatterns = {
  monument: /\bcreate_object\s+TEST_CROWN_MONUMENT\b/g,
  capturable: /\bset_building_capturable\b/g,
  indestructible: /\bmake_indestructible\b/g,
  resourceDelta: /\bresource_delta\b/g,
  wardenGroup: /\bcreate_object_group\s+TEST_CROWN_WARDEN\b/g,
  wardens: /\bcreate_object\s+TEST_CROWN_WARDEN\b/g,
  gaiaFlag: /\bset_gaia_unconvertible\b/g,
  bonfire: /\bcreate_object\s+TEST_CENTER_BONFIRE\b/g,
  cracks: /\bcreate_object\s+TEST_CENTER_CRACKS\b/g,
  skeletons: /\bcreate_object\s+TEST_CENTER_SKELETON\b/g,
  guardState: /\bguard_state\b/g,
};

mkdirSync(outputDir, { recursive: true });
const expectedFiles = [];

for (const variant of variants) {
  const fileName = `Crown Ash ${variant.id} ${variant.title}.rms`;
  const outputPath = join(outputDir, fileName);
  const source = diagnosticHeader(variant.build(baseline), variant.id, variant.title);
  assert.notEqual(source, baseline, `${variant.id} did not change the baseline`);
  for (const [feature, pattern] of Object.entries(featurePatterns)) {
    const actualCount = [...source.matchAll(pattern)].length;
    const expectedCount = variant.expected[feature] ?? 0;
    assert.equal(
      actualCount,
      expectedCount,
      `${variant.id} ${feature}: expected ${expectedCount}, found ${actualCount}`,
    );
  }
  writeFileSync(outputPath, source);
  expectedFiles.push(fileName);
  console.log(`Built ${outputPath}`);
}

copyFileSync(instructionsPath, join(outputDir, "TEST-INSTRUCTIONS.txt"));
expectedFiles.push("TEST-INSTRUCTIONS.txt");

const actualFiles = readdirSync(outputDir).sort();
assert.deepEqual(
  actualFiles,
  expectedFiles.sort(),
  "diagnostics/generated contains stale or missing files",
);

console.log(`PASS ${variants.length} isolated feature variants`);
