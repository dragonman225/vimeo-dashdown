const fs = require('fs');
const path = require('path');
const https = require('https');
const url = require('url');
const rl = require('readline');
const atob = require('atob');
const argv = require('minimist')(process.argv.slice(2), {
    default: {
        input: './output/master.json',
        output: './output',
        video: '0',
        audio: '0',
        debug: false
    },
    alias: {
        i: 'input',
        o: 'output',
        v: 'video',
        a: 'audio'
    }
});

const FUNCTION = argv._[0];
const DASH_JSON_PATH = argv.input;
const DASH_JSON_URL = argv._[1];
const OUTPUT_DIR = argv.output;
const VIDEO_STREAM_INDEX = argv.video;
const AUDIO_STREAM_INDEX = argv.audio;
const DEBUG = argv.debug;

function showHelp() {
    console.log('Help not completed.');
}

function getQualityOptions(dashJSONPath) {
    // Read & Parse JSON
    let dashJSONStr = fs.readFileSync(dashJSONPath, { encoding: 'utf-8' });
    let dashObj;
    try {
        dashObj = JSON.parse(dashJSONStr);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
    // Get options
    let videoOpts = dashObj.video.map((video) => { return `${video.width}x${video.height}` });
    let audioOpts = dashObj.audio.map((audio) => { return `${audio.avg_bitrate / 1000}k` });
    return { video: videoOpts, audio: audioOpts };
}

function downloadDashJSON(dashJSONUrl, outputDir) {
    // Create New File Stream
    var dashJSONFile = fs.createWriteStream(path.join(outputDir, 'master.json'), { encoding: 'utf-8' }).on('finish', () => {
        return { msg: 'success' };
    });
    // Make HTTPS Request for JSON
    var dashJSONRequest = https.get(dashJSONUrl, (response) => {
        response.pipe(dashJSONFile);

        response.on('end', (e) => {
            // Don't have to unpipe
        }).on('error', (e) => {
            console.error(e);
        });
    }).on('error', (e) => {
        console.error(e);
    });
}

function downloadAllSegments(dashJSONPath, baseURL, videoOption, audioOption, outputDir) {
    // Read & Parse JSON
    let dashJSONStr = fs.readFileSync(dashJSONPath, { encoding: 'utf-8' });
    let dashObj;
    try {
        dashObj = JSON.parse(dashJSONStr);
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
    // Download all segments
    let videoOutputDir = path.join(outputDir, 'video/');
    let audioOutputDir = path.join(outputDir, 'audio/');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }
    if (!fs.existsSync(videoOutputDir)) {
        fs.mkdirSync(videoOutputDir);
    }
    if (!fs.existsSync(audioOutputDir)) {
        fs.mkdirSync(audioOutputDir);
    }
    let video = dashObj.video[parseInt(videoOption)];
    let audio = dashObj.audio[parseInt(audioOption)];
    // Save init segment
    let initSegment = decodeInitSegment(video.init_segment);
    fs.writeFile(path.join(videoOutputDir, `${video.id}-init.mp4`), initSegment, "binary", (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`${video.id}-init.mp4 was saved!`);
        }
    });
    initSegment = decodeInitSegment(audio.init_segment);
    fs.writeFile(path.join(audioOutputDir, `${audio.id}-init.aac`), initSegment, "binary", (err) => {
        if (err) {
            console.log(err);
        } else {
            console.log(`${audio.id}-init.aac was saved!`);
        }
    });
    // Save other segments
    downloadNextSegment(video.id, url.resolve(baseURL, dashObj.base_url), video.base_url, video.segments, videoOutputDir);
    downloadNextSegment(audio.id, url.resolve(baseURL, dashObj.base_url), audio.base_url, audio.segments, audioOutputDir);
}

function downloadNextSegment(contentId, baseURL, contentURL, segments, outputDir) {
    var segment = segments.shift();
    rl.cursorTo(process.stdout, 0, 0);
    rl.clearScreenDown(process.stdout);
    console.log(`[${outputDir}] Now: ${segments.length} segments left.`);

    if (segment) {
        downloadSegment(contentId, baseURL, contentURL, segment.url, outputDir, (e) => {
            downloadNextSegment(contentId, baseURL, contentURL, segments, outputDir);
        });
    }
}

function downloadSegment(contentId, baseURL, contentURL, segmentURL, outputDir, callback) {
    let segmentFile = fs.createWriteStream(path.join(outputDir, contentId + '-' + segmentURL)).on('finish', () => {
        console.log(`Downloaded: ${segmentURL}`);
    });

    if (DEBUG) {
        console.log(url.resolve(baseURL, url.resolve(contentURL, segmentURL)));
        return;
    }

    let request = https.get(url.resolve(baseURL, url.resolve(contentURL, segmentURL)), (response) => {

        console.log('statusCode:', response.statusCode);

        response.pipe(segmentFile);

        response.on('end', (e) => {
            segmentFile.end();

            if (callback) {
                // A call to retrieve the next segment
                callback(e);
            }
        }).on('error', (err) => {
            console.error(err);
        });
    }).on('error', (err) => {
        console.error(err);
    });
}

function decodeInitSegment(e) {
    for (var t = atob(e), n = t.length, i = new Uint8Array(n), r = 0; r < n; r++) {
        i[r] = t.charCodeAt(r);
    }
    return i;
}

// Main Program
switch (FUNCTION) {
    case 'help':
        showHelp();
        break;
    case 'list':
        let options;
        if (fs.existsSync(DASH_JSON_PATH)) {
            options = getQualityOptions(DASH_JSON_PATH);
        } else {
            console.error(`DASH JSON does not exist! (${DASH_JSON_PATH})`);
            break;
        }
        console.log('Video Options:');
        options.video.forEach((resolution, index) => {
            console.log(`\t(${index}) ${resolution}`);
        });
        console.log('Audio Options:');
        options.audio.forEach((avg_bitrate, index) => {
            console.log(`\t(${index}) ${avg_bitrate}`);
        });
        break;
    case 'download':
        if (!DASH_JSON_URL) {
            console.error('Require the DASH JSON URL!');
            break;
        }
        if (!fs.existsSync(DASH_JSON_PATH)) {
            console.error(`DASH JSON does not exist! (${DASH_JSON_PATH})`);
            break;
        }
        let url = DASH_JSON_URL;
        let baseJSONURL = url.replace(/\?(?:[^=]+?=[^&]+?)*?$/g, '').replace(/\?base64\/(?:\d+,?)+\/.+$/g, '');
        downloadAllSegments(DASH_JSON_PATH, baseJSONURL, VIDEO_STREAM_INDEX, AUDIO_STREAM_INDEX, OUTPUT_DIR);
        break;
    default:
        showHelp();
}

if (DEBUG) {
    console.log(argv);
}