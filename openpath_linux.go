//go:build linux

package main

import "os/exec"

func openExternal(path string) error {
	return exec.Command("xdg-open", path).Start()
}

func revealExternal(path string) error {
	return exec.Command("xdg-open", path).Start()
}
