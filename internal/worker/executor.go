package worker

import (
	"os/exec"
	"path/filepath"
	"strings"
)

func buildCommand(runtime, entrypoint, workdir string) (*exec.Cmd, error) {
	switch strings.ToLower(runtime) {
	case "python", "python3":
		return exec.Command("python3", entrypoint), nil
	case "node", "javascript":
		return exec.Command("node", entrypoint), nil
	case "bash", "shell":
		return exec.Command("bash", entrypoint), nil
	case "binary":
		return exec.Command(filepath.Join(workdir, entrypoint)), nil
	default:
		if strings.Contains(entrypoint, " ") {
			parts := strings.Fields(entrypoint)
			return exec.Command(parts[0], parts[1:]...), nil
		}
		return exec.Command(entrypoint), nil
	}
}
