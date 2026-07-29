export function shouldSyncAptlssChecklist(requested: boolean | undefined, autopilotLevel: number) {
  return requested === true && autopilotLevel >= 1;
}
