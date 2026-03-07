export function calculateDamage(attacker, ability = null) {
  let damage = attacker.baseDamage;

  if (ability?.type === "damageBoost") {
    damage += ability.value;
  }

  const critRoll = Math.random();
  if (critRoll < attacker.critChance) {
    damage *= 2;
  }

  return Math.floor(damage);
}