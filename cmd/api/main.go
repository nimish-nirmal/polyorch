package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nats-io/nats.go"
	"github.com/nats-io/nats.go/jetstream"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"

	"github.com/nimish-nirmal/polyorch/internal/config"
	"github.com/nimish-nirmal/polyorch/internal/database"
	"github.com/nimish-nirmal/polyorch/internal/handlers"
	"github.com/nimish-nirmal/polyorch/internal/middleware"
	natspkg "github.com/nimish-nirmal/polyorch/internal/nats"
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
	authBypass := os.Getenv("POLYORCH_AUTH_BYPASS") == "true"

	if apiKey == "" && !authBypass {
		logger.Warn().Msg("POLYORCH_API_KEY not set, auth disabled")
	}

	hub := websocket.NewHub()
	go hub.Run()

	store := database.NewSQLiteStore(conn.Conn)
	server := handlers.NewServer(store, js)

	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.CORS())
	router.Use(middleware.SecurityHeaders())
	router.MaxMultipartMemory = 50 << 20

	auth := router.Group("/api/v1/auth")
	{
		auth.POST("/login", server.Login)
		auth.POST("/change-password", handlers.JWTAuth(), server.ChangePassword)
		auth.POST("/reset", handlers.JWTAuth(), server.ResetPassword)
		auth.GET("/me", handlers.JWTAuth(), server.Me)
	}

	protected := router.Group("/api/v1")
	if !authBypass {
		protected.Use(handlers.JWTAuth())
	}
	{
		protected.POST("/projects", server.CreateProject)
		protected.GET("/projects", server.ListProjects)
		protected.GET("/projects/:id", server.GetProject)

		protected.POST("/projects/:id/versions", server.CreateVersion)
		protected.GET("/projects/:id/versions", server.ListVersions)
		protected.POST("/projects/:id/versions/:versionId/activate", server.SetActiveVersion)
		protected.GET("/projects/:id/versions/:versionId/files", server.ListVersionFiles)
		protected.GET("/projects/:id/versions/:versionId/files/*filename", server.GetVersionFile)
		protected.PUT("/projects/:id/versions/:versionId/files/*filename", server.UpdateVersionFile)

		protected.POST("/runs", server.CreateRun)
		protected.GET("/runs", server.ListRuns)
		protected.GET("/runs/:id", server.GetRun)
		protected.GET("/runs/:id/logs", server.GetRunLogs)
		protected.POST("/runs/:id/start", server.StartRun)
		protected.DELETE("/runs/:id/logs", server.ClearRunLogs)
		protected.DELETE("/runs/:id", server.DeleteRun)
	}

	router.GET("/health", handlers.Health)

	router.GET("/api/v1/ws/logs/:run_id", func(c *gin.Context) {
		websocket.NewHandler(hub, cfg.NATSURL).ServeHTTP(c)
	})

	if viper.GetBool("swagger_enabled") {
		handlers.SetupSwagger(router.Group(""))
	}

	if cfg.WebDir != "" {
		// The frontend is built with vite `base: /polyorch/` and mounts its
		// router at that basename. Serving the SPA shell at "/" would leave the
		// router with no matching route (a blank page), so redirect the bare
		// root to the canonical mount point instead.
		redirectRoot := func(c *gin.Context) {
			c.Redirect(http.StatusMovedPermanently, "/polyorch/")
		}
		router.GET("/", redirectRoot)
		router.HEAD("/", redirectRoot)

		router.StaticFS("/polyorch", http.Dir(cfg.WebDir))

		router.NoRoute(func(c *gin.Context) {
			// Unknown API endpoints must return JSON, not the SPA shell.
			if strings.HasPrefix(c.Request.URL.Path, "/api/") {
				c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
				return
			}
			// SPA fallback: serve the shell for client-side routes such as
			// /polyorch/login so deep links and refreshes work.
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
