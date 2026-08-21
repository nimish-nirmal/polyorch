package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"

	natspkg "github.com/nimish-nirmal/polyorch/internal/nats"
	"github.com/nimish-nirmal/polyorch/internal/config"
	"github.com/nimish-nirmal/polyorch/internal/database"
	"github.com/nimish-nirmal/polyorch/internal/handlers"
	"github.com/nimish-nirmal/polyorch/internal/middleware"
	"github.com/nimish-nirmal/polyorch/internal/websocket"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()

	conn, err := database.Open(cfg.DBPath)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to open database")
	}
	defer conn.Conn.Close()

	nc, err := nats.Connect(cfg.NATSURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to NATS")
	}
	defer nc.Close()

	js, err := jetstream.New(nc)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to create JetStream context")
	}

	if err := natspkg.EnsureStream(context.Background(), js, &logger); err != nil {
		logger.Fatal().Err(err).Msg("failed to ensure stream")
	}

	apiKey := os.Getenv("POLYORCH_API_KEY")

	if apiKey == "" {
		logger.Warn().Msg("POLYORCH_API_KEY not set, auth disabled")
	}

	hub := websocket.NewHub()
	go hub.Run()

	store := database.NewSQLiteStore(conn.Conn)
	server := handlers.NewServer(store)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.CORS())
	router.Use(middleware.SecurityHeaders())
	router.MaxMultipartMemory = 50 << 20

	v1 := router.Group("/api/v1")
	if apiKey != "" {
		v1.Use(middleware.Auth(apiKey))
	}
	{
		v1.POST("/projects", server.CreateProject)
		v1.GET("/projects", server.ListProjects)
		v1.GET("/projects/:id", server.GetProject)

		v1.POST("/projects/:id/versions", server.CreateVersion)
		v1.GET("/projects/:id/versions", server.ListVersions)
		v1.POST("/projects/:id/versions/:versionId/activate", server.SetActiveVersion)

		v1.POST("/runs", server.CreateRun)
		v1.GET("/runs", server.ListRuns)
		v1.GET("/runs/:id", server.GetRun)
		v1.GET("/runs/:id/logs", server.GetRunLogs)

		v1.GET("/ws/logs/:run_id", func(c *gin.Context) {
			websocket.NewHandler(hub, cfg.NATSURL).ServeHTTP(c)
		})
	}

	router.GET("/health", handlers.Health)

	if viper.GetBool("swagger_enabled") {
		handlers.SetupSwagger(router.Group(""))
	}

	if cfg.WebDir != "" {
		router.NoRoute(func(c *gin.Context) {
			c.File(cfg.WebDir + "/index.html")
		})
	}

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: router,
	}

	go func() {
		logger.Info().Str("addr", srv.Addr).Msg("API server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("shutting down server")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error().Err(err).Msg("server shutdown error")
	}

	logger.Info().Msg("server stopped")
}
