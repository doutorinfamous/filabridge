package core

// Printer states
const (
	StateIdle          = "IDLE"
	StatePrinting      = "PRINTING"
	StateFinished      = "FINISHED"
	StateError         = "error"
	StateOffline       = "offline"
	StateNotConfigured = "not_configured"
)

// Default configuration values
const (
	DefaultSpoolmanURL          = "http://localhost:7912"
	DefaultWebPort              = "5001"
	DefaultPollInterval         = 30
	DefaultLocationSyncInterval = 5 // minutes
	DefaultDBFileName           = "filabridge.db"
)

// Database configuration keys
const (
	ConfigKeyPrinterIPs                 = "printer_ips"
	ConfigKeyAPIKey                     = "printer_api_key"
	ConfigKeySpoolmanURL                = "spoolman_url"
	ConfigKeyPollInterval               = "poll_interval"
	ConfigKeyLocationSyncInterval       = "location_sync_interval"
	ConfigKeyWebPort                    = "web_port"
	ConfigKeyPrinterTimeout             = "printer_timeout"
	ConfigKeyPrinterFileDownloadTimeout = "printer_file_download_timeout"
	// Legacy config keys kept for migration from PrusaLink installs.
	ConfigKeyLegacyAPIKey                     = "prusalink_api_key"
	ConfigKeyLegacyPrinterTimeout             = "prusalink_timeout"
	ConfigKeyLegacyPrinterFileDownloadTimeout = "prusalink_file_download_timeout"
	ConfigKeySpoolmanTimeout                  = "spoolman_timeout"
	ConfigKeySpoolmanUsername                 = "spoolman_username"
	ConfigKeySpoolmanPassword                 = "spoolman_password"
	ConfigKeyAutoAssignPreviousSpoolEnabled   = "auto_assign_previous_spool_enabled"
	ConfigKeyAutoAssignPreviousSpoolLocation  = "auto_assign_previous_spool_location"
	ConfigKeyHAURL                            = "ha_url"
	ConfigKeyHAToken                          = "ha_token"
	ConfigKeyFilabridgePublicURL              = "filabridge_public_url"
)

// Printer drivers
const (
	DriverMoonraker = "moonraker"
	DriverBambuHA   = "bambu_ha"
)

// HTTP timeouts
const (
	PrinterTimeout             = 10  // seconds
	PrinterFileDownloadTimeout = 300 // seconds for file downloads
	SpoolmanTimeout            = 10  // seconds
)
