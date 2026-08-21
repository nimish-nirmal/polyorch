package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
)

func Auth(apiKey string) gin.HandlerFunc {
	skipPaths := map[string]bool{
		"/health":               true,
		"/swagger/index.html":   true,
		"/swagger/doc.json":     true,
		"/swagger/swagger.json": true,
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if skipPaths[path] {
			c.Next()
			return
		}

		key := c.GetHeader("X-API-Key")
		if key == "" {
			logger := zerolog.Ctx(c.Request.Context())
			logger.Warn().Msg("missing API key")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing API key"})
			c.Abort()
			return
		}

		if key != apiKey {
			logger := zerolog.Ctx(c.Request.Context())
			logger.Warn().Msg("invalid API key")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid API key"})
			c.Abort()
			return
		}

		c.Next()
	}
}
