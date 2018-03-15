# vimeo-dashdown
_Download Vimeo videos in MPEG-DASH format_

### Usage
------
`node vimeo-dashdown.js {FUNCTION} {DASH_JSON_URL} [OPTIONS]`

### Arguments
----------
#### `{FUNCTION}`

`list`

List available audio and video qualities for download.

`download`

Start download.

#### `{DASH_JSON_URL}` 

_Only necessary in `download` function_

URL of the `master.json` file. Play the Vimeo video with the network tab of your browser's web inspector open and look for `master.json?base64_init=1` or something similar e.g. `master.json?xxx`. Save this file to local disk and include with `--input` option.

#### `[Options]`

`--input={string}` or `-i {string}`

Input MPEG-DASH JSON index file. Default is `./output/master.json`

`--output={string}` or `-o {string}`

Output directory for the downloaded files. Default is `./output`.

`--video={number}` or `-v {number}`

`--audio={number}` or `-a {number}`

Audio and Video quality. Use `list` function to find out.

`--debug=true|false`

Debug urls and argv. Default is `false`.

### Example
--------
* Show available resolutions
```bash
$ node vimeo-dashdown.js list -i ./master.json
Video Options:
        (0) 640x360
        (1) 1280x720
        (2) 1920x1080
        (3) 960x540
Audio Options:
        (0) 128k
        (1) 256k
```

* Start download with desired audio and video quality
```
$ node vimeo-dashdown.js download -i ./master.json -o ./output -v 2 -a 1 https://4skyfiregce-vimeo.akamaized.net/.../video/9560744...074412/master.json
```

* After downloading, there are two folders in the directory specified in `--output` option.

    * `audio`: Audio init_segment and other segments.

    * `video`: Video init_segment and other segments.

* One example for concatenating segments:

    * Inside `video/`, issue commmand `cat {id}-init.mp4 $(ls -vx {id}-segment-*.m4s) > ../video.mp4`

    * For merging audio and video, try playing with VLC or using FFMpeg.

### Bugs
------
* Unable to seek to specific time in the concatenated media.  

### Todos
------
* Download JSON with this tool and improve workflow.
* Interactive CLI for quality options.