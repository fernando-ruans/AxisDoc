//go:build windows

package main

import "os/exec"

func openExternal(path string) error {
	return exec.Command("cmd", "/c", "start", "", path).Start()
}

func revealExternal(path string) error {
	return exec.Command("explorer", "/select,", path).Start()
}
