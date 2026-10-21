# Diamond sword

`diamond_sword.png` is the unmodified 16×16 vanilla Minecraft Java Edition 1.21.4 item texture, copyright Mojang Studios / Microsoft. It is not covered by the open-source dependency licenses.

Source mirror: https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21.4/assets/minecraft/textures/item/diamond_sword.png

`diamond_sword.json` records the exact coordinates and RGB values of its 84 opaque texels. Rebuild with `node scripts/import-sword.mjs` while the development server is running. The renderer preserves these texels and the original diagonal silhouette, with one-texel extrusion as in Minecraft's generated item geometry. The default third-person item scale of 0.85 is applied to the texels; the sprite is aligned to the player's hand for this viewer's coordinate system.

# Particle sequences

`particles/` contains 24 unmodified Minecraft Java Edition 1.21.4 particle textures: `generic_0`–`generic_7` (smoke/poof) and `explosion_0`–`explosion_15`. The three original particle definitions record their animation order. `provenance.json` records the version, original mirror URL and SHA-256 of each file. Mirrors used for retrieval are assets.mcasset.cloud and jsDelivr's mirror of InventivetalentDev/minecraft-assets. Copyright Mojang Studios / Microsoft; these game assets are not MIT licensed.

Re-fetch and verify with `node scripts/fetch-particles.mjs`. Texture pixels and animation order are original; deterministic particle positions and the player's death/creeper-style animation are implemented by SkinPop. All textures are embedded as data URLs in the standalone HTML and need no network at runtime.

# Apple

`apple.png` is the unmodified 16×16 Minecraft Java Edition 1.21.4 apple item texture. Copyright Mojang Studios / Microsoft. `apple-provenance.json` records its source and SHA-256; `apple.json` records all 114 opaque texels. Rebuild with `node scripts/import-apple.mjs`. The item uses vanilla generated-item scale 0.55 and one-texel thickness. Food fragments use patches of those same pixels. The default consumption time is 32 game ticks (1.6 seconds at 20 ticks/second), with 4-tick chewing intervals. Hand motion and fragment trajectories are implemented by this page. The texture is embedded in the local HTML and does not need a network connection.
