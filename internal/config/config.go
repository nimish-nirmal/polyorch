package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/rs/zerolog"
	"github.com/spf13/viper"
)

type Config struct {
	Port       string
	DBPath     string
	NATSURL    string
	RunsTmpDir string
	LogLevel   string
	WebDir     string
}

func Load() (*Config, error) {
	viper.SetEnvPrefix("POLYORCH")
	viper.AutomaticEnv()

	viper.SetDefault("port", "8082")
	viper.SetDefault("db_path", "./polyorch.db")
	viper.SetDefault("nats_url", "nats://localhost:4222")
	viper.SetDefault("runs_tmp_dir", "/tmp/runs")
	viper.SetDefault("log_level", "info")
	viper.SetDefault("web_dir", detectWebDir())

	viper.BindEnv("db_path", "DB_PATH")
	viper.BindEnv("nats_url", "NATS_URL")
	viper.BindEnv("runs_tmp_dir", "RUNS_TMP_DIR")

	cfg := &Config{
		Port:       viper.GetString("port"),
		DBPath:     viper.GetString("db_path"),
		NATSURL:    viper.GetString("nats_url"),
		RunsTmpDir: viper.GetString("runs_tmp_dir"),
		LogLevel:   viper.GetString("log_level"),
		WebDir:     viper.GetString("web_dir"),
	}

	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		return nil, fmt.Errorf("invalid log level %q: %w", cfg.LogLevel, err)
	}
	zerolog.SetGlobalLevel(level)

	return cfg, nil
}

func detectWebDir() string {
	candidates := []string{
		filepath.Join(".", "web", "dist"),
		filepath.Join("web", "dist"),
		filepath.Join("/app", "web"),
	}
	for _, dir := range candidates {
		if dir != "" {
			if info, err := os.Stat(dir); err == nil && info.IsDir() {
				return dir
			}
		}
	}
	return ""
}
