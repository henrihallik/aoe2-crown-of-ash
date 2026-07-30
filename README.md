# Crown of Ash

`Crown of Ash` is a custom random map for **Age of Empires II: Definitive
Edition**, designed by betwixtX with OpenAI Codex.

[Download Crown of Ash v1.0.1](https://github.com/henrihallik/aoe2-crown-of-ash/releases/download/v1.0.1/Crown-of-Ash-v1.0.1.zip)

Each player begins in a balanced clearing inside dense pine forest. A guaranteed
road leads from every base to a raised central Crown. The Crown is capturable,
indestructible, and marks a rich central prize: ten gold mines, eight stone
mines, and five relics guarded by hostile neutral predators. Four unconnected
side clearings contain randomized resource caches, rewarding scouting and
deliberate forest cutting. In team games, allies also receive narrow rear roads.

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
[`dist/Crown-of-Ash-v1.0.1.zip`](./dist/Crown-of-Ash-v1.0.1.zip) inside it.
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

The final folders may need to be created.

## Verify

The repository includes an independent structural and gameplay-contract check:

```bash
node tools/validate-rms.mjs
```

Build the upload-ready local-mod archive with:

```bash
bash tools/package-mod.sh
```

Static validation cannot execute the proprietary AoE2 DE map generator. Before
publishing, generate several seeds for Tiny, Medium, and Large sizes in the
in-game Scenario Editor and play one Random Map and one Regicide smoke match.

Version 1.0.1 removes the Crown's continuously evaluated `guard_state` resource
trickle after an in-game crash was observed shortly after match startup. The
center's static treasure and capturable Monument remain intact.

## Modern DE features

This is intentionally not an old-script remix. It targets **Update 153015 or
newer** and uses:

- `set_circular_base` for predictable clearings
- `generate_mode 1` for freely distributed hidden caches
- `create_connect_land_zones 1 2` for exact player-to-center paths
- `create_object_group` for weighted herdables, guardians, and cache contents
- `avoid_other_land_zones` to keep each player's starting resources local
- actor areas for linked treasure/guardian placement
- a capturable, indestructible Monument as the central control marker

The RMS is self-contained and uses no custom includes, so the game can transfer
it through a multiplayer lobby.

## References

- [Official Update 153015 notes](https://www.ageofempires.com/news/age-of-empires-ii-definitive-edition-update-153015/)
- [Definitive Random Map Scripting Guide](https://docs.google.com/document/d/1jnhZXoeL9mkRUJxcGlKnO98fIwFKStP_OBozpr0CHXo/)
- [AoE2DE UGC local-mod structure](https://ugc.aoe2.rocks/mods/)
