package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func newTestBridgeWithSpoolman(t *testing.T, handler http.HandlerFunc) (*FilamentBridge, *WebServer) {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	dir := t.TempDir()
	bridge, err := NewFilamentBridge(&Config{
		DBFile:      filepath.Join(dir, "test.db"),
		SpoolmanURL: server.URL,
	})
	if err != nil {
		t.Fatalf("failed to create bridge: %v", err)
	}
	t.Cleanup(func() { bridge.Close() })

	if err := bridge.SavePrinterConfig("printer1", PrinterConfig{
		Name:      "My Printer",
		IPAddress: "127.0.0.1",
		Toolheads: 2,
	}); err != nil {
		t.Fatalf("failed to save printer config: %v", err)
	}

	return bridge, NewWebServer(bridge)
}

func postMapToolhead(t *testing.T, ws *WebServer, body string) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(http.MethodPost, "/api/map_toolhead", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	ws.router.ServeHTTP(rec, req)
	return rec
}

func TestMapToolheadHandlerUpdatesSpoolmanLocation(t *testing.T) {
	var patchedSpoolID int
	var patchedLocation string

	_, ws := newTestBridgeWithSpoolman(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPatch && strings.HasPrefix(r.URL.Path, "/api/v1/spool/"):
			idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/spool/")
			patchedSpoolID, _ = strconv.Atoi(idStr)

			var update map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			if loc, ok := update["location"].(string); ok {
				patchedLocation = loc
			}
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{})
		case r.URL.Path == "/api/v1/setting/locations":
			http.NotFound(w, r)
		case r.URL.Path == "/api/v1/location":
			json.NewEncoder(w).Encode([]string{})
		default:
			http.NotFound(w, r)
		}
	})

	rec := postMapToolhead(t, ws, `{"printer_name":"My Printer","toolhead_id":0,"spool_id":42}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	if patchedSpoolID != 42 {
		t.Fatalf("expected Spoolman PATCH for spool 42, got %d", patchedSpoolID)
	}
	if patchedLocation != "My Printer - Toolhead 0" {
		t.Fatalf("expected Spoolman location %q, got %q", "My Printer - Toolhead 0", patchedLocation)
	}
}

func TestMapToolheadHandlerUnmapAutoAssignsToStorage(t *testing.T) {
	type spoolPatch struct {
		spoolID  int
		location string
	}
	var patches []spoolPatch

	bridge, ws := newTestBridgeWithSpoolman(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPatch && strings.HasPrefix(r.URL.Path, "/api/v1/spool/"):
			idStr := strings.TrimPrefix(r.URL.Path, "/api/v1/spool/")
			spoolID, _ := strconv.Atoi(idStr)

			var update map[string]interface{}
			if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			loc, _ := update["location"].(string)
			patches = append(patches, spoolPatch{spoolID: spoolID, location: loc})
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{})
		case r.URL.Path == "/api/v1/setting/locations":
			json.NewEncoder(w).Encode(spoolmanSettingResponse{
				Value: `["Drybox"]`,
				IsSet: true,
				Type:  "array",
			})
		case r.URL.Path == "/api/v1/location":
			json.NewEncoder(w).Encode([]string{"Drybox"})
		default:
			http.NotFound(w, r)
		}
	})

	if err := bridge.SetAutoAssignPreviousSpoolEnabled(true); err != nil {
		t.Fatalf("failed to enable auto-assign: %v", err)
	}
	if err := bridge.SetAutoAssignPreviousSpoolLocation("Drybox"); err != nil {
		t.Fatalf("failed to set auto-assign location: %v", err)
	}
	if err := bridge.SetToolheadMapping("My Printer", 0, 10); err != nil {
		t.Fatalf("failed to set initial mapping: %v", err)
	}

	rec := postMapToolhead(t, ws, `{"printer_name":"My Printer","toolhead_id":0,"spool_id":0}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}

	spoolID, err := bridge.GetToolheadMapping("My Printer", 0)
	if err != nil {
		t.Fatalf("GetToolheadMapping failed: %v", err)
	}
	if spoolID != 0 {
		t.Fatalf("expected toolhead unmapped, got spool %d", spoolID)
	}

	foundStoragePatch := false
	for _, p := range patches {
		if p.spoolID == 10 && p.location == "Drybox" {
			foundStoragePatch = true
		}
	}
	if !foundStoragePatch {
		t.Fatalf("expected Spoolman PATCH moving spool 10 to Drybox, got %+v", patches)
	}
}
