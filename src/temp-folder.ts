import { getTempFolderPath, _internal_startWatchdog } from "./temp-file";

export async function CreateTempFolderPath(): Promise<string> {
    return getTempFolderPath();
}

export { _internal_startWatchdog };