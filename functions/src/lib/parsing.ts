/**
 * Parses a Cloud Storage file path in the format: resumes/{userId}/{timestamp}-{fileName}
 * Returns the userId and original fileName (without timestamp prefix).
 */
export function parseStoragePath(filePath: string): { userId: string; fileName: string } {
  if (!filePath.startsWith("resumes/")) {
    throw new Error(`File is not in resumes/ directory: "${filePath}"`);
  }

  const [, userId, rawFileName] = filePath.split("/");

  if (!userId || !rawFileName) {
    throw new Error(`Invalid storage path format: "${filePath}"`);
  }

  // fileName comes in format: <timestamp>-<originalFileName>
  const dashIndex = rawFileName.indexOf("-");
  if (dashIndex === -1) {
    throw new Error(`Invalid fileName format (missing timestamp prefix): "${rawFileName}"`);
  }

  const fileName = rawFileName.slice(dashIndex + 1);
  if (!fileName) {
    throw new Error(`Empty fileName after stripping timestamp: "${rawFileName}"`);
  }

  return { userId, fileName };
}
