package server

import (
	"log"
	"time"

	"filabridge/bambu"
	"filabridge/core"
	"filabridge/snapmaker"
)

// BuildStatus gets current status of all printers and mappings, combining
// Moonraker (Snapmaker) polling data and Bambu (Home Assistant) live data.
func (ws *WebServer) BuildStatus() (*core.PrinterStatus, error) {
	b := ws.bridge

	status := &core.PrinterStatus{
		Printers:         make(map[string]core.PrinterData),
		ToolheadMappings: make(map[string]map[int]core.ToolheadMapping),
		Timestamp:        time.Now(),
	}

	configSnapshot := b.GetConfigSnapshot()
	if configSnapshot == nil {
		status.Printers["no_printers"] = core.PrinterData{
			Name:  "No Printers Configured",
			State: core.StateNotConfigured,
		}
		return status, nil
	}

	if len(configSnapshot.Printers) > 0 {
		for printerID, printerConfig := range configSnapshot.Printers {
			if printerID == "no_printers" {
				continue // Skip placeholder
			}

			if printerConfig.Driver == core.DriverBambuHA {
				status.Printers[printerID] = bambu.BuildPrinterData(b, printerID, printerConfig)
				continue
			}

			client := snapmaker.NewMoonrakerClient(printerConfig.IPAddress, printerConfig.APIKey, b.Config.PrinterTimeout, b.Config.PrinterFileDownloadTimeout)

			printerName := printerConfig.Name

			printerStatus, err := client.GetPrinterStatus()
			if err != nil {
				log.Printf("Warning: Failed to get printer status from %s (%s - %s): %v",
					printerConfig.IPAddress, printerID, printerName, err)
				status.Printers[printerID] = core.PrinterData{
					Name:  printerName,
					State: core.StateOffline,
				}
				continue
			}

			status.Printers[printerID] = snapmaker.BuildPrinterData(printerName, printerStatus, client)
		}
	} else {
		status.Printers["no_printers"] = core.PrinterData{
			Name:  "No Printers Configured",
			State: core.StateNotConfigured,
		}
	}

	// Get toolhead mappings for all printers
	for printerID, printerConfig := range configSnapshot.Printers {
		if printerID == "no_printers" {
			continue // Skip placeholder
		}

		printerName := printerConfig.Name
		mappings, err := b.GetToolheadMappings(printerName)
		if err != nil {
			log.Printf("Error getting toolhead mappings for %s: %v", printerName, err)
			mappings = make(map[int]core.ToolheadMapping)
		}

		toolheadNames, err := b.GetAllToolheadNames(printerID)
		if err != nil {
			log.Printf("Warning: Failed to get toolhead names for printer %s: %v", printerID, err)
			toolheadNames = make(map[int]string)
		}

		// Create enhanced mappings for ALL toolheads (including unmapped ones)
		enhancedMappings := make(map[int]core.ToolheadMapping)
		for toolheadID := 0; toolheadID < printerConfig.Toolheads; toolheadID++ {
			var displayName string
			if name, exists := toolheadNames[toolheadID]; exists {
				displayName = name
			} else {
				displayName = core.DefaultToolheadDisplayName(toolheadID)
			}

			if mapping, exists := mappings[toolheadID]; exists {
				mapping.DisplayName = displayName
				enhancedMappings[toolheadID] = mapping
			} else {
				enhancedMappings[toolheadID] = core.ToolheadMapping{
					PrinterName: printerName,
					ToolheadID:  toolheadID,
					SpoolID:     0, // No spool mapped
					DisplayName: displayName,
				}
			}
		}
		status.ToolheadMappings[printerID] = enhancedMappings
	}

	return status, nil
}
