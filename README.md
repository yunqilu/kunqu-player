# Kunqu Vocal Annotation Player · Seeking the Dream

A synchronized reading player for Gu Weiying's (顾卫英) performance of *Seeking the Dream* (寻梦, Xún Mèng), a scene from *The Peony Pavilion* (牡丹亭). The video, the lyrics character by character, the gongche notation (工尺谱, the traditional Kunqu score), the vocal ornaments (腔格, qiāng-gé), the breath points and the stage movements are all aligned on one timeline.

The `yunqi/phrasing` branch added three things:

- **Phrasing.** The 427 annotated characters are regrouped into 75 phrases at the comma level of the libretto. A Python backend computes this.
- **Outline in the left column.** Two levels, qupai (曲牌, a named tune pattern) and then phrase. Inferred phrases are set apart with a dashed border and a lighter colour.
- **Duration layout.** One phrase per row, with each character block as wide as it is long in time. Four tracks (gongche, ornaments, breath, movement) can be switched on and off, and clicking any unit plays from that point.

The `yunqi/english` branch added three more on top:

- **Auto-loaded video.** Put the recording in `media/` and the page plays it on load.
- **English interface.** A `中 / EN` switch (中 means "Chinese") in the header, defaulting to English. The lyrics, the movement names and the gongche symbols are always Chinese.
- **Per-phrase English subtitles.** One English translation per phrase, shown in a bar directly under the video.

## Running

You only need Docker Desktop and `make`. Nothing is installed on the host: Node and Python both run in containers.

```bash
make build   # the first time, or after changing dependencies
make up      # start the backend and the frontend
```

Then open <http://127.0.0.1:5173>.

### Video

Put the recording of *Seeking the Dream* at `media/xunmeng.mp4` in the repository. The page loads it when it opens, and the progress bar can be dragged:

```bash
mkdir -p media
cp /path/to/your/video.mp4 media/xunmeng.mp4
```

The video is not in the repository, and `media/` is in `.gitignore`. The CCTV recording is copyrighted and this repository is public; GitHub also limits a single file to 100 MB. The video stays on your machine and the backend reads it for the page.

- To keep the video somewhere else, set the `MEDIA_DIR` environment variable of the api container (default `/work/media`, which is `media/` in the repository) and mount that directory into the container.
- When there is no video, the page shows a hint and keeps the entry at the top right: paste a direct URL or choose a local file. Once a video has loaded, the entry collapses into a `Change video` button.
- Without a video you can still press ▶ or Space to preview the sync on a virtual timeline.

### Interface language

The `中 / EN` switch at the right of the header changes the interface language. The choice is kept in the browser's localStorage. You can also add `?lang=zh` or `?lang=en` to the address. The default is English.

In the English interface:

- Qupai names are shown as toned pinyin (`Lǎn Huà Méi`) and are not translated by meaning.
- Ornament names show pinyin on the block and "pinyin (English gloss)" on hover, for example `sǒu-qiāng (tremolo ornament)`.
- The evidence for each phrase (hover a phrase in the left column) is rendered in English from structured items.
- **The lyrics, the labels on the movement track (指 "point", 开扇 "open the fan", 相 "pose" and so on) and the gongche symbols are not translated.**

All copy is data. Interface text is in `src/i18n/zh.js` and `en.js`, qupai pinyin in `qupai.js`, the ornament glossary in `terms.js`, and the synopsis in `src/data/meta.js`. No i18n dependency is used.

### English subtitles

The subtitle bar sits directly under the video. A subtitle appears when its phrase starts and fades when the phrase ends. When the gap between two phrases is shorter than 0.4 seconds it does not fade and switches straight to the next phrase. `EN subtitles` in the header turns the bar off. The subtitles are not laid over the picture because the recording has Chinese subtitles burned into the bottom of the frame.

The translations are in `data/translations/xunmeng.en.json`. They were written for this project and are not taken from any published translation. Each entry is keyed by the performed text, a `#`, and the occurrence number (for example `秀才#2`, the second time 秀才 "scholar" is said) rather than by phrase id, so the keys stay correct when the phrasing changes.

To review the translations:

1. `make phrases` prints the Chinese and English side by side.
2. Edit `en` (70 characters at most). Put allusions and wordplay in `note`; the note shows when you hover the subtitle.
3. Change `status` from `draft` to `reviewed` on each entry you have checked. The `draft` mark at the right of the subtitle bar then stops appearing.
4. Run `make down && make up` so the backend reads the file again, and `make test` to check that every phrase has exactly one translation.

### Commands

| Command | What it does |
|---|---|
| `make help` | List all commands |
| `make build` | Build both images |
| `make up` / `make down` | Start / stop (frontend on `127.0.0.1:5173`, backend on `127.0.0.1:8000`) |
| `make logs` | Follow the container logs |
| `make test` | Run pytest and Vitest in the containers |
| `make smoke` | Start the backend, request the phrasing endpoint once and check the key numbers |
| `make verify` | `test` + `smoke` |
| `make phrases` | Print the phrasing result (phrases, English translations, status, evidence) for checking by hand |
| `make lyrics` | Regenerate the lyric txt from the docx |
| `make clean` | Remove the containers, volumes and this project's images |

The backend's API documentation is at <http://127.0.0.1:8000/docs>.

## Architecture

```
src/data/viewerModel.json ─┐
data/raw/xunmeng-lyrics.txt ├─► backend/app/pipeline.py ─► GET /api/pieces/{id}/phrases
data/review/phrasing-overrides.json ┤                                   │
data/translations/xunmeng.en.json ──┘                                   │
                                                                         ▼
                                        src/lib/model.js (loadModel) ─► Vue components
```

The backend does the phrasing and assigns track content to phrases. The frontend only draws and handles interaction; it does not compute results.

| Location | Contents |
|---|---|
| `backend/app/pipeline.py` | Phrasing: parse the libretto, align it with the performed characters, handle characters that do not match, the tail section, and assigning tracks to phrases |
| `backend/app/models.py`, `api.py` | Response models and routes |
| `backend/app/media.py`, `src/lib/video.js` | Video: the backend finds the file, the frontend probes for it and loads it |
| `backend/app/evidence.py` | Structured evidence items and their Chinese templates |
| `backend/app/translations.py` | Merges the per-phrase translations into the phrases |
| `src/i18n/` | Interface language: `lang`, `t()`, the two key tables, qupai pinyin, the ornament glossary |
| `src/lib/subtitle.js`, `components/SubtitleBar.vue` | Subtitles: which phrase to show at a given time (a pure function) and the bar |
| `src/lib/model.js` | `loadModel()` fetches the data and fills the `model` shared by the whole app |
| `src/lib/outline.js`, `components/LeftColumn.vue` | The two-level outline in the left column |
| `src/lib/flowLayout.js`, `flowPrefs.js`, `components/PhraseFlow.vue` | The duration layout |
| `src/score/`, `components/ScoreReviewPanel.vue` | The conversion core from gongche notation to staff notation, and its review interface. It does not go through the backend; see `CONTEXT.md` |

`src/main.js` waits for `loadModel()` before loading the interface, because the playback clock reads the piece's time span when it is created.

### API

| Path | Returns |
|---|---|
| `GET /api/health` | `{"ok": true}` |
| `GET /api/pieces` | The list of pieces |
| `GET /api/pieces/{piece_id}/phrases` | The phrasing result. Each phrase carries `evidence_items` (structured evidence) and `en` / `en_status` / `en_note` (the translation). An unknown piece returns 404 with an explanation |
| `GET`, `HEAD /api/pieces/{piece_id}/video` | The video in `media/`, with HTTP Range support. A missing file or an unknown piece returns 404 with an explanation |

## How the phrasing is derived

1. The libretto is cut into clauses at punctuation, qupai titles, role markers and stage directions.
2. The performed character sequence is aligned with the libretto. Characters that match go to the corresponding clause.
3. Extra characters in the performance (padding syllables, 衬字 chènzì) go to the previous or the next phrase, according to the grouping in the original annotation or the time gaps.
4. The closing passage, which the libretto does not cover, is cut into the phrases listed by hand in `data/review/phrasing-overrides.json`.

Every phrase carries a status and its evidence, so an inference is never presented as fact. The evidence has two forms: the Chinese text `evidence`, and a matching list `evidence_items` (`{code, params}`) that the frontend renders in the interface language.

| Status | Meaning | In the interface |
|---|---|---|
| `confirmed` | Every character agrees with the libretto | Plain style |
| `variant` | Differs from the libretto: a changed character, a padding syllable, or an omission | A `var` mark (异 "differs" in the Chinese interface). The differing characters are underlined, and hovering shows the libretto text |
| `inferred` | Not in the libretto; the break was inferred by hand | Dashed border and lighter colour. Hovering shows the evidence (meaning, pause in seconds, breath point) |

The current result is 47 `confirmed`, 14 `variant` and 14 `inferred` phrases. Parts of the libretto that were not performed (the whole aria 豆叶黄, Dòu Yè Huáng, among others) are listed under `omitted` in the response. Characters excluded by hand (one, annotated as `哭？`, "cry?", with a question mark in the source) are listed under `excluded`; the time such a character occupied is shown as a blank in the view.

To change how the closing passage is cut, or to exclude another character, edit `data/review/phrasing-overrides.json`, then run `make down && make up` and check with `make phrases`. Every `note` and `reason` needs an English `note_en` or `reason_en` beside it; the backend reports an error if one is missing. The phrases must join up to exactly the text of that passage, otherwise the backend reports an error instead of accepting it silently.

## Data sources

- `src/data/viewerModel.json`: per-character timing, gongche, ornaments, breath and movement annotations. Read-only.
- `data/raw/xunmeng-lyrics.docx`: the libretto (by Tang Xianzu, public domain). The original source, read-only.
- `data/raw/xunmeng-lyrics.txt`: derived from the docx. The backend reads only this file, and a test checks that the two agree.
- `data/translations/xunmeng.en.json`: the per-phrase English translations, original work. All of them are currently `draft`, awaiting review.
- `media/xunmeng.mp4`: the performance recording. Not in the repository; see "Video" above.

## Known limitations

- **The backend is required.** The single-file `dist/index.html` produced by `npm run build` can no longer be opened by double-clicking. See `docs/adr/0020-compute-phrasing-in-a-python-backend.md` for the reason.
- **Restart the services after changing the libretto, the overrides or the translations.** The phrasing result is cached in the backend process.
- **No subtitles in fullscreen.** The subtitle bar is outside the video and does not go fullscreen with it.
- **The translations are drafts.** All 75 are marked `draft` and have not been reviewed by a person. The English glosses for the ornaments are drafts too.
- **Backend error messages are in Chinese.** The English interface shows an English explanation chosen by status code, with the original Chinese underneath.
- **Width differences in the duration layout are subtle.** The width is `28 + 18·√duration`, so a one-second character and a two-second character differ by only a few pixels. The constants are in `src/lib/flowLayout.js`.
- **Gongche notes in a long melisma are staggered over at most three rows.** Denser passages overlap.
- **There is only one piece.** The API is designed around piece ids, but the frontend currently hard-codes `xunmeng`.
- Sync with a real video loaded and the narrow-window layout have not been tested systematically.

## Terms and decision records

Domain terms are in `CONTEXT.md`, and architecture decisions are in `docs/adr/`.
