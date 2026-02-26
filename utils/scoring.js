export function calcularPuntuacion(checks) {
  let score = 0;

  // Criterios técnicos
  if (checks.sslIssue) score += 4;
  if (checks.mixedContent) score += 3;
  if (checks.techObsolete) score += 4;
  if (!checks.favicon || !checks.metaSEO) score += 2;
  if (checks.slowLoad || !checks.cdn) score += 3;

  // Criterios visuales
  if (!checks.responsive) score += 3;
  if (!checks.cta) score += 2;
  if (checks.templateLook) score += 2;
  if (checks.formsBroken) score += 3;

  // Criterios de seguridad
  if (!checks.policyPage) score += 3;
  if (checks.headersMissing) score += 2;
  if (checks.mxMissingSPF || checks.mxMissingDKIM || checks.mxMissingDMARC) score += 2;

  const max = 35; // puntuación máxima posible
  const total = Math.min((score / max) * 5, 5);
  return parseFloat(total.toFixed(2));
}
