package database

import (
	"archive/zip"
	"bytes"
	"embed"
	"io"
	"io/fs"
	"strings"
)

//go:embed sample
var sampleFS embed.FS

// packEmbeddedSample packs the embedded "hello-world-turns" sample project into
// an in-memory ZIP archive. Embedding the sample into the binary guarantees the
// seed data is available regardless of the runtime filesystem (e.g. inside the
// minimal Docker image, which does not ship the source tree).
//
// Archive entries are stored relative to the "sample" directory (e.g.
// "main.py", "helpers/turn_utils.py") so they unpack directly, which is the
// layout the worker expects when it unpacks a version bundle.
func packEmbeddedSample() ([]byte, error) {
	buf := new(bytes.Buffer)
	zw := zip.NewWriter(buf)

	root := "sample"
	if err := fs.WalkDir(sampleFS, root, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		// Skip directories; the zip format derives them from file paths.
		if d.IsDir() {
			return nil
		}

		// Derive the in-archive name relative to the root (e.g. "sample/main.py" -> "main.py").
		if path == root {
			return nil
		}
		rel := strings.TrimPrefix(path, root+"/")
		if rel == "" {
			return nil
		}

		fh, err := zw.Create(rel)
		if err != nil {
			return err
		}
		f, err := sampleFS.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(fh, f)
		closeErr := f.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	}); err != nil {
		_ = zw.Close()
		return nil, err
	}

	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
