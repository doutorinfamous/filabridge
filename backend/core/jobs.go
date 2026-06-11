package core

import (
	"fmt"
	"log"
	"time"
)

// LogPrintUsage logs filament usage for a print job.
func (b *FilamentBridge) LogPrintUsage(printerName string, toolheadID int, spoolID int, filamentUsed float64, jobName string) error {
	b.Mutex.Lock()
	defer b.Mutex.Unlock()

	// Get print start time from current job file tracking
	printStarted := time.Now() // Default to now if we can't determine start time
	if storedJobFile, exists := b.CurrentJobFile[printerName]; exists && storedJobFile != "" {
		// Rough approximation — ideally tracked precisely when the print starts
		printStarted = time.Now().Add(-time.Hour)
	}

	_, err := b.DB.Exec(
		"INSERT INTO print_history (printer_name, toolhead_id, spool_id, filament_used, print_started, print_finished, job_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
		printerName, toolheadID, spoolID, filamentUsed, printStarted, time.Now(), jobName,
	)
	if err != nil {
		return fmt.Errorf("failed to log print usage: %w", err)
	}

	return nil
}

// IsJobProcessed checks whether a completed job was already processed for filament usage.
func (b *FilamentBridge) IsJobProcessed(printerID, filename string) (bool, error) {
	if filename == "" {
		return false, nil
	}

	var count int
	err := b.DB.QueryRow(
		"SELECT COUNT(*) FROM processed_jobs WHERE printer_id = ? AND filename = ?",
		printerID, filename,
	).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check processed job: %w", err)
	}
	return count > 0, nil
}

// MarkJobProcessed records a job as processed to prevent duplicate filament deductions.
func (b *FilamentBridge) MarkJobProcessed(printerID, filename string) error {
	if filename == "" {
		return nil
	}

	_, err := b.DB.Exec(
		"INSERT OR REPLACE INTO processed_jobs (printer_id, filename, processed_at) VALUES (?, ?, ?)",
		printerID, filename, time.Now(),
	)
	if err != nil {
		return fmt.Errorf("failed to mark job as processed: %w", err)
	}
	return nil
}

// ClearProcessedJob removes a processed-job record so the same file can be tracked on reprint.
func (b *FilamentBridge) ClearProcessedJob(printerID, filename string) error {
	if filename == "" {
		return nil
	}

	_, err := b.DB.Exec(
		"DELETE FROM processed_jobs WHERE printer_id = ? AND filename = ?",
		printerID, filename,
	)
	if err != nil {
		return fmt.Errorf("failed to clear processed job: %w", err)
	}
	return nil
}

// ProcessFilamentUsage processes filament usage updates for all toolheads.
// Extruder index from G-code maps directly to FilaBridge toolhead index (no remapping).
func (b *FilamentBridge) ProcessFilamentUsage(printerName string, filamentUsage map[int]float64, jobName string) error {
	updatedCount := 0
	unmappedToolheads := make([]int, 0)

	for toolheadID, usedWeight := range filamentUsage {
		if usedWeight <= 0 {
			continue
		}

		spoolID, err := b.GetToolheadMapping(printerName, toolheadID)
		if err != nil {
			errMsg := fmt.Sprintf("error getting toolhead mapping for %s toolhead %d: %v", printerName, toolheadID, err)
			log.Print(errMsg)
			b.AddPrintError(printerName, jobName, errMsg)
			continue
		}

		if spoolID == 0 {
			log.Printf("No spool mapped to %s toolhead %d, skipping filament usage update",
				printerName, toolheadID)
			unmappedToolheads = append(unmappedToolheads, toolheadID)
			continue
		}

		if err := b.Spoolman.UpdateSpoolUsage(spoolID, usedWeight); err != nil {
			errMsg := fmt.Sprintf("failed to update spool %d in Spoolman: %v", spoolID, err)
			log.Printf("Error updating spool %d usage: %v", spoolID, err)
			b.AddPrintError(printerName, jobName, errMsg)
			continue
		}

		if err := b.LogPrintUsage(printerName, toolheadID, spoolID, usedWeight, jobName); err != nil {
			log.Printf("Error logging print usage: %v", err)
		}

		updatedCount++
		log.Printf("Updated spool %d: used %.2fg filament on %s toolhead %d",
			spoolID, usedWeight, printerName, toolheadID)
	}

	for _, toolheadID := range unmappedToolheads {
		weight := filamentUsage[toolheadID]
		errMsg := fmt.Sprintf(
			"G-code indica %.2fg no extruder %d, mas nenhum spool está mapeado no %s. Mapeie o spool no toolhead correto ou configure o extruder certo no Snapmaker Orca.",
			weight, toolheadID, DefaultToolheadDisplayName(toolheadID),
		)
		b.AddPrintError(printerName, jobName, errMsg)
	}

	if updatedCount > 0 {
		log.Printf("Print completion processing finished for %s: updated %d spool(s)", printerName, updatedCount)
		return nil
	}

	if len(filamentUsage) > 0 {
		log.Printf("No filament usage data processed for %s", printerName)
		return fmt.Errorf("no spools were updated for print %s", jobName)
	}

	log.Printf("No filament usage data processed for %s", printerName)
	return fmt.Errorf("no filament usage to process for print %s", jobName)
}
