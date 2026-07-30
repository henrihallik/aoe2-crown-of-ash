#!/usr/bin/env node

import "./build-visibility-tests.mjs";

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
  "diagnostics",
  "generated-visibility",
  "Crown Ash V01 Player Lands Only.rms",
);
const outputDir = join(root, "diagnostics", "generated-elevation");
const instructionsPath = join(
  root,
  "diagnostics",
  "elevation-isolation",
  "TEST-INSTRUCTIONS.txt",
);

const baseline = readFileSync(baselinePath, "utf8");
const ELEVATION_SECTION = "<ELEVATION_GENERATION>";
const TERRAIN_SECTION = "<TERRAIN_GENERATION>";
const BASE_ELEVATION = "    base_elevation 1\n";

assert.match(baseline, /Crown of Ash diagnostic V01: Player Lands Only/);
assert.equal(
  baseline.split(BASE_ELEVATION).length - 1,
  1,
  "V01 must contain exactly one base_elevation declaration",
);
assert.doesNotMatch(
  baseline,
  /<ELEVATION_GENERATION>/,
  "V01 must reproduce the missing elevation section",
);

function replaceOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `missing ${label}`);
  assert.equal(source.indexOf(needle, first + needle.length), -1, `duplicate ${label}`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function diagnosticHeader(source, id, title) {
  let result = replaceOnce(
    source,
    "    Failed control: R01, derived from v1.0.2.\n",
    "    Failed control: V01 Player Lands Only, derived from v1.0.2.\n",
    "failed control header",
  );
  result = replaceOnce(
    result,
    "    Visibility test: Player Lands Only.\n",
    `    Elevation test: ${title}.\n`,
    "visibility diagnostic header",
  );
  result = replaceOnce(
    result,
    "Crown of Ash diagnostic V01: Player Lands Only",
    `Crown of Ash diagnostic ${id}: ${title}`,
    "V01 title",
  );
  return result;
}

function withRequiredElevationSection(source) {
  return replaceOnce(
    source,
    TERRAIN_SECTION,
    `${ELEVATION_SECTION}

/* Required because create_player_lands specifies base_elevation. */

${TERRAIN_SECTION}`,
    "terrain section",
  );
}

function withoutBaseElevation(source) {
  return replaceOnce(source, BASE_ELEVATION, "", "base_elevation");
}

const variants = [
  {
    id: "E01",
    title: "Required Elevation Section",
    build: withRequiredElevationSection,
    expectsBaseElevation: true,
    expectsElevationSection: true,
  },
  {
    id: "E02",
    title: "Flat Player Lands",
    build: withoutBaseElevation,
    expectsBaseElevation: false,
    expectsElevationSection: false,
  },
];

mkdirSync(outputDir, { recursive: true });
const expectedFiles = [];

for (const variant of variants) {
  const fileName = `Crown Ash ${variant.id} ${variant.title}.rms`;
  const source = diagnosticHeader(variant.build(baseline), variant.id, variant.title);
  const baseElevationCount = source.split(BASE_ELEVATION).length - 1;
  const elevationSectionCount = source.split(ELEVATION_SECTION).length - 1;

  assert.equal(
    baseElevationCount,
    variant.expectsBaseElevation ? 1 : 0,
    `${variant.id} base_elevation count`,
  );
  assert.equal(
    elevationSectionCount,
    variant.expectsElevationSection ? 1 : 0,
    `${variant.id} elevation section count`,
  );
  assert.equal(
    source.split(TERRAIN_SECTION).length - 1,
    1,
    `${variant.id} terrain section count`,
  );
  assert.doesNotMatch(source, /\bplace_on_specific_land_id\b/);

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

console.log(`PASS ${variants.length} elevation isolation variants`);
