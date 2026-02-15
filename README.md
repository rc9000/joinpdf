# wasm-merge

Browser-only PDF merge using `pdfcpu.wasm`.

## Run

From this folder:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` and:
1. Select 2 to 10 PDF files (order is preserved).
2. Optionally enable divider pages.
3. Optionally enable a generated cover page listing all selected documents.
4. Click **Merge PDFs** and download the result.

## Notes

- No server-side processing is used.
- `pdfcpu` runs in WebAssembly in the browser.
- Divider pages use `pdfcpu merge -d ...`.
- If both divider + cover are enabled, the app runs two merge passes so the cover page stays first and is not separated from content by an extra blank page.
