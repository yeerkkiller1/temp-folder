node node_modules/typescript/bin/tsc --watch -p tsconfig.d.ts.json &
node ./node_modules/run-when-changed/bin/run-when-changed.js --watch "./dist/temp-folder.d.ts" --exec "node ./node_modules/clean-typings-file ./dist/temp-folder.d.ts temp-folder" &
node node_modules/webpack/bin/webpack --progress --watch --env.node --display-error-details