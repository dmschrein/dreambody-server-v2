/**
 * Generates a standardized resource name by combining various parameters.
 *
 * @param usage - The project name is generally used here (e.g., "dreambody-server-api")
 * @param resource - The type of resource being named (e.g., "eventBridge", "apiGateway", "lambda")
 * @param env - Optional. The environment where the resource is deployed (e.g., "dev", "prod", "staging")
 * @param location - Optional. The geographic location or region of the resource (e.g., "usEast1" - note this is camelCase to prevent confusion with hyphens)
 * @param description - Optional. Additional descriptive information to append to the name
 * @param separatingChar - Optional. The symbol used between the different parts of the name. Default: "-"
 * @returns A formatted string combining all parameters in the pattern: usage[separator]env[separator]resource[separator]location[separator]description
 *
 * @example
 * getName("dreambody-server-api", "lambda", "dev", "usEast1", "backend") => "dreambody-server-api-dev-lambda-usEast1-backend"
 * getName("dreambody-server-api", "bedrockNode", "dev", "", "prompt", "_") => "dreambody-server-api_dev_bedrockNode_prompt"
 **/

/**
 * Supported separator characters for resource naming
 */
export type SeparatorChar = "-" | "_" | ".";

export const getName = (
  usage: string,
  resource: string,
  env?: string,
  location?: string,
  description?: string,
  separatingChar: SeparatorChar = "-",
): string => {
  // Use the verified separator character for all concatenations
  const verifiedSeparatingChar = separatingChar || "-";

  const verifiedEnv = env ? verifiedSeparatingChar + env : "";
  const verifiedLocation = location ? verifiedSeparatingChar + location : "";
  const verifiedDescription = description
    ? verifiedSeparatingChar + description
    : "";

  // Combine all components with the verified separator
  return `${usage}${verifiedEnv}${verifiedSeparatingChar}${resource}${verifiedLocation}${verifiedDescription}`;
};
