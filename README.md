# Crown of Ash

`Crown of Ash` is a custom random map for **Age of Empires II: Definitive
Edition**, designed by betwixtX with OpenAI Codex.

**Runtime status:** The crash cause is confirmed. Every failed build used
`base_elevation` without the required `<ELEVATION_GENERATION>` section. Two
complementary controls corrected that contract in different ways, and both
passed in the same GeForce NOW setup where the earlier files crashed.

Version 1.1.0-rc1 restores the complete original design on the corrected map
structure. It is a prerelease until its restored gameplay systems complete an
in-game smoke test.

[Download the v1.1.0-rc1 standalone RMS](https://github.com/henrihallik/aoe2-crown-of-ash/releases/download/v1.1.0-rc1/Crown-of-Ash-v1.1.0-rc1.rms)

[Download the v1.1.0-rc1 local-mod ZIP](https://github.com/henrihallik/aoe2-crown-of-ash/releases/download/v1.1.0-rc1/Crown-of-Ash-v1.1.0-rc1.zip)

Each player begins in a balanced clearing inside dense pine forest. A guaranteed
road leads from every base to a raised central Crown. The Crown is capturable,
indestructible, and grants **24 gold per minute** while held. Its enriched mines
and five relics are guarded by hostile neutral predators. Four unconnected side
clearings contain randomized resource caches with their own guards, rewarding
scouting and deliberate forest cutting. In team games, allies also receive
narrow rear roads.

## Play

Recommended lobby settings:

- Game mode: **Random Map** or **Regicide**
- Players: **2-8**
- Map style: **Custom**
- Resources: **Standard**
- Map size: the normal recommended size for the player count
- AI: supported; the script identifies itself as a Black Forest-style map

The script also removes Dark Age resource clutter in Death Match and Infinite
Resources. Empire Wars has no custom opening and therefore falls back to a
normal Random Map start. King of the Hill and Battle Royale are not supported.

## Install

### Local mod

Copy the whole [`Crown of Ash`](./Crown%20of%20Ash) folder into:

```text
%USERPROFILE%\Games\Age of Empires 2 DE\<player-id>\mods\local\
```

Or create that `Crown of Ash` folder and extract
[`dist/Crown-of-Ash-v1.1.0-rc1.zip`](./dist/Crown-of-Ash-v1.1.0-rc1.zip) inside
it.
The resulting layout must begin with:

```text
mods\local\Crown of Ash\info.json
mods\local\Crown of Ash\resources\
```

Enable the local mod in the in-game Mod Manager. In a skirmish or lobby, choose
**Custom** as the map style and select **Crown of Ash**.

### Single RMS

Alternatively, copy
[`Crown of Ash.rms`](./Crown%20of%20Ash/resources/_common/random-map-scripts/Crown%20of%20Ash.rms)
and its same-named PNG into:

```text
%USERPROFILE%\Games\Age of Empires 2 DE\<player-id>\resources\_common\random-map-scripts\
```

The final folders may need to be created. The PNG is only the optional map-list
thumbnail; the RMS works without it.

## Verify

The repository includes an independent structural and gameplay-contract check:

```bash
node tools/validate-rms.mjs
```

Build the upload-ready local-mod archive with:

```bash
bash tools/package-mod.sh
```

Static validation cannot execute the proprietary AoE2 DE map generator. Follow
the [release-candidate smoke test](./diagnostics/release-candidate/TEST-INSTRUCTIONS.txt)
before promoting the prerelease.

## Crash investigation

The original releases crashed during exploration and almost immediately with
Reveal Map set to All Visible. Removing the Crown, wardens, resource changes,
decorations, and flower terrain did not stop the crash. Built-in Black Forest
passed under the same settings with an AI opponent.

Visibility test V01 reduced the map to complete player lands and starting
economies, yet still crashed. It exposed the shared structural defect:
`base_elevation` was used without an `<ELEVATION_GENERATION>` section. RMS
documentation requires that section even when it is empty.

Elevation test E01 retained `base_elevation` and added the empty section. E02
removed `base_elevation` instead. Neither crashed. The feature-complete
v1.1.0-rc1 therefore retains the raised player clearings and Crown while adding
the required section. The
[elevation-isolation release](https://github.com/henrihallik/aoe2-crown-of-ash/releases/tag/elevation-isolation-v1)
preserves the two controls and results.

The Scenario Editor does not reproduce `set_gaia_unconvertible`, and it does
not display `resource_delta` changes. Those features must be checked in
Skirmish.

## Modern DE features

This is intentionally not an old-script remix. It targets **Update 153015 or
newer** and uses:

- `set_circular_base` for predictable clearings
- `generate_mode 1` for freely distributed hidden caches
- `create_connect_land_zones 1 2` for exact player-to-center paths
- `create_object_group` for weighted herdables, wardens, and cache contents
- `avoid_other_land_zones` to keep each player's starting resources local
- actor areas for linked treasure and warden placement
- `set_building_capturable` and `make_indestructible` for the Crown
- `resource_delta` for enriched central mines
- `guard_state` for live gold income while the Crown is controlled

The RMS is self-contained and uses no custom includes, so the game can transfer
it through a multiplayer lobby.

## References

- [Official Update 153015 notes](https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-153015/)
- [Definitive Random Map Scripting Guide](https://docs.google.com/document/d/1jnhZXoeL9mkRUJxcGlKnO98fIwFKStP_OBozpr0CHXo/)
- [AoE2DE UGC local-mod structure](https://ugc.aoe2.rocks/mods/)
