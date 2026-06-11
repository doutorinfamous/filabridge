package nfc

import (
	"path/filepath"
	"testing"

	"filabridge/core"
)

func TestParseLocationParamToolheadOneBased(t *testing.T) {
	dir := t.TempDir()
	bridge, err := core.NewFilamentBridge(&core.Config{
		DBFile:      filepath.Join(dir, "test.db"),
		SpoolmanURL: "http://127.0.0.1:1",
	})
	if err != nil {
		t.Fatalf("failed to create bridge: %v", err)
	}
	t.Cleanup(func() { bridge.Close() })

	if err := bridge.SavePrinterConfig("printer1", core.PrinterConfig{
		Name:      "My Printer",
		IPAddress: "127.0.0.1",
		Toolheads: 2,
	}); err != nil {
		t.Fatalf("failed to save printer config: %v", err)
	}

	printerName, toolheadID, locationName, isPrinterLocation, err := ParseLocationParam(bridge, "My Printer - Toolhead 1")
	if err != nil {
		t.Fatalf("ParseLocationParam failed: %v", err)
	}
	if !isPrinterLocation {
		t.Fatal("expected printer location")
	}
	if printerName != "My Printer" {
		t.Fatalf("expected printer name My Printer, got %q", printerName)
	}
	if toolheadID != 0 {
		t.Fatalf("expected toolhead_id 0 for Toolhead 1, got %d", toolheadID)
	}
	if locationName != "My Printer - Toolhead 1" {
		t.Fatalf("unexpected location name %q", locationName)
	}

	_, toolheadID2, _, isPrinterLocation2, err := ParseLocationParam(bridge, "My Printer - Toolhead 2")
	if err != nil {
		t.Fatalf("ParseLocationParam failed: %v", err)
	}
	if !isPrinterLocation2 || toolheadID2 != 1 {
		t.Fatalf("expected toolhead_id 1 for Toolhead 2, got %d (printer=%v)", toolheadID2, isPrinterLocation2)
	}
}
