# AGENTS.md

## 1. Project Overview

Build a polished, cozy, browser-based 3D game using:

* HTML5
* CSS3
* Vanilla JavaScript
* Three.js
* Kenny / Kenney assets for characters, animals and environment
* No React
* No Vue
* No Angular
* No unnecessary frameworks

The game must run directly in a modern desktop or mobile browser.

The game is an **isometric cozy survival / defense game** played on a grassy board.

### Core fantasy

The player controls a small character whose job is to protect a carrot growing in the center of the field.

Rabbits continuously emerge from holes in the ground around the board and attempt to reach the carrot.

The player must:

1. Move around the board.
2. Close rabbit holes.
3. Attack rabbits.
4. Prevent rabbits from reaching the carrot.
5. Collect power-ups.
6. Survive increasingly difficult waves.

The carrot has a finite amount of health.

If the carrot reaches zero health, the game ends.

---

# 2. Design Goals

The game should feel:

* Cozy
* Cute
* Friendly
* Polished
* Responsive
* Easy to understand
* Satisfying to play
* Visually clean
* Slightly arcade-like
* Accessible to both casual and experienced players

Avoid making the game feel dark, violent or stressful.

Combat should be cartoon-like.

The player should immediately understand:

> "Rabbits are coming from the holes. Protect the carrot."

---

# 3. Target Platforms

The game MUST support:

### Desktop

* Windows
* Linux
* macOS

Input:

* Keyboard
* Mouse

### Mobile

* Android
* iOS

Input:

* Touch
* Virtual controls

The game should work in both portrait and landscape where practical, but **landscape should be the preferred orientation** for gameplay.

Do not make desktop controls mandatory.

Do not make touch controls feel like an afterthought.

---

# 4. Technology

Use:

```text
HTML
CSS
JavaScript
Three.js
```

Prefer ES Modules.

Recommended structure:

```text
project/
│
├── index.html
├── AGENTS.md
│
├── css/
│   ├── main.css
│   ├── menu.css
│   └── game.css
│
├── js/
│   ├── main.js
│   │
│   ├── core/
│   │   ├── Game.js
│   │   ├── GameState.js
│   │   ├── InputManager.js
│   │   ├── AssetManager.js
│   │   └── AudioManager.js
│   │
│   ├── world/
│   │   ├── World.js
│   │   ├── Board.js
│   │   ├── Hole.js
│   │   └── Carrot.js
│   │
│   ├── entities/
│   │   ├── Player.js
│   │   ├── Rabbit.js
│   │   └── PowerUp.js
│   │
│   ├── systems/
│   │   ├── SpawnSystem.js
│   │   ├── CombatSystem.js
│   │   ├── PowerUpSystem.js
│   │   └── WaveSystem.js
│   │
│   ├── camera/
│   │   └── IsometricCamera.js
│   │
│   └── ui/
│       ├── HUD.js
│       ├── MainMenu.js
│       └── GameOverScreen.js
│
├── assets/
│   ├── models/
│   ├── textures/
│   ├── audio/
│   └── fonts/
│
└── README.md
```

The exact structure can evolve, but responsibilities should remain separated.

Do not put the entire game inside one large `main.js`.

---

# 5. Three.js

Use Three.js for:

* 3D rendering
* Scene
* Camera
* Lighting
* Shadows
* Models
* Animations
* Raycasting
* Object interaction

Use an **OrthographicCamera** for the isometric presentation.

The game should visually resemble a small diorama.

---

# 6. Isometric Camera

The camera should provide a clear isometric-style view.

Recommended characteristics:

```text
OrthographicCamera
```

The camera should look toward the center of the board from an elevated diagonal angle.

Example conceptual setup:

```text
       CAMERA
          \
           \
            \
        BOARD
```

The camera should not use perspective as the primary visual style.

The board should look like a small tabletop / miniature world.

---

# 7. World

The main play area is a square grass field.

Example:

```text
┌─────────────────────────┐
│   ○              ○      │
│                         │
│       ○        ○        │
│                         │
│          🥕             │
│                         │
│     ○              ○    │
│                         │
│   ○                ○    │
└─────────────────────────┘
```

The carrot is approximately in the center.

Rabbit holes are distributed around the board.

The player can move freely around the playable area.

---

# 8. Board

The board should feel like a cozy garden.

Use:

* Grass
* Small flowers
* Stones
* Bushes
* Wooden elements
* Small decorative props
* Dirt
* Leaves

Do not overcrowd the scene.

Gameplay readability is more important than decoration.

Decorations must never visually obscure:

* Rabbits
* Holes
* Player
* Carrot
* Power-ups

---

# 9. Kenny Assets

Use **Kenney/Kenny-style assets** wherever appropriate.

Prioritize assets for:

* Player characters
* Rabbits
* Animals
* Environment
* Props
* Vegetation
* Objects

Prefer low-poly / stylized assets that share a consistent visual language.

Do not mix radically different art styles.

When importing external models:

1. Verify the model format.
2. Verify scale.
3. Normalize orientation.
4. Normalize materials.
5. Ensure the model works correctly under the game's lighting.
6. Cache loaded assets.

Prefer GLTF/GLB when available.

Create an asset-loading abstraction instead of loading models randomly throughout the code.

Example:

```js
const assets = await assetManager.load({
    player: "assets/models/player.glb",
    rabbit: "assets/models/rabbit.glb"
});
```

---

# 10. Player

The player controls a cute character.

The character should have:

* Idle animation
* Walk animation
* Attack animation if available
* Optional hit / interaction animation

The player should move smoothly.

Movement should not feel grid-based.

---

# 11. Desktop Controls

Recommended:

```text
W / Arrow Up       Move forward
S / Arrow Down     Move backward
A / Arrow Left     Move left
D / Arrow Right    Move right
Space / Mouse      Attack
E                  Interact / close hole
```

However, controls can be simplified if necessary.

The most important requirement is that the controls are immediately understandable.

Avoid requiring complex keyboard combinations.

---

# 12. Mobile Controls

Mobile must have a virtual joystick.

Recommended layout:

```text
┌───────────────────────────────┐
│                               │
│             GAME              │
│                               │
│                               │
│  ◯                            │
│ JOYSTICK              ATTACK  │
│                         ◯     │
└───────────────────────────────┘
```

Left side:

* Movement joystick

Right side:

* Attack button
* Optional interaction button

Buttons must be large enough for comfortable touch interaction.

Minimum practical touch target:

```text
44px
```

Prefer approximately:

```text
56–72px
```

for primary gameplay buttons.

---

# 13. Input Abstraction

Do not put keyboard and touch logic directly inside `Player.js`.

Create an input abstraction.

Example:

```js
input.getMovement()
input.isAttackPressed()
input.isInteractPressed()
```

The player should not care whether the input came from:

* Keyboard
* Mouse
* Touch
* Virtual joystick

This makes the game easier to maintain.

---

# 14. Rabbit Holes

Rabbit holes are important gameplay objects.

A hole should have clear visual feedback.

Possible states:

```text
CLOSED
OPEN
SPAWNING
COOLDOWN
```

Visual states should be immediately recognizable.

For example:

```text
Closed hole
     ↓
Open hole
     ↓
Rabbit emerges
```

The player can interact with an open hole to close it.

---

# 15. Closing Holes

Closing holes is one of the main gameplay mechanics.

The player must approach a hole and perform an interaction.

Example:

```text
Player → Hole → Interact → Hole closes
```

Closing a hole should provide:

* Animation
* Sound
* Particle effect
* Small reward / feedback

The action should feel satisfying.

Do not require pixel-perfect positioning.

Use a reasonable interaction radius.

Example:

```js
const INTERACTION_DISTANCE = 1.5;
```

Adjust according to the world scale.

---

# 16. Rabbits

Rabbits are enemies but must remain cute and non-threatening.

They spawn from holes.

Basic behavior:

```text
SPAWN
  ↓
SEARCH CARROT
  ↓
MOVE TO CARROT
  ↓
EAT CARROT
```

If attacked:

```text
RABBIT
  ↓
HIT
  ↓
DEFEATED
```

Rabbit AI should remain simple.

Do not implement complex navigation unless required.

The board is small enough that basic steering / direct movement is acceptable.

---

# 17. Rabbit Target

By default, rabbits target the carrot.

They should move toward it.

Avoid excessive pathfinding complexity.

A rabbit should roughly:

```js
direction = carrot.position - rabbit.position;
rabbit.move(direction);
```

Obstacles can be ignored initially.

Add collision avoidance between rabbits if necessary.

---

# 18. Rabbit Attack / Defeat

The player can attack rabbits.

Combat should be simple.

Possible implementation:

```text
Player attacks
       ↓
Attack range check
       ↓
Rabbit inside range?
       ↓
Yes → Damage
       ↓
Rabbit defeated
```

The attack should have:

* Visual feedback
* Sound feedback
* Hit reaction
* Small particle effect

Avoid graphic violence.

Use cartoon effects such as:

* Puff
* Stars
* Flash
* Bounce
* Small knockback

---

# 19. Player Attack

The player should have a configurable attack range.

Default:

```text
Attack Range = short
```

The player should not need to precisely click a rabbit.

Use an area/radius-based attack.

Example:

```js
const ATTACK_RANGE = 1.5;
```

Power-ups can increase this value.

---

# 20. Carrot

The carrot is the central objective.

It has health.

Example:

```js
carrot.maxHealth = 100;
carrot.health = 100;
```

When rabbits reach the carrot:

```text
Rabbit eats carrot
       ↓
Carrot loses health
       ↓
Rabbit continues / disappears
```

The carrot must have strong visual feedback when damaged.

Examples:

* Shake
* Flash
* Particle effect
* Health bar update

---

# 21. Carrot Health UI

The HUD should clearly display carrot health.

Example:

```text
🥕 CARROT

████████████░░  80%
```

The player should always know how close they are to losing.

When health becomes low, increase visual feedback.

For example:

```text
100% → normal
50%  → warning
20%  → critical
```

Do not make the screen excessively stressful.

---

# 22. Power-Ups

Power-ups spawn around the map.

The player can collect them by touching / interacting with them.

Initial power-ups:

### Energy

Increases movement speed.

Example:

```text
+ Movement Speed
```

### Strength

Increases attack damage.

Example:

```text
+ Attack Damage
```

### Range

Increases attack distance.

Example:

```text
+ Attack Range
```

If appropriate, these can be combined into a single pickup system.

---

# 23. Power-Up Feedback

When collecting a power-up:

* Play sound
* Show particle effect
* Show floating text
* Update HUD
* Animate pickup

Example:

```text
+ SPEED!
```

The effect should be immediately understandable.

---

# 24. Power-Up Duration

Power-ups can either be:

### Temporary

Example:

```text
Speed +30%
Duration: 10 seconds
```

or:

### Permanent for the current run

Example:

```text
Speed +10%
```

Prefer temporary boosts initially because they create more interesting moment-to-moment gameplay.

The system should support both.

---

# 25. Waves

The game should progressively become harder.

Example:

```text
Wave 1
3 rabbits

Wave 2
5 rabbits

Wave 3
7 rabbits

Wave 4
10 rabbits
```

Difficulty should increase through:

* More rabbits
* Faster rabbits
* More active holes
* Faster spawn rates

Avoid increasing all difficulty parameters simultaneously too aggressively.

---

# 26. Spawn System

Create a dedicated spawn system.

It should control:

* Available holes
* Spawn interval
* Maximum active rabbits
* Wave difficulty
* Rabbit type

Example:

```js
spawnSystem.startWave(1);
```

Avoid putting spawn logic inside `Rabbit.js`.

---

# 27. Game States

The game should have explicit states.

Example:

```js
const GameState = {
    MENU: "MENU",
    PLAYING: "PLAYING",
    PAUSED: "PAUSED",
    GAME_OVER: "GAME_OVER"
};
```

Potential future states:

```text
LOADING
VICTORY
TUTORIAL
```

---

# 28. Main Menu

The initial screen should be simple.

Example:

```text
        🥕
   CARROT GUARDIAN

     [ PLAY ]

     [ OPTIONS ]
```

Avoid large amounts of text.

The game should communicate its objective visually.

---

# 29. Tutorial

The first game should provide a minimal tutorial.

Example:

```text
Protect the carrot!

Move with WASD
or use the joystick.

Close the rabbit holes.

Stop the rabbits!
```

The tutorial should not block gameplay for too long.

Prefer contextual hints.

---

# 30. HUD

The HUD should remain minimal.

Recommended:

```text
┌─────────────────────────────────┐
│ WAVE 3          🥕 ███████░ 72% │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
│ ⚡ SPEED   ⚔ POWER   🎯 RANGE   │
└─────────────────────────────────┘
```

Display:

* Carrot health
* Current wave
* Active power-ups
* Optional score

Do not overload the screen.

---

# 31. Game Over

When the carrot reaches zero:

```text
       🥕
   OH NO!

The rabbits ate the carrot!

     WAVE 7

   [ TRY AGAIN ]
   [ MENU ]
```

Game-over transition should be smooth.

Do not immediately reset the entire page.

---

# 32. Scoring

Implement a simple scoring system.

Possible points:

```text
Rabbit defeated      +10
Hole closed          +5
Power-up collected   +2
Wave completed       +100
```

Display score in the HUD if it improves the gameplay.

Score should not be more important than protecting the carrot.

---

# 33. Animation

The game should feel alive.

Use subtle animations for:

* Grass
* Flowers
* Rabbits
* Player
* Carrot
* Power-ups
* Holes

Examples:

```text
Carrot:
small idle bounce

Power-up:
floating + rotation

Rabbit:
walk animation

Hole:
small dirt particles

Player:
idle animation
```

Avoid excessive animation.

---

# 34. Game Feel

Prioritize game feel.

Actions should have immediate feedback.

For example:

### Closing a hole

```text
Player approaches
      ↓
Interaction indicator
      ↓
Player action
      ↓
Hole animation
      ↓
Dust particles
      ↓
Sound
      ↓
Reward
```

### Killing a rabbit

```text
Attack
 ↓
Hit flash
 ↓
Knockback
 ↓
Particles
 ↓
Sound
 ↓
Rabbit disappears
```

---

# 35. Lighting

Use a warm, pleasant lighting setup.

Recommended:

* Ambient light
* Directional light
* Soft shadows
* Warm sun

The environment should feel like a sunny miniature garden.

Avoid:

* Harsh contrast
* Dark environments
* Photorealistic lighting
* Excessive bloom

---

# 36. Shadows

Enable shadows where they improve visual quality.

Do not enable expensive shadows for every object.

Use reasonable shadow map resolution.

Optimize for mobile.

Prioritize shadows for:

* Player
* Rabbits
* Carrot
* Important props

---

# 37. Rendering Performance

The game must run smoothly on mobile.

Target:

```text
60 FPS
```

Acceptable fallback:

```text
30 FPS
```

Avoid:

* Excessive draw calls
* Huge textures
* Unnecessary dynamic lights
* Hundreds of unique materials
* Excessive particle systems
* Constant creation/destruction of objects

Reuse objects when practical.

Use object pooling for:

* Rabbits
* Particles
* Effects

---

# 38. Responsive Rendering

The renderer must adapt to window size.

Handle:

```js
window.addEventListener("resize", resize);
```

Update:

* Renderer
* Camera
* HUD
* Touch controls

The game must remain playable on:

* 1920×1080
* 1366×768
* 1280×720
* 800×600
* 390×844
* 430×932
* Tablets

---

# 39. Device Detection

Do not rely exclusively on user-agent detection.

Prefer feature detection.

Touch controls should appear when appropriate.

Example:

```js
const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0;
```

Desktop users should not see mobile controls unless necessary.

---

# 40. Touch Controls

Prevent accidental browser gestures while playing.

The game canvas should appropriately handle:

```css
touch-action: none;
```

Do not prevent scrolling globally across the entire page unless necessary.

Only gameplay areas should capture touch input.

---

# 41. Audio

Implement an `AudioManager`.

Support:

* Music
* Rabbit sounds
* Attack sounds
* Pickup sounds
* Hole closing sound
* Damage sound
* UI sounds

Audio should start only after user interaction when required by browser autoplay policies.

Provide:

```text
Music ON/OFF
SFX ON/OFF
```

---

# 42. Asset Loading

Show a loading screen.

Example:

```text
Loading garden...

██████████████░░░░
```

Do not start gameplay before essential assets are loaded.

Cache assets.

Do not load the same GLTF repeatedly.

---

# 43. Collision / Interaction

Use simple distance-based checks where possible.

For example:

```js
distance(player, rabbit) < attackRange
```

and:

```js
distance(player, hole) < interactionRange
```

Do not introduce a physics engine unless there is a real gameplay requirement.

Three.js plus simple custom collision is preferred.

---

# 44. Coordinate System

Keep a consistent world coordinate system.

Recommended:

```text
X = horizontal
Y = vertical
Z = depth
```

Ground:

```text
Y = 0
```

Entities should generally rest above:

```text
Y > 0
```

Avoid arbitrary coordinate conventions in individual classes.

---

# 45. Entity Architecture

Entities should have clear responsibilities.

Example:

```js
class Rabbit {
    update(delta) {}
    takeDamage(amount) {}
    destroy() {}
}
```

Player:

```js
class Player {
    update(delta) {}
    move(direction, delta) {}
    attack() {}
}
```

Carrot:

```js
class Carrot {
    takeDamage(amount) {}
    isDead() {}
}
```

---

# 46. Update Loop

Use a single game loop.

Example:

```js
function animate(time) {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    game.update(delta);
    game.render();
}
```

Avoid independent animation loops for game systems.

---

# 47. Delta Time

Gameplay movement must use delta time.

Never do:

```js
player.position.x += speed;
```

Prefer:

```js
player.position.x += speed * delta;
```

This keeps gameplay consistent across different frame rates.

---

# 48. Mobile Performance Rules

On mobile:

* Reduce shadow resolution
* Reduce particle count
* Reduce decorative objects
* Reduce render resolution if necessary
* Avoid unnecessary post-processing
* Avoid expensive transparency
* Use simpler materials

The game should prioritize stable FPS over graphical effects.

---

# 49. UI Style

The UI should match the cozy visual style.

Use:

* Rounded panels
* Soft shadows
* Large readable text
* Friendly icons
* Warm colors
* Subtle animations

Avoid:

* Generic browser buttons
* Extremely sharp UI
* Overly futuristic HUD
* Excessive gradients
* Excessive neon colors

The UI should feel like part of the game world.

---

# 50. Typography

Use a friendly, readable font.

Prioritize readability on mobile.

Buttons should have clear labels:

```text
PLAY
PAUSE
RETRY
MENU
```

Avoid tiny text.

---

# 51. Camera Behavior

The camera should initially remain fixed in the isometric position.

Do not introduce camera rotation unless it provides a clear gameplay benefit.

The camera may follow the player slightly if the board becomes larger than the viewport.

For the initial version, keep the entire board visible whenever possible.

---

# 52. Gameplay Boundaries

The player must not leave the board.

Clamp movement to the playable area.

Example concept:

```js
player.position.x = clamp(
    player.position.x,
    minX,
    maxX
);
```

Do the same for Z.

---

# 53. Rabbit Spawn Rules

Do not spawn rabbits directly next to the carrot.

Rabbits should appear from predefined holes.

Spawn positions must be:

* Inside the board
* Outside the immediate carrot area
* Visually clear

Avoid spawning rabbits directly underneath the player.

---

# 54. Hole Distribution

Use predefined spawn points initially.

Example:

```js
const holePositions = [
    [-6, -6],
    [0, -6],
    [6, -6],
    [-6, 0],
    [6, 0],
    [-6, 6],
    [0, 6],
    [6, 6]
];
```

The exact coordinates should depend on board size.

---

# 55. Difficulty Design

The first wave should be very easy.

The player should learn:

```text
Move
 ↓
Close hole
 ↓
Attack rabbit
 ↓
Collect power-up
```

Do not punish the player heavily during the first wave.

Difficulty should gradually increase.

---

# 56. Feedback and Readability

Every important action should produce at least one form of feedback.

Examples:

```text
Hole closed
→ animation + sound

Rabbit hit
→ animation + particles

Rabbit defeated
→ score + effect

Carrot damaged
→ shake + health change

Power-up collected
→ popup + sound
```

The player should never wonder whether an action worked.

---

# 57. Code Quality

Write maintainable code.

Prefer:

```js
class Player {}
class Rabbit {}
class Hole {}
class Carrot {}
```

over one huge object.

Avoid:

```js
// 2000 lines in main.js
```

Use modules.

Use meaningful names.

Avoid unnecessary abstractions.

Do not create architecture purely for the sake of architecture.

---

# 58. Constants

Gameplay values should be centralized.

Example:

```js
export const GAME_CONFIG = {
    player: {
        speed: 4,
        attackRange: 1.5,
        attackDamage: 1
    },

    carrot: {
        maxHealth: 100
    },

    rabbit: {
        speed: 1.5,
        damage: 5
    }
};
```

Do not scatter magic numbers throughout the project.

---

# 59. Debug Mode

Implement an optional debug mode.

Example:

```js
const DEBUG = false;
```

When enabled, allow visualization of:

* Player position
* Rabbit targets
* Attack range
* Interaction range
* Hole positions
* FPS
* Active entity count

Debug UI must not appear in production mode.

---

# 60. Error Handling

Handle asset loading errors gracefully.

If an asset fails:

* Log a useful error
* Avoid crashing the entire game
* Show a fallback where practical

Example:

```text
Failed to load rabbit.glb
```

The console should make debugging straightforward.

---

# 61. Browser Compatibility

Target modern browsers:

* Chrome
* Firefox
* Safari
* Edge

Use modern JavaScript, but avoid browser-specific APIs unless necessary.

---

# 62. Accessibility

Where practical:

* Use readable text
* Maintain sufficient contrast
* Avoid relying exclusively on color
* Make buttons large
* Support keyboard navigation in menus
* Provide visible focus states
* Avoid tiny interactive elements

---

# 63. Game Pause

The game should automatically pause when:

* The browser tab becomes hidden
* The user opens the pause menu

Use:

```js
document.visibilitychange
```

to avoid rabbits attacking the carrot while the user is away.

---

# 64. Save System

For the initial version, persistent progression is optional.

If implemented, use:

```text
localStorage
```

Possible saved data:

* High score
* Highest wave
* Settings
* Audio preferences

Do not require a backend.

---

# 65. No Backend Requirement

The initial game should be completely client-side.

Do not introduce:

* Node backend
* Database
* Authentication
* Server
* API

unless a future feature explicitly requires it.

The game should be playable by opening the project through a local development server.

---

# 66. Development Server

Because ES modules and GLTF assets can have browser security restrictions when opened with `file://`, development should use a local HTTP server.

For example:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

---

# 67. Development Process

When implementing a feature:

1. Understand the existing architecture.
2. Reuse existing systems.
3. Avoid rewriting unrelated code.
4. Implement the smallest complete version.
5. Test desktop controls.
6. Test mobile controls.
7. Test window resizing.
8. Test asset loading.
9. Test game-over conditions.
10. Test performance.

Do not introduce a large dependency for a small feature.

---

# 68. Feature Priority

Implement in this order.

### Phase 1 — Foundation

* Three.js scene
* Orthographic camera
* Grass board
* Lighting
* Renderer
* Resize handling

### Phase 2 — Player

* Player model
* Movement
* Animation
* Keyboard controls
* Touch joystick

### Phase 3 — Objective

* Carrot
* Carrot health
* HUD

### Phase 4 — Holes

* Hole models
* Spawn points
* Hole states
* Closing interaction

### Phase 5 — Rabbits

* Rabbit model
* Rabbit spawning
* Rabbit movement
* Carrot targeting
* Rabbit damage
* Rabbit defeat

### Phase 6 — Gameplay

* Waves
* Difficulty
* Score
* Game over
* Restart

### Phase 7 — Power-ups

* Speed
* Strength
* Range
* Pickup effects
* HUD indicators

### Phase 8 — Polish

* Particles
* Sounds
* Animations
* UI transitions
* Camera polish
* Better environment
* Performance optimization

---

# 69. MVP

The minimum playable version must contain:

```text
[ ] 3D grass board
[ ] Isometric camera
[ ] Player
[ ] Player movement
[ ] Carrot
[ ] Carrot health
[ ] Rabbit holes
[ ] Rabbit spawning
[ ] Rabbits moving toward carrot
[ ] Player attack
[ ] Rabbit defeat
[ ] Hole closing
[ ] Game over
[ ] Restart
[ ] Desktop controls
[ ] Mobile controls
```

Do not add complex systems before the MVP is playable.

---

# 70. Quality Standard

The game should not feel like a technical prototype.

Even the MVP should have:

* Consistent scale
* Consistent lighting
* Smooth movement
* Good UI
* Clear feedback
* Proper animations where available
* Responsive controls
* Clean composition

Every feature should be evaluated from the player's perspective.

Ask:

> Is this immediately understandable?

> Does this feel responsive?

> Does this look intentional?

> Does this work on mobile?

---

# 71. Visual Direction

The final visual style should resemble:

```text
Cozy
+
Low-poly
+
Colorful
+
Miniature diorama
+
Cute animals
+
Garden
+
Arcade gameplay
```

Avoid:

```text
Realistic
Dark
Horror
Military
Photorealistic
Overly complex
```

The player should feel like they are playing with a small animated garden diorama.

---

# 72. Important Gameplay Principle

The carrot is the central focus of the game.

The player should always understand:

```text
                 🥕
              CARROT
                 ↑
          rabbits attack
                 ↑
        holes spawn rabbits
                 ↑
       player stops rabbits
```

All mechanics should reinforce this loop.

---

# 73. Core Gameplay Loop

The final gameplay loop is:

```text
        START WAVE
             ↓
       HOLES OPEN
             ↓
      RABBITS SPAWN
             ↓
       RABBITS MOVE
             ↓
          CARROT
             ↑
             │
      PLAYER DEFENDS
        ↙          ↘
   CLOSE HOLES    ATTACK
        ↓            ↓
      REWARD       REWARD
        ↘            ↙
         POWER-UPS
             ↓
       NEXT WAVE
             ↓
       MORE DIFFICULT
```

---

# 74. Design Rule

Whenever there is a conflict between:

* visual complexity
* technical complexity
* gameplay clarity

prioritize:

```text
Gameplay clarity
>
Performance
>
Visual polish
>
Technical complexity
```

Do not sacrifice usability for unnecessary technical sophistication.

---

# 75. Agent Behavior

When modifying this project, the coding agent should:

* Read existing files before changing them.
* Preserve working functionality.
* Prefer incremental changes.
* Avoid unnecessary rewrites.
* Explain significant architectural changes.
* Keep modules focused.
* Test after major changes.
* Consider both desktop and mobile for every gameplay feature.
* Avoid introducing frameworks without explicit approval.
* Prefer Three.js-native solutions.
* Keep gameplay constants configurable.
* Maintain the cozy visual direction.

Never implement a feature only for desktop if it affects gameplay.

Never implement touch controls as an afterthought.

---

# 76. Definition of Done

A feature is considered complete only when:

```text
[ ] Works in desktop browser
[ ] Works on mobile
[ ] Does not break existing gameplay
[ ] Handles resize correctly
[ ] Has appropriate visual feedback
[ ] Has appropriate audio feedback when applicable
[ ] Does not introduce console errors
[ ] Performs acceptably
[ ] Fits the cozy art direction
[ ] Uses the existing architecture
```

---

# 77. Final Product Vision

The finished game should feel like a small, polished indie browser game.

The player opens the game and immediately sees:

A beautiful little grassy garden.

A carrot in the middle.

Small holes scattered around the field.

A cute character standing nearby.

Then:

```text
A hole moves...
      ↓
A rabbit pops out.
      ↓
The rabbit sees the carrot.
      ↓
The player runs toward it.
      ↓
The player attacks.
      ↓
Another hole opens.
      ↓
The player closes it.
      ↓
A SPEED power-up appears.
      ↓
The player collects it.
      ↓
More rabbits appear.
```

The gameplay should be simple enough to understand within seconds, but provide enough escalation, movement and power-ups to remain engaging over multiple waves.
