# Selected proposal import

The importer is implemented in `importer.py`; the rich internal contract is
`imported_data_dto.py`. The selection manifest is `data/example-selection.json`.
Run commands below from `backend/` using the project's virtual environment.

## Structured example enrichment

The selected batch has also been formatted using `format_examples.py` and the
source-anchored interpretations in `data/proposal-enrichment.json`. On November
13, approximately 2:23 p.m. Eastern, all 24 existing `imported_proposals` records
were updated in place and read back successfully: 24 summaries, 52 evidence-linked
features, category-specific details, extracted date mentions for 19 records,
16 representative source points and eight citywide examples.

```sh
.venv/bin/python format_examples.py
.venv/bin/python format_examples.py --write
```

The first command makes `data/proposals.formatted.json` locally. The second
reads the selected records from MongoDB, validates the complete batch, updates
only enrichment fields and verifies the saved values by reading them back.
Existing IDs, raw snapshots, published proposals and feedback are preserved.
Existing nonempty summaries/features/versions are retained. Source-content hashes
must match the curated evidence before enrichment is applied. This is a selected
example formatter, not an automatic semantic extractor for arbitrary new notices.

Status is dated to the source notice, not a claim of current consultation status.
Dates retain their original context and need verification before being used as
deadlines. Representative map points use an actual supplied address coordinate;
they are not surveyed project boundaries and remain geographically unverified.
One version is stored for the notice snapshot; no municipal revision is invented.
Unsupported amounts, impacts, neighbourhoods and current participation remain
unknown. The app still needs its own catalogue-fetch/display integration.

## What was downloaded

Two unmodified Toronto Public Notices JSON responses were fetched for research:

| Publication-date window | Records | Temporary raw download |
| --- | ---: | --- |
| January 1–November 13, 2026 | 648 | `/private/tmp/civic-toronto-notices-2026.json` |
| January 1–December 31, 2025 | 644 | `/private/tmp/civic-toronto-notices-2025.json` |

The original 2026 response is approximately 5.1 MB. These are public notices,
including descriptions, official contacts, address coordinates and source links;
they are not 648 ready-to-display proposals and were not written to MongoDB.

A portable archive of only the **24 selected original records** is committed as
`sources/imports/toronto-notices-examples.raw.json`. It includes both source-feed
URLs and their file hashes. The temporary downloads are not required to run the
default import. Original descriptions contain HTML; the importer derives plain
text and stores the raw records separately for provenance.

## First batch

Four examples in each group:

| Group | Selected examples |
| --- | --- |
| Planning | Labatt/River towers; Augusta hotel; Neilson housing/medical site; Lawrence Heights revitalization |
| Heritage | Lawrence designation intention; Weston demolition decision; Stotts' Bridge alteration; Queen Street designation amendment |
| Transportation | Lawrence road closure; permit-parking area 1E; Aren Levy Lane renaming; Six Points road closures |
| Licensing | Nightclub definition; business licence action plan; street vending rules; permit-parking exclusion procedure |
| Financial | RentSafeTO sign fee; ravine permit fees; budget-wide user fees; site-plan application fees |
| City property dispositions | Fleet Street proposed lease; Sheppard lane portions; Van Horne property; Woodbine property |

These are explicitly selected examples, not a representative public sample.
The manifest records a stable proposal key and selection reason for each notice.
The financial group deliberately includes fee proposals that the source tags as
Licensing, or leaves untagged. Original topics remain alongside our category.
The City property category includes a proposed lease; it is not all outright
sales. The 2025 archive supplies two additional distinct property matters.

Sixteen selected records have source coordinates; eight have no source address.
Coordinates are retained as unverified address points. A primary `map_point`
remains unset until checked, particularly for matters involving several sites.
The importer does not place citywide policies at the City Hall contact address.

## Run and inspect

```sh
.venv/bin/python importer.py
```

This is a dry run: it validates the full selected batch and writes the rich
normalized records to `data/proposals.preview.json`, without contacting MongoDB.
That preview is ignored by Git and can be regenerated from the committed archive.

To save the selected records using the private backend `.env` configuration:

```sh
.venv/bin/python importer.py --write
```

Writes go to **`imported_proposals`** and **`source_notices`**, not the legacy
`proposals` collection or participant feedback collections. Stable
proposal keys become MongoDB `_id` values. Raw notice snapshots use IDs composed
of notice ID and content hash, preserving older source content.

Re-import refreshes imported facts and adds source snapshot references. It
preserves summaries, features, versions, review notes and other editorial fields.
Changed source content marks an existing reviewed import as needing review.
Writes are repeatable but the entire multi-document batch is not transactional:
if the network fails halfway through, fix the connection and rerun it.

Fetch a newer complete source response, then use the same selection manifest:

```sh
.venv/bin/python importer.py --fetch data/notices.download.json --from-date 2025-01-01 --to-date 2026-11-13
```

The fetch mode has a request timeout and response-size limit. Alternatively,
pass `--input /path/to/download.json`; repeat `--input` to combine date windows.
All selected IDs must exist in the combined input. Duplicate IDs with conflicting
contents cause an error rather than silently choosing a snapshot. Several source
records are grouped only when their manifest entries share an explicit proposal
key; titles alone never merge records.

## Rich optional fields

| Group | Fields |
| --- | --- |
| Identity/classification | Stable ID, title, main/additional categories, original topics, municipality |
| Provenance | Source notice IDs/URLs, publication timestamps, original plain text, subheading, decision body, signer, content hash, snapshot history |
| Geography | Multiple addresses, GeoJSON address points, neighbourhood, geographic scope and reviewed primary map point |
| Procedure/evidence | Application numbers, agenda-item IDs, municipal-code chapters, ward labels, linked documents and public staff contacts |
| Interpretation | Summary, reason, benefits, concerns, trade-offs, affected groups and unresolved questions |
| Participation | Official route, methods/instructions, separate speaker/comment deadlines, accessibility instructions and verification time |
| Dates | Typed meeting, decision, effective-date and appeal-deadline records, each with evidence and verification state |
| Feedback/revisions | Feature IDs/questions, proposed changes, version snapshots, source-linked changes, current version ID |
| Category detail | Planning uses/units/heights; heritage actions/attributes; transport modes/access/hours; financial amounts/exemptions; licensing rules/business types; property disposition/use/area/conditions |
| Review | Review state, specific issues, review date and reviewer notes |

In enrichment fields, `null` means not established or not extracted. An empty
list should mean someone established that there are no entries. Importer-owned
lists describe only what the source supplied; absence is not proof that the
real-world fact does not exist. Date publication is not a meeting or deadline.
Source notice kind is not the current procedural status. Optional scalar fields
are nullable; extra unrecognized enrichment fields are rejected to catch typos.

The import does **not** invent summaries, infer personal effects, assume an
adopted decision is still open, infer deadlines from meetings, or treat repeated
source notices as confirmed participant responses. All 24 initially need review.
The raw API's event arrays were empty even for notices containing meeting dates
in their HTML descriptions. The raw-import step leaves these unknown; the
example formatter subsequently extracts date mentions and available archived
participation instructions while retaining their context and review flags.

The frontend API uses the separate `proposals_DTO.py` display contract.
`service/service.py:to_display_proposal` now converts records from
`imported_proposals` on read. `/api/proposals` serves the 24 imported examples
without copying them into the old collection. Feature questions use imported
feature IDs, and feedback aggregates are attached to these same imported
records. Null coordinates remain list-only, and archived source statuses stay
explicitly labelled. Source/current-participation review remains separate from
this mechanical conversion.

## Verification

```sh
.venv/bin/python -m unittest test_importer -v
```

Checks cover 24 unique examples/four per group, missing event/location handling,
GeoJSON order, explicit grouping versus equal titles, missing selected IDs,
plain-text extraction, repeat-import preservation and changed-source review.
They use an in-memory collection double and require no live database.

Last verified November 13, approximately 1:10 p.m. Eastern: local dry run and all
eight regression checks passed. Live import inserted 24 records into
`civic_hack.imported_proposals`. An independent read-back validated all 24 against
the rich schema, confirmed four per category and verified all 24 raw snapshots
in `source_notices`. The prior automatic-approval failure is resolved for this
write. Live fetch through the Python importer remains untested; the archived
source download itself was verified separately using HTTP.

Sources: [Toronto API documentation](https://secure.toronto.ca/nm/opendata.do),
[selected 2026 feed](https://secure.toronto.ca/nm/notices.json?noticeDateFrom=2026-01-01&noticeDateTo=2026-11-13&locationId=1),
[selected 2025 feed](https://secure.toronto.ca/nm/notices.json?noticeDateFrom=2025-01-01&noticeDateTo=2025-12-31&locationId=1).
