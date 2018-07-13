import { getTempFolderPath } from "./temp-file";

export async function CreateTempFolderPath(): Promise<string> {
    return getTempFolderPath();
}