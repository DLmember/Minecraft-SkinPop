import { Matrix4 } from 'three';

const T = (x, y, z) => new Matrix4().makeTranslation(x, y, z);
const X = angle => new Matrix4().makeRotationX(angle);
const Z = angle => new Matrix4().makeRotationZ(angle);
const chain = (...matrices) => matrices.reduce((a, b) => a.multiply(b), new Matrix4());

// Desktop pet v2.5 native/src/render.rs: base_body, body, torso_space,
// head_rotation and BoxPart transforms. DA channels originate in the supplied
// DetailedAnimationsXJustExpressions player.jem (steady intensity 0.15).
// Keep all BodyParts in their native hierarchy: convert source transforms into
// skin-local coordinates, then cancel each part's existing mesh-centre offset.
export function applyWaist(skin, phase) {
  const t = phase * Math.PI * 2, intensity = .15;
  const roll = -Math.sin(t) * intensity;
  const bob = Math.cos(2 * t) * intensity;
  const armRoll = -Math.sin(t - .25) * intensity;
  const armSlide = -3 * Math.sin(t) * intensity;
  const headRoll = -Math.sin(t - .5) * intensity * .5;
  const headNod = Math.cos(2 * t - .5) * intensity * .1;
  const legRoll = Math.sin(t) * intensity;
  const legSlide = -12 * Math.sin(t) * intensity;

  // Source has floor y=0, viewer skin has floor y=-24. Normalize the crouched
  // neutral soles once, identically for every part. This constant translation
  // does not cancel the source animation's foot travel or recenter each frame.
  const soleY = 9.9 - 12 * Math.cos(.34 - .24);
  const origin = T(0, -24 - soleY, 0);
  const base = chain(origin, T(0, 12 - 2.1, -1.1), X(.34));
  const torso = chain(T(0, bob, 0), base);
  const setPart = (part, matrix) => matrix.decompose(part.position, part.quaternion, part.scale);

  // Body mesh is centred at its own origin; source rotates it about y=12.
  setPart(skin.body, chain(torso, T(0, 12, 0), Z(roll), T(0, -6, 0)));
  // Head mesh is already four pixels above its neck. Neutral gaze cancels most
  // of the crouch pitch, as in the pet with mouse tracking disabled.
  setPart(skin.head, chain(torso, T(0, 12, 0), X(-.25), Z(headRoll), X(headNod)));

  const width = skin.modelType === 'slim' ? 3 : 4;
  for (const [arm, side] of [[skin.leftArm, 1], [skin.rightArm, -1]]) {
    // Pet arm rotation is Rz(animated) * Rx(rest) * Rz(rest), not XYZ Euler
    // angles with the animated roll added to the last component.
    // Native mesh centre is (side*(width/2-1), -4, 0). Cancel only X so
    // the source's shoulder-to-mesh translation (0,-4,0) remains exact.
    setPart(arm, chain(torso,
      T(side * (4 + width / 2) + armSlide, 10 + side * armSlide, 0),
      Z(armRoll), X(-.035), Z(side * .105), T(-side * (width / 2 - 1), 0, 0)));
  }

  // Exact desktop leg chain: base_body * T(side*2 + leg_slide,0,0)
  // * Rz(leg_roll) * Rx(-.24). The native mesh pivot supplies T(0,-6,0).
  // Legs use base_body, not the bobbing torso_space; do not pin the feet.
  for (const [leg, side] of [[skin.leftLeg, 1], [skin.rightLeg, -1]]) {
    setPart(leg, chain(base, T(side * 2 + legSlide, 0, 0), Z(legRoll), X(-.24)));
  }
}
