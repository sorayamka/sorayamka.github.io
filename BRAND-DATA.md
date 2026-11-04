# Brand relations

`src/data/product-brands.json` records product ID to manufacturer slug/name
links extracted from the archived product HTML anchors containing
`/product_brand/`. 1,098 of the 1,120 products had those source links. The
remaining records are not assigned a manufacturer by guessing their title.

All 118 brand records have separate RU and EN pages. Named brand records
without their own archive slug are matched to product relations only by exact
normalized archived manufacturer name. Unresolved product links and supplier
documents are explicitly described as unavailable/unverified on that page.

Certificate matching uses explicit aliases or matching normalized archive
slugs, not a redirect to the general certificate directory. This does not
certify the legal validity or expiry of archived PDF documents.

The product index includes the archived manufacturer name and slug so brand
search works without changing product titles. Search normalizes repeated
whitespace. Cart changes are saved before replacing the in-memory state, so
a failed localStorage write does not retain an invisible pending operation.
