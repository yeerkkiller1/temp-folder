import { execFile, spawn } from "child_process";
import { watch, exists, readdir } from "fs";
import { tempFolderDir, parseTempFolderName, registerWatchdog } from "./temp-file";
import { GetInfoChannel } from "p-info";
import { SetTimeoutAsync } from "pchannel";


function existsPromise(path: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
        exists(path, (exists) => {
            resolve(exists);
        });
    });
}

function execFilePromise(command: string, args: string[]): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        execFile(command, args, (err, stdout, stderr) => {
            err = err || stderr;
            err ? reject(err) : resolve(stdout);
        });
    });
}


function watchFolder(
    dir: string,
    onNew: (folderName: string) => void
): Promise<void> {
    watch(dir, async (eventType, fileName) => {
        let tempFolder = await tempFolderDir();
        if(eventType !== "change" && await existsPromise(tempFolder + fileName)) {
            onNew(fileName);
        }
    });
    return new Promise<void>((resolve, reject) => {
        readdir(dir, (err, files) => {
            if(err) {
                reject(err);
                return;
            }

            for(let file of files) {
                onNew(file);
            }

            return resolve();
        });
    });
}

let checkFolderDelay = 0;
let watchedFolders: { [folderName: string]: true } = {};

checkWatchedFolders();
function checkWatchedFolders() {
    (async () => {
        try {
            console.log(`Starting check folders loop`);
            while(true) {
                console.log(`Checking folders, count: ${Object.keys(watchedFolders).length}`);
                let checkTime = +new Date();

                let tempFolder = await tempFolderDir();
                for(let folderName of Object.keys(watchedFolders)) {
                    console.log(`Checking ${folderName}`);
                    // If the folder no longer exists, stop watching it.
                    if(!await existsPromise(tempFolder + folderName)) {
                        console.log(`Folder no longer exists, nolonger watching it ${folderName}`);
                        delete watchedFolders[folderName];
                    } else {
                        await deleteIfProcessGone(folderName);
                    }
                }

                checkTime = +new Date() - checkTime;

                // Don't spend more than 10% of the time in the loop. This should be a background task, and not take too long.
                checkFolderDelay = Math.max(10000, checkTime * 10);
                if(checkTime > 1000 * 60) {
                    console.log(`Checking temporary folders for process existence took a long time. ${~~(checkTime / 1000)} seconds.`);
                }

                await SetTimeoutAsync(checkFolderDelay);
            }
        } catch(e) {
            console.error(`Watchdog loop died. This isn't good. Killing process`, e);
            process.exit();
        }
    })();
}



(async () => {
    let tempFolder = await tempFolderDir();

    await registerWatchdog();

    console.log({ tempFolder });
    
    await watchFolder(tempFolder, async (folderName) => {
        try {
            console.log(`Starting to watch ${folderName}`);
            watchedFolders[folderName] = true;
        } catch(e) {
            console.error(`Could not check folder ${folderName}, because of error: ${e.toString()}`);
        }
    });
})();


async function deleteIfProcessGone(folderName: string): Promise<void> {   
    let tempFolder = await tempFolderDir();

    let processExists = await doesProcessExist(folderName);
    if(!processExists) {
        let path = tempFolder + folderName;
        console.log(`Deleting folder ${path}`);
        await new Promise<void>((resolve, reject) => {
            spawn("rm", ["-rf", path], { windowsHide: true } as any)
                .on("error", err => {
                    reject(err);
                })
                .on("close", () => {
                    resolve();
                });
        });
        delete watchedFolders[folderName];
    } else {
        console.log(`Folder still exists ${folderName}`);
    }
}

let infoChannel = GetInfoChannel();
async function doesProcessExist(folderName: string): Promise<boolean> {
    let folderInfo = parseTempFolderName(folderName);
    
    let info;
    try {
        info = await infoChannel(folderInfo.pid);
    }
    catch(e) {
        console.log(`folder being deleted, because of error when getting process id. ${folderName}, ${folderInfo.pid}, ${String(e)}`);
        return false;
    }

    if(+folderInfo.startTime !== +info.StartTime) {
        console.log(`folder being deleted, because StartTime is different. ${folderName}, ${folderInfo.pid}, Folder: ${+folderInfo.startTime}, Process: ${+info.StartTime}`);
        return false;
    }
    return true;
}