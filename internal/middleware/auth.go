package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/nimish-nirmal/polyorch/internal/handlers"
)

func Auth(apiKey string) gin.HandlerFunc {
	skipPaths := map[string]bool{
		"/health":               true,
		"/swagger/index.html":   true,
		"/swagger/doc.json":     true,
		"/swagger/swagger.json": true,
		"/api/v1/auth/login":    true,
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path
		if skipPaths[path] {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(401, gin.H{"error": "invalid authorization header"})
			c.Abort()
			return
		}

		tokenString := parts[1]
		user, err := handlers.ValidateToken(tokenString)
		if err != nil {
			c.JSON(401, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		c.Set("username", user.Username)
		c.Next()
	}
}
