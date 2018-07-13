import { GetInfo } from "p-info";
import { Range, SetTimeoutAsync } from "pchannel";
import * as os from "os";
import { exists, mkdir, stat, writeFile, readFile } from "fs";
import { execFile, exec, spawn } from "child_process";

let currentProcessInfo = GetInfo(process.pid);

function mkdirPromise(path: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        mkdir(path, (err) => {
            err ? reject(err) : resolve();
        });
    });
}

function execPromise(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            err = err || stderr;
            err ? reject(err) : resolve(stdout);
        });
    });
}

function writeFilePromise(path: string, contents: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        writeFile(path, contents, err => {
            err ? reject(err) : resolve();
        });
    });
}
function readFilePromise(path: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        readFile(path, (err, data) => {
            err ? reject(err) : resolve(data.toString());
        });
    });
}

type SecondArgument<T> = T extends (a: infer A, b: infer B) => any ? B : never;
type StripUndefined<T> = T extends undefined ? never : T;
type Stats = SecondArgument<StripUndefined<SecondArgument<typeof stat>>>;

function statPromise(path: string): Promise<Stats> {
    return new Promise<Stats>((resolve, reject) => {
        stat(path, (err, stats) => {
            err ? reject(err) : resolve(stats);
        });
    });
}

export async function tempFolderDir(): Promise<string> {
    let path = os.tmpdir().replace(/\\/g, "/") + "/temp-file/";
    try {
        await mkdirPromise(path);
    } catch(e) { }
    return path;
}


export async function getTempFolderPath(): Promise<string> {
    let path = await tempFolderDir();
    path = path + (await createTempFolderName());
    await mkdirPromise(path);
    return path + "/";
}

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const count = Math.ceil(128 / Math.log2(alphabet.length));
const processRandomIdentifier = Range(0, count).map(x => alphabet[~~(Math.random() * count)]).join("");

export function getProcessRandomIdentifier() {
    return processRandomIdentifier;
}

async function createTempFolderName(): Promise<string> {
    let pid = process.pid;
    let startTime = (await currentProcessInfo).StartTime;

    ensureWatchdogExists();

    return "tmp" + "_" + pid + "_" + +startTime + "_" + processRandomIdentifier;
}
export function parseTempFolderName(folderName: string): {
    pid: number;
    startTime: Date;
    randomPart: string;
} {
    let parts = folderName.split("_");
    return {
        pid: +parts[1],
        startTime: new Date(+parts[2]),
        randomPart: parts[3],
    };
}

const watchdogWriteTime = 1000 * 60;
const watchdogStaleTime = 1000 * 60 * 5;

const watchdogMarkFile = os.tmpdir() + "/temp-file_watchdog_mark";
export function ensureWatchdogExists(): void {
    (async () => {
        try {
            if(!await doesWatchdogExist()) {
                let watchdogPath = __dirname + "/watchdog.js";
                
                //execPromise(`start cmd /c "node ${watchdogPath}"`);
                ///*
                var child = spawn(`node`, [watchdogPath], {detached: true, stdio: [ "ignore", "ignore", "ignore" ], windowsHide: true } as any);
                child.unref();
                //*/
                console.log(`Spawned new watchdog`);
            }
        } catch(e) {
            console.error(`Ensure watchdog exists check failed.`, e);
        }
    })();
}
async function doesWatchdogExist(): Promise<boolean> {
    // Launch watchdog if it doesn't exist.
    let watchdogStats;
    try {
        watchdogStats = await statPromise(watchdogMarkFile);
    } catch(e) {
        watchdogStats = null;
    }

    return watchdogStats !== null && +new Date() - (watchdogStats as any).mtimeMs < watchdogStaleTime;
}

function startWatchdogHeartbeatLoop(): void {
    (async () => {
        try {
            while(true) {
                let currentMark = getProcessRandomIdentifier();
                try {
                    currentMark = await readFilePromise(watchdogMarkFile)
                } catch(e) { }
                if(currentMark !== getProcessRandomIdentifier()) {
                    throw new Error(`Another watchdog appears to exist, so we are closing`);
                }
                // Update our mark, so the file time is recent enough to prove we are living.
                await writeFilePromise(watchdogMarkFile, currentMark);
                await SetTimeoutAsync(watchdogWriteTime);
            }
        } catch(e) {
            console.error(`Heartbeat loop died. This isn't good. Killing process.`, e);
            process.exit();
        }
    })();
}

export async function registerWatchdog(): Promise<void> {
    // Exit if there is already another primary watchdog
    
    if(await doesWatchdogExist()) {
        console.log(`Another watchdog already exists, so closing ourself.`);
        process.exit();
    }

    startWatchdogHeartbeatLoop();
}