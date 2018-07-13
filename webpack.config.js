var fs = require("fs");
var webpack = require("webpack");
var Visualizer = require("webpack-visualizer-plugin");

module.exports = env => {
    return [getConfig(env)];
}

function getConfig (env) {
    let node = env && !!env.node || false;

    let obj = {
        mode: "development",
        entry: {
            "temp-folder": "./src/temp-folder.ts",
            "watchdog": "./src/watchdog.ts",
        },
        output: {
            filename: "./[name].js",
            libraryTarget: "commonjs2"
        },

        // Enable sourcemaps for debugging webpack's output.
        devtool: "source-map",

        resolve: {
            // Add '.ts' and '.tsx' as resolvable extensions.
            extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
        },

        module: {
            rules: [
                // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
                { test: /\.tsx?$/, loader: "ts-loader" },
                { test: /\.less$/, loader: "style-loader!css-loader!less-loader" },
                { enforce: 'pre', test: /\.js$/, loader: "source-map-loader" },
            ]
        },

        plugins: [
            new webpack.DefinePlugin({
                TEST: false
            }),
            new Visualizer(),
        ],

        node: { __dirname: false },

        resolveLoader: {
            modules: ['node_modules']
        },
    };

    if (node) {
        obj["target"] = "node";
    }

    return obj;
};