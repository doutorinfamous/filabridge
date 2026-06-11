package core

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

// GetToolheadMapping gets spool ID mapped to a specific toolhead.
func (b *FilamentBridge) GetToolheadMapping(printerName string, toolheadID int) (int, error) {
	b.Mutex.RLock()
	defer b.Mutex.RUnlock()

	var spoolID int
	err := b.DB.QueryRow(
		"SELECT spool_id FROM toolhead_mappings WHERE printer_name = ? AND toolhead_id = ?",
		printerName, toolheadID,
	).Scan(&spoolID)

	if err == sql.ErrNoRows {
		return 0, nil // No mapping found
	}
	if err != nil {
		return 0, fmt.Errorf("failed to get toolhead mapping: %w", err)
	}

	return spoolID, nil
}

// SetToolheadMapping maps a spool to a specific toolhead.
func (b *FilamentBridge) SetToolheadMapping(printerName string, toolheadID int, spoolID int) error {
	b.Mutex.Lock()

	// Get the previous spool ID before replacing it (for auto-assignment feature)
	var previousSpoolID int
	err := b.DB.QueryRow(
		"SELECT spool_id FROM toolhead_mappings WHERE printer_name = ? AND toolhead_id = ?",
		printerName, toolheadID,
	).Scan(&previousSpoolID)
	if err != nil && err != sql.ErrNoRows {
		b.Mutex.Unlock()
		return fmt.Errorf("failed to get previous spool mapping: %w", err)
	}
	// If no previous mapping exists, previousSpoolID will be 0

	if err := b.ensureSpoolNotAssignedElsewhereLocked(spoolID, ExcludeAssignment{
		PrinterName: printerName,
		ToolheadID:  toolheadID,
	}); err != nil {
		b.Mutex.Unlock()
		return err
	}

	_, err = b.DB.Exec(
		"INSERT OR REPLACE INTO toolhead_mappings (printer_name, toolhead_id, spool_id, mapped_at) VALUES (?, ?, ?, ?)",
		printerName, toolheadID, spoolID, time.Now(),
	)
	if err != nil {
		b.Mutex.Unlock()
		return fmt.Errorf("failed to set toolhead mapping: %w", err)
	}

	log.Printf("Mapped %s toolhead %d to spool %d", printerName, toolheadID, spoolID)

	// Check if auto-assign feature is enabled and we have a previous spool to assign
	enabled, err := b.GetAutoAssignPreviousSpoolEnabled()
	if err != nil {
		log.Printf("Warning: Failed to check auto-assign previous spool setting: %v", err)
		b.Mutex.Unlock()
		return nil // Don't fail the assignment if we can't check the setting
	}

	// Unlock before potentially calling AssignSpoolToLocation (which may need locks)
	b.Mutex.Unlock()

	if enabled && previousSpoolID > 0 && previousSpoolID != spoolID {
		locationName, err := b.GetAutoAssignPreviousSpoolLocation()
		if err != nil {
			log.Printf("Warning: Failed to get auto-assign previous spool location setting: %v", err)
			return nil
		}

		if locationName != "" {
			location, err := b.Spoolman.FindLocationByName(locationName)
			if err != nil || location == nil {
				log.Printf("Warning: Auto-assign previous spool location '%s' does not exist, skipping auto-assignment of spool %d", locationName, previousSpoolID)
				return nil
			}

			// Use isPrinterLocation = false since this is a storage location
			if err := b.AssignSpoolToLocation(previousSpoolID, "", 0, locationName, false); err != nil {
				log.Printf("Warning: Failed to auto-assign previous spool %d to location '%s': %v", previousSpoolID, locationName, err)
			} else {
				log.Printf("Auto-assigned previous spool %d to location '%s'", previousSpoolID, locationName)
			}
		}
	}

	return nil
}

// TryAutoAssignSpoolToDefaultStorage moves an unmapped spool to the configured storage location.
func (b *FilamentBridge) TryAutoAssignSpoolToDefaultStorage(spoolID int) {
	if spoolID <= 0 {
		return
	}

	enabled, err := b.GetAutoAssignPreviousSpoolEnabled()
	if err != nil {
		log.Printf("Warning: Failed to check auto-assign previous spool setting: %v", err)
		return
	}
	if !enabled {
		return
	}

	locationName, err := b.GetAutoAssignPreviousSpoolLocation()
	if err != nil {
		log.Printf("Warning: Failed to get auto-assign previous spool location setting: %v", err)
		return
	}
	if locationName == "" {
		return
	}

	location, err := b.Spoolman.FindLocationByName(locationName)
	if err != nil || location == nil {
		log.Printf("Warning: Auto-assign previous spool location '%s' does not exist, skipping auto-assignment of spool %d", locationName, spoolID)
		return
	}

	if err := b.AssignSpoolToLocation(spoolID, "", 0, locationName, false); err != nil {
		log.Printf("Warning: Failed to auto-assign unmapped spool %d to location '%s': %v", spoolID, locationName, err)
		return
	}
	log.Printf("Auto-assigned unmapped spool %d to location '%s'", spoolID, locationName)
}

// GetToolheadMappings gets all toolhead mappings for a printer.
func (b *FilamentBridge) GetToolheadMappings(printerName string) (map[int]ToolheadMapping, error) {
	rows, err := b.DB.Query(
		"SELECT toolhead_id, spool_id, mapped_at FROM toolhead_mappings WHERE printer_name = ?",
		printerName,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mappings := make(map[int]ToolheadMapping)
	for rows.Next() {
		var toolheadID, spoolID int
		var mappedAt time.Time
		if err := rows.Scan(&toolheadID, &spoolID, &mappedAt); err != nil {
			return nil, err
		}
		mappings[toolheadID] = ToolheadMapping{
			PrinterName: printerName,
			ToolheadID:  toolheadID,
			SpoolID:     spoolID,
			MappedAt:    mappedAt,
		}
	}

	return mappings, nil
}

// GetAllToolheadMappings gets all toolhead mappings across all printers.
func (b *FilamentBridge) GetAllToolheadMappings() (map[string]map[int]ToolheadMapping, error) {
	rows, err := b.DB.Query(
		"SELECT printer_name, toolhead_id, spool_id, mapped_at FROM toolhead_mappings ORDER BY printer_name, toolhead_id",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	mappings := make(map[string]map[int]ToolheadMapping)
	for rows.Next() {
		var printerName string
		var toolheadID, spoolID int
		var mappedAt time.Time
		if err := rows.Scan(&printerName, &toolheadID, &spoolID, &mappedAt); err != nil {
			return nil, err
		}

		if mappings[printerName] == nil {
			mappings[printerName] = make(map[int]ToolheadMapping)
		}

		mappings[printerName][toolheadID] = ToolheadMapping{
			PrinterName: printerName,
			ToolheadID:  toolheadID,
			SpoolID:     spoolID,
			MappedAt:    mappedAt,
		}
	}

	return mappings, nil
}

// UnmapToolhead removes a spool mapping from a toolhead.
func (b *FilamentBridge) UnmapToolhead(printerName string, toolheadID int) error {
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	_, err := b.DB.Exec(
		"DELETE FROM toolhead_mappings WHERE printer_name = ? AND toolhead_id = ?",
		printerName, toolheadID,
	)
	if err != nil {
		return fmt.Errorf("failed to unmap toolhead: %w", err)
	}

	log.Printf("Unmapped %s toolhead %d", printerName, toolheadID)
	return nil
}
