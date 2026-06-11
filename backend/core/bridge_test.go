package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func newTestBridge(t *testing.T) *FilamentBridge {
	t.Helper()

	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	bridge, err := NewFilamentBridge(&Config{DBFile: dbPath})
	if err != nil {
		t.Fatalf("failed to create bridge: %v", err)
	}
	t.Cleanup(func() {
		bridge.Close()
		os.RemoveAll(dir)
	})
	return bridge
}

func TestProcessedJobsDedup(t *testing.T) {
	bridge := newTestBridge(t)

	printerID := "printer_test"
	filename := "jobs/example.gcode"

	processed, err := bridge.IsJobProcessed(printerID, filename)
	if err != nil {
		t.Fatalf("IsJobProcessed failed: %v", err)
	}
	if processed {
		t.Fatal("job should not be processed initially")
	}

	if err := bridge.MarkJobProcessed(printerID, filename); err != nil {
		t.Fatalf("MarkJobProcessed failed: %v", err)
	}

	processed, err = bridge.IsJobProcessed(printerID, filename)
	if err != nil {
		t.Fatalf("IsJobProcessed failed: %v", err)
	}
	if !processed {
		t.Fatal("job should be marked processed")
	}

	if err := bridge.ClearProcessedJob(printerID, filename); err != nil {
		t.Fatalf("ClearProcessedJob failed: %v", err)
	}

	processed, err = bridge.IsJobProcessed(printerID, filename)
	if err != nil {
		t.Fatalf("IsJobProcessed failed: %v", err)
	}
	if processed {
		t.Fatal("job should be cleared after reprint start")
	}
}

func TestProcessFilamentUsageUnmappedSpoolAddsError(t *testing.T) {
	bridge := newTestBridge(t)

	err := bridge.ProcessFilamentUsage("TestPrinter", map[int]float64{0: 12.5}, "test.gcode")
	if err == nil {
		t.Fatal("expected error when no spool is mapped")
	}

	errors := bridge.GetPrintErrors()
	if len(errors) == 0 {
		t.Fatal("expected print error for unmapped spool")
	}
}

func TestProcessFilamentUsageDoesNotRemapAcrossMappedToolheads(t *testing.T) {
	bridge := newTestBridge(t)

	printerName := "Snapmaker U1"
	if err := bridge.SetToolheadMapping(printerName, 1, 42); err != nil {
		t.Fatalf("failed to map toolhead 1: %v", err)
	}

	err := bridge.ProcessFilamentUsage(printerName, map[int]float64{0: 9.15}, "test.gcode")
	if err == nil {
		t.Fatal("expected error when G-code targets extruder 0 but only toolhead 1 is mapped")
	}

	errors := bridge.GetPrintErrors()
	foundExtruder0Error := false
	for _, pe := range errors {
		if strings.Contains(pe.Error, "extruder 0") && strings.Contains(pe.Error, "Toolhead 1") {
			foundExtruder0Error = true
		}
	}
	if !foundExtruder0Error {
		t.Fatalf("expected explicit extruder 0 error, got %v", errors)
	}
}

func TestDefaultToolheadDisplayName(t *testing.T) {
	if got := DefaultToolheadDisplayName(0); got != "Toolhead 1" {
		t.Fatalf("expected Toolhead 1, got %q", got)
	}
	if got := DefaultToolheadDisplayName(3); got != "Toolhead 4" {
		t.Fatalf("expected Toolhead 4, got %q", got)
	}
}
