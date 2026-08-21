package config

import (
	"fmt"

	"github.com/rs/zerolog"
	"github.com/spf13/viper"
)

type Config struct {
	Port        string
	DBPath      string
	NATSURL     string
	RunsTmpDir  string
	LogLevel    string
	WebDir      string
}

func Load() (*Config, error) {
	viper.SetEnvPrefix("POLYORCH")
	viper.AutomaticEnv()

	viper.SetDefault("port", "8080")
	viper.SetDefault("db_path", "./polyorch.db")
	viper.SetDefault("nats_url", "nats://localhost:4222")
	viper.SetDefault("runs_tmp_dir", "/tmp/runs")
	viper.SetDefault("log_level", "info")
	viper.SetDefault("web_dir", "/app/web")

	cfg := &Config{
		Port:        viper.GetString("port"),
		DBPath:      viper.GetString("db_path"),
		NATSURL:     viper.GetString("nats_url"),
		RunsTmpDir:  viper.GetString("runs_tmp_dir"),
		LogLevel:    viper.GetString("log_level"),
		WebDir:      viper.GetString("web_dir"),
	}

	level, err := zerolog.ParseLevel(cfg.LogLevel)
	if err != nil {
		return nil, fmt.Errorf("invalid log level %q: %w", cfg.LogLevel, err)
	}
	zerolog.SetGlobalLevel(level)

	return cfg, nil
}
